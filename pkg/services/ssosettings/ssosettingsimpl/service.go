package ssosettingsimpl

import (
	"context"
	"encoding/base64"
	"errors"
	"fmt"
	"slices"
	"strings"
	"sync"
	"time"

	"github.com/prometheus/client_golang/prometheus"
	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/trace"

	"github.com/grafana/grafana/pkg/api/routing"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	legacyiamv0 "github.com/grafana/grafana/pkg/apis/iam/v0alpha1"
	grafanarest "github.com/grafana/grafana/pkg/apiserver/rest"
	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/infra/usagestats"
	"github.com/grafana/grafana/pkg/login/social"
	ac "github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/licensing"
	"github.com/grafana/grafana/pkg/services/secrets"
	"github.com/grafana/grafana/pkg/services/ssosettings"
	"github.com/grafana/grafana/pkg/services/ssosettings/api"
	"github.com/grafana/grafana/pkg/services/ssosettings/database"
	"github.com/grafana/grafana/pkg/services/ssosettings/models"
	"github.com/grafana/grafana/pkg/services/ssosettings/strategies"
	"github.com/grafana/grafana/pkg/setting"
)

var _ ssosettings.Service = (*Service)(nil)

var tracer = otel.Tracer("github.com/grafana/grafana/pkg/services/ssosettings/ssosettingsimpl")

type Service struct {
	logger           log.Logger
	cfg              *setting.Cfg
	store            ssosettings.Store
	settingsProvider setting.Provider
	ac               ac.AccessControl
	secrets          secrets.Service //nolint:staticcheck // SA1019: Legacy envelope encryption for single-tenant feature
	metrics          *metrics

	fbStrategies          []ssosettings.FallbackStrategy
	providersList         []string
	configurableProviders map[string]bool
	reloadables           map[string]ssosettings.Reloadable
	cachedSSOSettings     []*models.SSOSettings
	cacheMutex            sync.RWMutex

	// mtReadAuthoritative drops the legacy DB read when the storage mode reaches
	// mode 4, leaving MT-Settings as the sole read source.
	mtReadAuthoritative bool
}

