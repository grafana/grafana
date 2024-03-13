package ssosettingsimpl

import (
	"context"
	"encoding/base64"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/grafana/grafana/pkg/api/routing"
	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/usagestats"
	ac "github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/auth/identity"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/secrets"
	"github.com/grafana/grafana/pkg/services/ssosettings"
	"github.com/grafana/grafana/pkg/services/ssosettings/api"
	"github.com/grafana/grafana/pkg/services/ssosettings/database"
	"github.com/grafana/grafana/pkg/services/ssosettings/models"
	"github.com/grafana/grafana/pkg/services/ssosettings/strategies"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/prometheus/client_golang/prometheus"
)

var _ ssosettings.Service = (*Service)(nil)

type Service struct {
	logger  log.Logger
	cfg     *setting.Cfg
	store   ssosettings.Store
	ac      ac.AccessControl
	secrets secrets.Service
	metrics *metrics

	fbStrategies []ssosettings.FallbackStrategy
	reloadables  map[string]ssosettings.Reloadable
}

func ProvideService(cfg *setting.Cfg, sqlStore db.DB, ac ac.AccessControl,
	routeRegister routing.RouteRegister, features featuremgmt.FeatureToggles,
	secrets secrets.Service, usageStats usagestats.Service, registerer prometheus.Registerer) *Service {
	strategies := []ssosettings.FallbackStrategy{
		strategies.NewOAuthStrategy(cfg),
		// register other strategies here, for example SAML
	}

	store := database.ProvideStore(sqlStore)

	svc := &Service{
		logger:       log.New("ssosettings.service"),
		cfg:          cfg,
		store:        store,
		ac:           ac,
		fbStrategies: strategies,
		secrets:      secrets,
		metrics:      newMetrics(registerer),
		reloadables:  make(map[string]ssosettings.Reloadable),
	}

	usageStats.RegisterMetricsFunc(svc.getUsageStats)

	if features.IsEnabledGlobally(featuremgmt.FlagSsoSettingsApi) {
		ssoSettingsApi := api.ProvideApi(svc, routeRegister, ac)
		ssoSettingsApi.RegisterAPIEndpoints()
	}

	return svc
}

var _ ssosettings.Service = (*Service)(nil)

func (s *Service) GetForProvider(ctx context.Context, provider string) (*models.SSOSettings, error) {
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

	systemSettings, err := s.loadSettingsUsingFallbackStrategy(ctx, provider)
	if err != nil {
		return nil, err
	}

	return s.mergeSSOSettings(dbSettings, systemSettings), nil
}

func (s *Service) GetForProviderWithRedactedSecrets(ctx context.Context, provider string) (*models.SSOSettings, error) {
	if !s.isProviderConfigurable(provider) {
		return nil, ssosettings.ErrNotConfigurable
	}

	storeSettings, err := s.GetForProvider(ctx, provider)
	if err != nil {
		return nil, err
	}

	for k, v := range storeSettings.Settings {
		if strVal, ok := v.(string); ok {
			storeSettings.Settings[k] = setting.RedactedValue(k, strVal)
		}
	}

	return storeSettings, nil
}

func (s *Service) List(ctx context.Context) ([]*models.SSOSettings, error) {
	result := make([]*models.SSOSettings, 0, len(ssosettings.AllOAuthProviders))
	storedSettings, err := s.store.List(ctx)

	if err != nil {
		return nil, err
	}

	for _, provider := range ssosettings.AllOAuthProviders {
		dbSettings := getSettingByProvider(provider, storedSettings)
		if dbSettings != nil {
			// Settings are coming from the database thus secrets are encrypted
			dbSettings.Settings, err = s.decryptSecrets(ctx, dbSettings.Settings)
			if err != nil {
				return nil, err
			}
		}
		fallbackSettings, err := s.loadSettingsUsingFallbackStrategy(ctx, provider)
		if err != nil {
			return nil, err
		}

		result = append(result, s.mergeSSOSettings(dbSettings, fallbackSettings))
	}

	return result, nil
}

func (s *Service) ListWithRedactedSecrets(ctx context.Context) ([]*models.SSOSettings, error) {
	storeSettings, err := s.List(ctx)
	if err != nil {
		return nil, err
	}

	configurableSettings := make([]*models.SSOSettings, 0, len(s.cfg.SSOSettingsConfigurableProviders))
	for _, provider := range storeSettings {
		if s.isProviderConfigurable(provider.Provider) {
			configurableSettings = append(configurableSettings, provider)
		}
	}

	for _, storeSetting := range configurableSettings {
		for k, v := range storeSetting.Settings {
			if strVal, ok := v.(string); ok {
				storeSetting.Settings[k] = setting.RedactedValue(k, strVal)
			}
		}
	}

	return configurableSettings, nil
}

func (s *Service) Upsert(ctx context.Context, settings *models.SSOSettings, requester identity.Requester) error {
	if !s.isProviderConfigurable(settings.Provider) {
		return ssosettings.ErrNotConfigurable
	}

	social, ok := s.reloadables[settings.Provider]
	if !ok {
		return ssosettings.ErrInvalidProvider.Errorf("provider %s not found in reloadables", settings.Provider)
	}

	err := social.Validate(ctx, *settings, requester)
	if err != nil {
		return err
	}

	storedSettings, err := s.GetForProvider(ctx, settings.Provider)
	if err != nil {
		return err
	}

	secrets := collectSecrets(settings, storedSettings)

	settings.Settings, err = s.encryptSecrets(ctx, settings.Settings, storedSettings.Settings)
	if err != nil {
		return err
	}

	err = s.store.Upsert(ctx, settings)
	if err != nil {
		return err
	}

	// make a copy of current settings for reload operation and apply overrides
	reloadSettings := *settings
	reloadSettings.Settings = overrideMaps(storedSettings.Settings, settings.Settings, secrets)

	go s.reload(social, settings.Provider, reloadSettings)

	return nil
}