func ProvideService(cfg *setting.Cfg, sqlStore db.DB, ac ac.AccessControl,
	routeRegister routing.RouteRegister, features featuremgmt.FeatureToggles,
	secrets secrets.Service, //nolint:staticcheck // SA1019: Legacy envelope encryption for single-tenant feature
	usageStats usagestats.Service, registerer prometheus.Registerer,
	settingsProvider setting.Provider, licensing licensing.Licensing,
) *Service {
	logger := log.New("ssosettings.service")

	// ProvideService cannot return an error: a broken MT-Settings client
	// configuration leaves the strategies without a client, and they fail
	// loudly on read while the legacy strategies keep serving when the
	// ssoSettingsToMTSettings toggle is off.
	mtSettingsClient, err := newMTSettingsClient(cfg, registerer)
	if err != nil {
		logger.Error("Failed to initialize the MT-Settings client", "error", err)
	}

	// The SSOSetting kind's dual-writer storage mode is the read-behavior lever.
	// serveReads flips MT-Settings on at mode 3; mtReadAuthoritative drops the
	// legacy DB read at mode 4. Below mode 3 the MT adapters match nothing.
	ssoMode := grafanarest.Mode0
	if resCfg, ok := cfg.UnifiedStorage[legacyiamv0.SSOSettingResourceInfo.GroupResource().String()]; ok {
		ssoMode = resCfg.DualWriterMode
	} else {
		// No storage mode configured for the kind (also the on-prem default, and
		// where a mistyped config section lands): stay on the legacy read path.
		logger.Debug("No storage mode configured for the SSOSetting kind, using legacy reads", "mode", ssoMode)
	}
	serveReads := ssoMode >= grafanarest.Mode3
	mtReadAuthoritative := ssoMode >= grafanarest.Mode4

	// Each provider family pairs an MT-Settings adapter with its legacy
	// strategy. The adapter sits first: while the ssoSettingsToMTSettings
	// feature toggle is enabled it wins the match for its family, otherwise
	// it matches nothing and the legacy strategy behaves as before.
	fbStrategies := []ssosettings.FallbackStrategy{
		strategies.NewMTSettingsOAuthStrategy(mtSettingsClient, serveReads),
		strategies.NewOAuthStrategy(cfg),
		strategies.NewMTSettingsLDAPStrategy(mtSettingsClient, serveReads),
		strategies.NewLDAPStrategy(cfg),
	}

	configurableProviders := make(map[string]bool)
	for provider, enabled := range cfg.SSOSettingsConfigurableProviders {
		configurableProviders[provider] = enabled
	}

	providersList := ssosettings.AllOAuthProviders
	providersList = append(providersList, social.LDAPProviderName)
	configurableProviders[social.LDAPProviderName] = true

	if licensing.FeatureEnabled(social.SAMLProviderName) {
		fbStrategies = append(fbStrategies, strategies.NewMTSettingsSAMLStrategy(mtSettingsClient, serveReads), strategies.NewSAMLStrategy(settingsProvider))
		providersList = append(providersList, social.SAMLProviderName)
		configurableProviders[social.SAMLProviderName] = true
	}

	store := database.ProvideStore(sqlStore)

	svc := &Service{
		logger:                logger,
		cfg:                   cfg,
		store:                 store,
		ac:                    ac,
		fbStrategies:          fbStrategies,
		secrets:               secrets,
		metrics:               newMetrics(registerer),
		providersList:         providersList,
		configurableProviders: configurableProviders,
		reloadables:           make(map[string]ssosettings.Reloadable),
		settingsProvider:      settingsProvider,
		cachedSSOSettings:     make([]*models.SSOSettings, 0),
		mtReadAuthoritative:   mtReadAuthoritative,
	}

	usageStats.RegisterMetricsFunc(svc.getUsageStats)

	ssoSettingsApi := api.ProvideApi(svc, routeRegister, ac)
	ssoSettingsApi.RegisterAPIEndpoints()

	return svc
}

var _ ssosettings.Service = (*Service)(nil)

func (s *Service) GetForProvider(ctx context.Context, provider string) (*models.SSOSettings, error) {
	systemSettings, servedByMT, err := s.loadSettingsUsingFallbackStrategy(ctx, provider)
	if err != nil {
		return nil, err
	}

	// Mode 4+: MT-Settings is the sole read source, the legacy DB read is dropped.
	if servedByMT && s.mtReadAuthoritative {
		return systemSettings, nil
	}

	dbSettings, err := s.store.Get(ctx, provider)
	if err != nil && !errors.Is(err, ssosettings.ErrNotFound) {
		return nil, err
	}

	if dbSettings != nil {
		// Settings are coming from the database thus secrets are encrypted
		dbSettings.Settings, err = s.decryptSecrets(ctx, dbSettings.Settings)
		if err != nil {
			return nil, err
		}
	}

	// Mode 3: MT-Settings wins the merge, the DB fills gaps (rollback window).
	if servedByMT {
		return s.mergeSSOSettingsMTAuthoritative(dbSettings, systemSettings), nil
	}

	return s.mergeSSOSettings(dbSettings, systemSettings), nil
}

func (s *Service) GetForProviderFromCache(ctx context.Context, provider string) (*models.SSOSettings, error) {
	s.cacheMutex.RLock()
	defer s.cacheMutex.RUnlock()

	for _, setting := range s.cachedSSOSettings {
		if setting.Provider == provider {
			return &models.SSOSettings{
				Provider: setting.Provider,
				Source:   setting.Source,
				Settings: deepCopyMap(setting.Settings),
			}, nil
		}
	}

	// If settings are not in the cache, we return them from the database if the provider is valid
	if slices.Contains(s.providersList, provider) {
		return s.GetForProvider(ctx, provider)
	}

	return nil, nil
}

func (s *Service) GetForProviderWithRedactedSecrets(ctx context.Context, provider string) (*models.SSOSettings, error) {
	if !s.isProviderConfigurable(provider) {
		return nil, ssosettings.ErrNotConfigurable
	}

	storeSettings, err := s.GetForProvider(ctx, provider)
	if err != nil {
		return nil, err
	}

	storeSettings.Settings = removeSecrets(storeSettings.Settings)

	return storeSettings, nil
}

func (s *Service) List(ctx context.Context) ([]*models.SSOSettings, error) {
	result := make([]*models.SSOSettings, 0, len(s.providersList))
	storedSettings, err := s.store.List(ctx)

	if err != nil {
		return nil, err
	}

	for _, provider := range s.providersList {
		fallbackSettings, servedByMT, err := s.loadSettingsUsingFallbackStrategy(ctx, provider)
		if err != nil {
			return nil, err
		}

		// Mode 4+: MT-Settings is the sole read source, the DB is ignored.
		if servedByMT && s.mtReadAuthoritative {
			result = append(result, fallbackSettings)
			continue
		}

		dbSettings := getSettingByProvider(provider, storedSettings)
		if dbSettings != nil {
			// Settings are coming from the database thus secrets are encrypted
			dbSettings.Settings, err = s.decryptSecrets(ctx, dbSettings.Settings)
			if err != nil {
				return nil, err
			}
		}

		// Mode 3: MT-Settings wins the merge, the DB fills gaps (rollback window).
		if servedByMT {
			result = append(result, s.mergeSSOSettingsMTAuthoritative(dbSettings, fallbackSettings))
			continue
		}

		result = append(result, s.mergeSSOSettings(dbSettings, fallbackSettings))
	}

	s.setCachedSSOSettings(result)

	return result, nil
}

func (s *Service) ListWithRedactedSecrets(ctx context.Context) ([]*models.SSOSettings, error) {
	storeSettings, err := s.List(ctx)
	if err != nil {
		return nil, err
	}

	configurableSettings := make([]*models.SSOSettings, 0, len(s.configurableProviders))
	for _, provider := range storeSettings {
		if s.isProviderConfigurable(provider.Provider) {
			configurableSettings = append(configurableSettings, provider)
		}
	}

	for _, storeSetting := range configurableSettings {
		storeSetting.Settings = removeSecrets(storeSetting.Settings)
	}

	return configurableSettings, nil
}

func (s *Service) Upsert(ctx context.Context, settings *models.SSOSettings, requester identity.Requester) error {
	if !s.isProviderConfigurable(settings.Provider) {
		return ssosettings.ErrNotConfigurable
	}

	reloadable, ok := s.reloadables[settings.Provider]
	if !ok {
		return ssosettings.ErrInvalidProvider.Errorf("provider %s not found in reloadables", settings.Provider)
	}

	storedSettings, err := s.GetForProvider(ctx, settings.Provider)
	if err != nil {
		return err
	}

	settingsWithSecrets, err := mergeSecrets(settings.Settings, storedSettings.Settings)
	if err != nil {
		return err
	}
	settings.Settings = settingsWithSecrets

	err = reloadable.Validate(ctx, *settings, *storedSettings, requester)
	if err != nil {
		return err
	}

	settings.Settings, err = s.encryptSecrets(ctx, settings.Settings)
	if err != nil {
		return err
	}

	err = s.store.Upsert(ctx, settings)
	if err != nil {
		return err
	}

	// make a copy of current settings for reload operation and apply overrides
	reloadSettings := *settings
	reloadSettings.Settings = overrideMaps(storedSettings.Settings, settingsWithSecrets)

	go s.reload(reloadable, settings.Provider, reloadSettings)

	return nil
}