func (s *Service) Patch(ctx context.Context, provider string, data map[string]any) error {
	panic("not implemented") // TODO: Implement
}

func (s *Service) Delete(ctx context.Context, provider string) error {
	if !s.isProviderConfigurable(provider) {
		return ssosettings.ErrNotConfigurable
	}

	social, ok := s.reloadables[provider]
	if !ok {
		return ssosettings.ErrInvalidProvider.Errorf("provider %s not found in reloadables", provider)
	}

	err := s.store.Delete(ctx, provider)
	if err != nil {
		return err
	}

	currentSettings, err := s.GetForProvider(ctx, provider)
	if err != nil {
		s.logger.Error("failed to get current settings, skipping reload", "provider", provider, "error", err)
		return nil
	}

	go s.reload(social, provider, *currentSettings)

	return nil
}

func (s *Service) reload(reloadable ssosettings.Reloadable, provider string, currentSettings models.SSOSettings) {
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

func (s *Service) loadSettingsUsingFallbackStrategy(ctx context.Context, provider string) (*models.SSOSettings, error) {
	loadStrategy, ok := s.getFallbackStrategyFor(provider)
	if !ok {
		return nil, errors.New("no fallback strategy found for provider: " + provider)
	}

	settingsFromSystem, err := loadStrategy.GetProviderConfig(ctx, provider)
	if err != nil {
		return nil, err
	}

	return &models.SSOSettings{
		Provider: provider,
		Source:   models.System,
		Settings: settingsFromSystem,
	}, nil
}

func getSettingByProvider(provider string, settings []*models.SSOSettings) *models.SSOSettings {
	for _, item := range settings {
		if item.Provider == provider {
			return item
		}
	}
	return nil
}

func (s *Service) getFallbackStrategyFor(provider string) (ssosettings.FallbackStrategy, bool) {
	for _, strategy := range s.fbStrategies {
		if strategy.IsMatch(provider) {
			return strategy, true
		}
	}
	return nil, false
}

func (s *Service) encryptSecrets(ctx context.Context, settings, storedSettings map[string]any) (map[string]any, error) {
	result := make(map[string]any)
	for k, v := range settings {
		if isSecret(k) && v != "" {
			strValue, ok := v.(string)
			if !ok {
				return result, fmt.Errorf("failed to encrypt %s setting because it is not a string: %v", k, v)
			}

			if !isNewSecretValue(strValue) {
				strValue = storedSettings[k].(string)
			}

			encryptedSecret, err := s.secrets.Encrypt(ctx, []byte(strValue), secrets.WithoutScope())
			if err != nil {
				return result, err
			}
			result[k] = base64.RawStdEncoding.EncodeToString(encryptedSecret)
		} else {
			result[k] = v
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
		setting := getSettingByProvider(provider, settingsList)

		err = connector.Reload(ctx, *setting)
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

func (s *Service) decryptSecrets(ctx context.Context, settings map[string]any) (map[string]any, error) {
	for k, v := range settings {
		if isSecret(k) && v != "" {
			strValue, ok := v.(string)
			if !ok {
				s.logger.Error("Failed to parse secret value, it is not a string", "key", k)
				return nil, fmt.Errorf("secret value is not a string")
			}

			decoded, err := base64.RawStdEncoding.DecodeString(strValue)
			if err != nil {
				s.logger.Error("Failed to decode secret string", "err", err, "value")
				return nil, err
			}

			decrypted, err := s.secrets.Decrypt(ctx, decoded)
			if err != nil {
				s.logger.Error("Failed to decrypt secret", "err", err)
				return nil, err
			}

			settings[k] = string(decrypted)
		}
	}
	return settings, nil
}

func (s *Service) isProviderConfigurable(provider string) bool {
	_, ok := s.cfg.SSOSettingsConfigurableProviders[provider]
	return ok
}

// removeSecrets removes all the secrets from the map and replaces them with a redacted password
// and returns a new map
func removeSecrets(settings map[string]any) map[string]any {
	result := make(map[string]any)
	for k, v := range settings {
		if isSecret(k) {
			result[k] = setting.RedactedPassword
			continue
		}
		result[k] = v
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
			settings[k] = v
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

// collectSecrets collects all the secrets from the request and the currently stored settings
// and returns a new map
func collectSecrets(settings *models.SSOSettings, storedSettings *models.SSOSettings) map[string]any {
	secrets := map[string]any{}
	for k, v := range settings.Settings {
		if isSecret(k) {
			if isNewSecretValue(v.(string)) {
				secrets[k] = v.(string) // use the new value
				continue
			}
			secrets[k] = storedSettings.Settings[k] // keep the currently stored value
		}
	}
	return secrets
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

func isSecret(fieldName string) bool {
	secretFieldPatterns := []string{"secret"}

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