func (s *Service) Patch(ctx context.Context, provider string, data map[string]any, requester identity.Requester) error {
	if !s.isProviderConfigurable(provider) {
		return ssosettings.ErrNotConfigurable
	}

	reloadable, ok := s.reloadables[provider]
	if !ok {
		return ssosettings.ErrInvalidProvider.Errorf("provider %s not found in reloadables", provider)
	}

	storedSettings, err := s.GetForProvider(ctx, provider)
	if err != nil {
		return err
	}

	newSettingsMap := make(map[string]any)
	for k, v := range storedSettings.Settings {
		newSettingsMap[k] = v
	}
	for k, v := range data {
		newSettingsMap[k] = v
	}

	newSettings := &models.SSOSettings{
		Provider: provider,
		Settings: newSettingsMap,
	}

	settingsWithSecrets, err := mergeSecrets(newSettings.Settings, storedSettings.Settings)
	if err != nil {
		return err
	}
	newSettings.Settings = settingsWithSecrets

	err = reloadable.Validate(ctx, *newSettings, *storedSettings, requester)
	if err != nil {
		return err
	}

	newSettings.Settings, err = s.encryptSecrets(ctx, newSettings.Settings)
	if err != nil {
		return err
	}

	err = s.store.Upsert(ctx, newSettings)
	if err != nil {
		return err
	}

	reloadSettings := *newSettings
	reloadSettings.Settings = overrideMaps(storedSettings.Settings, settingsWithSecrets)

	go s.reload(reloadable, provider, reloadSettings)

	return nil
}

func (s *Service) Delete(ctx context.Context, provider string) error {
	if !s.isProviderConfigurable(provider) {
		return ssosettings.ErrNotConfigurable
	}

	reloadable, ok := s.reloadables[provider]
	if !ok {
		return ssosettings.ErrInvalidProvider.Errorf("provider %s not found in reloadables", provider)
	}

	err := s.store.Delete(ctx, provider)
	if err != nil {
		return err
	}

	// When deleting settings for SAML, clear the Settings table
	if provider == social.SAMLProviderName {
		samlSettings := setting.SettingsRemovals{
			"auth.saml": make([]string, 0, len(s.settingsProvider.Current())),
		}
		for k := range s.settingsProvider.Current()["auth.saml"] {
			samlSettings["auth.saml"] = append(samlSettings["auth.saml"], k)
		}
		if err := s.settingsProvider.Update(setting.SettingsBag{}, samlSettings); err != nil {
			s.logger.Warn("Failed to remove SAML settings from the settings table", "error", err)
		}
	}

	currentSettings, err := s.GetForProvider(ctx, provider)
	if err != nil {
		s.logger.Error("failed to get current settings, skipping reload", "provider", provider, "error", err)
		return nil
	}

	go s.reload(reloadable, provider, *currentSettings)

	return nil
}

func (s *Service) reload(reloadable ssosettings.Reloadable, provider string, currentSettings models.SSOSettings) {
	s.updateCachedSSOSettings(provider, &currentSettings)

	err := reloadable.Reload(context.Background(), currentSettings)
	if err != nil {
		s.metrics.reloadFailures.WithLabelValues(provider).Inc()
		s.logger.Error("failed to reload the provider", "provider", provider, "error", err)
	}
}

func (s *Service) Reload(ctx context.Context, provider string) {
	panic("not implemented") // TODO: Implement
}

func (s *Service) RegisterReloadable(provider string, reloadable ssosettings.Reloadable) {
	if s.reloadables == nil {
		s.reloadables = make(map[string]ssosettings.Reloadable)
	}
	s.reloadables[provider] = reloadable
}

func (s *Service) RegisterFallbackStrategy(providerRegex string, strategy ssosettings.FallbackStrategy) {
	s.fbStrategies = append(s.fbStrategies, strategy)
}

// loadSettingsUsingFallbackStrategy returns the system settings and whether an
// MT-Settings adapter served them, which selects the read precedence downstream.
func (s *Service) loadSettingsUsingFallbackStrategy(ctx context.Context, provider string) (*models.SSOSettings, bool, error) {
	ctx, span := tracer.Start(ctx, "ssosettings.Service.loadSettingsUsingFallbackStrategy",
		trace.WithAttributes(attribute.String("provider", provider)))
	defer span.End()

	loadStrategy, ok := s.getFallbackStrategyFor(ctx, provider)
	if !ok {
		return nil, false, tracing.Errorf(span, "no fallback strategy found for provider: %s", provider)
	}
	span.SetAttributes(attribute.String("strategy", fmt.Sprintf("%T", loadStrategy)))

	settingsFromSystem, err := loadStrategy.GetProviderConfig(ctx, provider)
	if err != nil {
		return nil, false, tracing.Error(span, err)
	}

	return &models.SSOSettings{
		Provider: provider,
		Source:   models.System,
		Settings: settingsFromSystem,
	}, isMTSettingsFallback(loadStrategy), nil
}

// isMTSettingsFallback reports whether an MT-Settings adapter served the read.
// It is true only past the storage read-flip, so it selects MT-wins precedence.
func isMTSettingsFallback(strategy ssosettings.FallbackStrategy) bool {
	mt, ok := strategy.(ssosettings.MTSettingsFallback)
	return ok && mt.ServesMTSettings()
}

func getSettingByProvider(provider string, settings []*models.SSOSettings) *models.SSOSettings {
	for _, item := range settings {
		if item.Provider == provider {
			return item
		}
	}
	return nil
}

func (s *Service) getFallbackStrategyFor(ctx context.Context, provider string) (ssosettings.FallbackStrategy, bool) {
	for _, strategy := range s.fbStrategies {
		if strategy.IsMatch(ctx, provider) {
			return strategy, true
		}
	}
	return nil, false
}

func (s *Service) encryptSecrets(ctx context.Context, settings map[string]any) (map[string]any, error) {
	result := deepCopyMap(settings)
	configs := getConfigMaps(result)

	for _, config := range configs {
		for k, v := range config {
			if IsSecretField(k) && v != "" {
				strValue, ok := v.(string)
				if !ok {
					return result, fmt.Errorf("failed to encrypt %s setting because it is not a string: %v", k, v)
				}

				encryptedSecret, err := s.secrets.Encrypt(ctx, []byte(strValue), secrets.WithoutScope())
				if err != nil {
					return result, err
				}
				config[k] = base64.RawStdEncoding.EncodeToString(encryptedSecret)
			}
		}
	}

	return result, nil
}

func (s *Service) Run(ctx context.Context) error {
	interval := s.cfg.SSOSettingsReloadInterval
	if interval == 0 {
		return nil
	}

	ticker := time.NewTicker(interval)

	// start a background process for reloading the SSO settings for all providers at a fixed interval
	// it is useful for high availability setups running multiple Grafana instances
	for {
		select {
		case <-ticker.C:
			s.doReload(ctx)

		case <-ctx.Done():
			return ctx.Err()
		}
	}
}

func (s *Service) doReload(ctx context.Context) {
	s.logger.Debug("reloading SSO Settings for all providers")

	settingsList, err := s.List(ctx)
	if err != nil {
		s.logger.Error("failed to fetch SSO Settings for all providers", "err", err)
		return
	}

	for provider, connector := range s.reloadables {
		settings := getSettingByProvider(provider, settingsList)

		if settings == nil || len(settings.Settings) == 0 {
			s.logger.Warn("SSO Settings is empty", "provider", provider)
			continue
		}

		err = connector.Reload(ctx, *settings)
		if err != nil {
			s.metrics.reloadFailures.WithLabelValues(provider).Inc()
			s.logger.Error("failed to reload SSO Settings", "provider", provider, "err", err)
			continue
		}
	}
}

// mergeSSOSettings merges the settings from the database with the system settings
// Required because it is possible that the user has configured some of the settings (current Advanced OAuth settings)
// and the rest of the settings have to be loaded from the system settings
func (s *Service) mergeSSOSettings(dbSettings, systemSettings *models.SSOSettings) *models.SSOSettings {
	if dbSettings == nil {
		s.logger.Debug("No SSO Settings found in the database, using system settings")
		return systemSettings
	}

	s.logger.Debug("Merging SSO Settings", "dbSettings", removeSecrets(dbSettings.Settings), "systemSettings", removeSecrets(systemSettings.Settings))

	result := &models.SSOSettings{
		Provider: dbSettings.Provider,
		Source:   dbSettings.Source,
		Settings: mergeSettings(dbSettings.Settings, systemSettings.Settings),
		Created:  dbSettings.Created,
		Updated:  dbSettings.Updated,
	}

	return result
}

// mergeSSOSettingsMTAuthoritative merges with MT-Settings winning and the DB
// filling gaps (absent or empty values) — the mode-3 read precedence. Unlike
// mergeSettings it filters nothing: the merge routes values, validation owns
// the combined result.
func (s *Service) mergeSSOSettingsMTAuthoritative(dbSettings, systemSettings *models.SSOSettings) *models.SSOSettings {
	if dbSettings == nil {
		return systemSettings
	}

	s.logger.Debug("Merging SSO Settings, MT-Settings authoritative", "systemSettings", removeSecrets(systemSettings.Settings), "dbSettings", removeSecrets(dbSettings.Settings))

	settings := make(map[string]any, len(systemSettings.Settings))
	for k, v := range systemSettings.Settings {
		settings[k] = v
	}
	for k, v := range dbSettings.Settings {
		if existing, ok := settings[k]; !ok || isEmptyString(existing) {
			settings[k] = v
		}
	}

	return &models.SSOSettings{
		Provider: systemSettings.Provider,
		Source:   systemSettings.Source,
		Settings: settings,
		Created:  dbSettings.Created,
		Updated:  dbSettings.Updated,
	}
}

func (s *Service) decryptSecrets(ctx context.Context, settings map[string]any) (map[string]any, error) {
	configs := getConfigMaps(settings)

	for _, config := range configs {
		for k, v := range config {
			if IsSecretField(k) && v != "" {
				strValue, ok := v.(string)
				if !ok {
					s.logger.FromContext(ctx).Error("Failed to parse secret value, it is not a string", "key", k)
					return nil, fmt.Errorf("secret value is not a string")
				}

				decoded, err := base64.RawStdEncoding.DecodeString(strValue)
				if err != nil {
					s.logger.FromContext(ctx).Error("Failed to decode secret string", "err", err, "value")
					return nil, err
				}

				decrypted, err := s.secrets.Decrypt(ctx, decoded)
				if err != nil {
					s.logger.FromContext(ctx).Error("Failed to decrypt secret", "err", err)
					return nil, err
				}

				config[k] = string(decrypted)
			}
		}
	}

	return settings, nil
}

func (s *Service) isProviderConfigurable(provider string) bool {
	enabled, ok := s.configurableProviders[provider]
	return ok && enabled
}

// removeSecrets removes all the secrets from the map and replaces them with a redacted password
// and returns a new map
func removeSecrets(settings map[string]any) map[string]any {
	result := deepCopyMap(settings)
	configs := getConfigMaps(result)

	for _, config := range configs {
		for k, v := range config {
			val, ok := v.(string)
			if ok && val != "" && IsSecretField(k) {
				config[k] = setting.RedactedPassword
			}
		}
	}
	return result
}

// getConfigMaps returns a list of maps that may contain secrets
func getConfigMaps(settings map[string]any) []map[string]any {
	// always include the main settings map
	result := []map[string]any{settings}

	// for LDAP include settings for each server
	if config, ok := settings["config"].(map[string]any); ok {
		if servers, ok := config["servers"].([]any); ok {
			for _, server := range servers {
				if serverSettings, ok := server.(map[string]any); ok {
					result = append(result, serverSettings)
				}
			}
		}
	}

	return result
}

// mergeSettings merges two maps in a way that the values from the first map are preserved
// and the values from the second map are added only if they don't exist in the first map
// or if they contain empty URLs.
func mergeSettings(storedSettings, systemSettings map[string]any) map[string]any {
	settings := make(map[string]any)

	for k, v := range storedSettings {
		settings[k] = v
	}

	for k, v := range systemSettings {
		if _, ok := settings[k]; !ok {
			if isMergingAllowed(k) {
				settings[k] = v
			}
		} else if isURL(k) && isEmptyString(settings[k]) {
			// Overwrite all URL settings from the DB containing an empty string with their value
			// from the system settings. This fixes an issue with empty auth_url, api_url and token_url
			// from the DB not being replaced with their values defined in the system settings for
			// the Google provider.
			settings[k] = v
		}
	}

	return settings
}

// isMergingAllowed returns true if the field provided can be merged from the system settings.
// It won't allow SAML fields that are part of a group of settings to be merged from system settings
// because the DB settings already contain one valid setting from each group.
func isMergingAllowed(fieldName string) bool {
	forbiddenMergePatterns := []string{"certificate", "private_key", "idp_metadata"}

	for _, v := range forbiddenMergePatterns {
		if strings.Contains(strings.ToLower(fieldName), strings.ToLower(v)) {
			return false
		}
	}
	return true
}

// mergeSecrets returns a new map with the current value for secrets that have not been updated
func mergeSecrets(settings map[string]any, storedSettings map[string]any) (map[string]any, error) {
	settingsWithSecrets := deepCopyMap(settings)
	newConfigs := getConfigMaps(settingsWithSecrets)
	storedConfigs := getConfigMaps(storedSettings)

	for i, config := range newConfigs {
		for k, v := range config {
			if IsSecretField(k) {
				strValue, ok := v.(string)
				if !ok {
					return nil, fmt.Errorf("secret value is not a string")
				}

				if !isNewSecretValue(strValue) && len(storedConfigs) > i {
					config[k] = storedConfigs[i][k] // use the currently stored value
				}
			}
		}
	}

	return settingsWithSecrets, nil
}

func overrideMaps(maps ...map[string]any) map[string]any {
	result := make(map[string]any)
	for _, m := range maps {
		for k, v := range m {
			result[k] = v
		}
	}
	return result
}

// IsSecretField returns true if the SSO settings field provided is a secret
func IsSecretField(fieldName string) bool {
	secretFieldPatterns := []string{"secret", "private", "certificate", "password", "client_key"}

	for _, v := range secretFieldPatterns {
		if strings.Contains(strings.ToLower(fieldName), strings.ToLower(v)) {
			return true
		}
	}
	return false
}

func isURL(fieldName string) bool {
	return strings.HasSuffix(fieldName, "_url")
}

func isEmptyString(val any) bool {
	_, ok := val.(string)
	return ok && val == ""
}

func isNewSecretValue(value string) bool {
	return value != setting.RedactedPassword
}

func deepCopyMap(settings map[string]any) map[string]any {
	newSettings := make(map[string]any)

	for key, value := range settings {
		switch v := value.(type) {
		case map[string]any:
			newSettings[key] = deepCopyMap(v)
		case []any:
			newSettings[key] = deepCopySlice(v)
		default:
			newSettings[key] = value
		}
	}

	return newSettings
}

func deepCopySlice(s []any) []any {
	newSlice := make([]any, len(s))

	for i, value := range s {
		switch v := value.(type) {
		case map[string]any:
			newSlice[i] = deepCopyMap(v)
		case []any:
			newSlice[i] = deepCopySlice(v)
		default:
			newSlice[i] = value
		}
	}

	return newSlice
}

func (s *Service) setCachedSSOSettings(settings []*models.SSOSettings) {
	s.cacheMutex.Lock()
	defer s.cacheMutex.Unlock()

	s.cachedSSOSettings = settings
}

func (s *Service) updateCachedSSOSettings(provider string, settings *models.SSOSettings) {
	s.cacheMutex.Lock()
	defer s.cacheMutex.Unlock()

	for i := range s.cachedSSOSettings {
		if s.cachedSSOSettings[i].Provider == provider {
			s.cachedSSOSettings[i] = settings
			return
		}
	}

	// Provider not found, append new settings
	s.cachedSSOSettings = append(s.cachedSSOSettings, settings)
}
