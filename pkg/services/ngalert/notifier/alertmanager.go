package notifier

import (
	"context"
	"crypto/md5"
	"encoding/binary"
	"encoding/json"
	"fmt"
	"strconv"
	"time"

	alertingNotify "github.com/grafana/alerting/notify"
	"github.com/grafana/alerting/notify/nfstatus"
	"github.com/prometheus/alertmanager/config"

	amv2 "github.com/prometheus/alertmanager/api/v2/models"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	apimodels "github.com/grafana/grafana/pkg/services/ngalert/api/tooling/definitions"
	"github.com/grafana/grafana/pkg/services/ngalert/metrics"
	ngmodels "github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/services/ngalert/store"
	"github.com/grafana/grafana/pkg/services/notifications"
	"github.com/grafana/grafana/pkg/setting"
)

const (
	// How often we flush and garbage collect notifications and silences.
	maintenanceInterval = 15 * time.Minute

	// How long we keep silences in the kvstore after they've expired.
	silenceRetention = 5 * 24 * time.Hour
)

type AlertingStore interface {
	store.AlertingStore
	store.ImageStore
	autogenRuleStore
}

type stateStore interface {
	SaveSilences(ctx context.Context, st alertingNotify.State) (int64, error)
	SaveNotificationLog(ctx context.Context, st alertingNotify.State) (int64, error)
	GetSilences(ctx context.Context) (string, error)
	GetNotificationLog(ctx context.Context) (string, error)
}

type alertmanager struct {
	Base   *alertingNotify.GrafanaAlertmanager
	logger log.Logger

	ConfigMetrics        *metrics.AlertmanagerConfigMetrics
	Store                AlertingStore
	stateStore           stateStore
	DefaultConfiguration string
	decryptFn            alertingNotify.GetDecryptedValueFn
	crypto               Crypto
}

// maintenanceOptions represent the options for components that need maintenance on a frequency within the Alertmanager.
// It implements the alerting.MaintenanceOptions interface.
type maintenanceOptions struct {
	initialState         string
	retention            time.Duration
	maintenanceFrequency time.Duration
	maintenanceFunc      func(alertingNotify.State) (int64, error)
}

var _ alertingNotify.MaintenanceOptions = maintenanceOptions{}

func (m maintenanceOptions) InitialState() string {
	return m.initialState
}

func (m maintenanceOptions) Retention() time.Duration {
	return m.retention
}

func (m maintenanceOptions) MaintenanceFrequency() time.Duration {
	return m.maintenanceFrequency
}

func (m maintenanceOptions) MaintenanceFunc(state alertingNotify.State) (int64, error) {
	return m.maintenanceFunc(state)
}

func NewAlertmanager(ctx context.Context, orgID int64, cfg *setting.Cfg, store AlertingStore, stateStore stateStore,
	peer alertingNotify.ClusterPeer, decryptFn alertingNotify.GetDecryptedValueFn, ns notifications.Service,
	m *metrics.Alertmanager, featureToggles featuremgmt.FeatureToggles, crypto Crypto, notificationHistorian nfstatus.NotificationHistorian,
) (*alertmanager, error) {
	nflog, err := stateStore.GetNotificationLog(ctx)
	if err != nil {
		return nil, err
	}
	silences, err := stateStore.GetSilences(ctx)
	if err != nil {
		return nil, err
	}

	silencesOptions := maintenanceOptions{
		initialState:         silences,
		retention:            silenceRetention,
		maintenanceFrequency: maintenanceInterval,
		maintenanceFunc: func(state alertingNotify.State) (int64, error) {
			// Detached context here is to make sure that when the service is shut down the persist operation is executed.
			return stateStore.SaveSilences(context.Background(), state)
		},
	}

	nflogOptions := maintenanceOptions{
		initialState:         nflog,
		retention:            cfg.UnifiedAlerting.NotificationLogRetention,
		maintenanceFrequency: maintenanceInterval,
		maintenanceFunc: func(state alertingNotify.State) (int64, error) {
			// Detached context here is to make sure that when the service is shut down the persist operation is executed.
			return stateStore.SaveNotificationLog(context.Background(), state)
		},
	}
	l := log.New("ngalert.notifier")

	opts := alertingNotify.GrafanaAlertmanagerOpts{
		ExternalURL:        cfg.AppURL,
		AlertStoreCallback: nil,
		PeerTimeout:        cfg.UnifiedAlerting.HAPeerTimeout,
		Silences:           silencesOptions,
		Nflog:              nflogOptions,
		Limits: alertingNotify.Limits{
			MaxSilences:         cfg.UnifiedAlerting.AlertmanagerMaxSilencesCount,
			MaxSilenceSizeBytes: cfg.UnifiedAlerting.AlertmanagerMaxSilenceSizeBytes,
		},
		EmailSender:           &emailSender{ns},
		ImageProvider:         newImageProvider(store, l.New("component", "image-provider")),
		Decrypter:             decryptFn,
		Version:               setting.BuildVersion,
		TenantKey:             "orgID",
		TenantID:              orgID,
		Peer:                  peer,
		Logger:                l,
		Metrics:               alertingNotify.NewGrafanaAlertmanagerMetrics(m.Registerer, l),
		NotificationHistorian: notificationHistorian,
	}

	gam, err := alertingNotify.NewGrafanaAlertmanager(opts)
	if err != nil {
		return nil, err
	}

	am := &alertmanager{
		Base:                 gam,
		ConfigMetrics:        m.AlertmanagerConfigMetrics,
		DefaultConfiguration: cfg.UnifiedAlerting.DefaultConfiguration,
		Store:                store,
		stateStore:           stateStore,
		logger:               l.New("component", "alertmanager", opts.TenantKey, opts.TenantID), // similar to what the base does
		decryptFn:            decryptFn,
		crypto:               crypto,
	}

	return am, nil
}

func (am *alertmanager) Ready() bool {
	// We consider AM as ready only when the config has been
	// applied at least once successfully. Until then, some objects
	// can still be nil.
	return am.Base.Ready()
}

func (am *alertmanager) StopAndWait() {
	am.Base.StopAndWait()
}

// SaveAndApplyDefaultConfig saves the default configuration to the database and applies it to the Alertmanager.
// It rolls back the save if we fail to apply the configuration.
func (am *alertmanager) SaveAndApplyDefaultConfig(ctx context.Context) error {
	var outerErr error
	am.Base.WithLock(func() {
		cmd := &ngmodels.SaveAlertmanagerConfigurationCmd{
			AlertmanagerConfiguration: am.DefaultConfiguration,
			Default:                   true,
			ConfigurationVersion:      fmt.Sprintf("v%d", ngmodels.AlertConfigurationVersion),
			OrgID:                     am.Base.TenantID(),
			LastApplied:               time.Now().UTC().Unix(),
		}

		cfg, err := Load([]byte(am.DefaultConfiguration))
		if err != nil {
			outerErr = err
			return
		}

		err = am.Store.SaveAlertmanagerConfigurationWithCallback(ctx, cmd, func() error {
			_, err = am.applyConfig(ctx, cfg, true)
			return err
		})
		if err != nil {
			outerErr = err
			return
		}
	})

	return outerErr
}

// SaveAndApplyConfig saves the configuration the database and applies the configuration to the Alertmanager.
// It rollbacks the save if we fail to apply the configuration.
func (am *alertmanager) SaveAndApplyConfig(ctx context.Context, cfg *apimodels.PostableUserConfig) error {
	// Remove autogenerated config from the user config before saving it, may not be necessary as we already remove
	// the autogenerated config before provenance guard. However, this is low impact and a good safety net.
	RemoveAutogenConfigIfExists(cfg.AlertmanagerConfig.Route)

	err := am.crypto.EncryptExtraConfigs(ctx, cfg)
	if err != nil {
		return fmt.Errorf("failed to encrypt external configurations: %w", err)
	}

	cfgToSave, err := json.Marshal(&cfg)
	if err != nil {
		return fmt.Errorf("failed to serialize to the Alertmanager configuration: %w", err)
	}

	var outerErr error
	am.Base.WithLock(func() {
		cmd := &ngmodels.SaveAlertmanagerConfigurationCmd{
			AlertmanagerConfiguration: string(cfgToSave),
			ConfigurationVersion:      fmt.Sprintf("v%d", ngmodels.AlertConfigurationVersion),
			OrgID:                     am.Base.TenantID(),
			LastApplied:               time.Now().UTC().Unix(),
		}

		err = am.Store.SaveAlertmanagerConfigurationWithCallback(ctx, cmd, func() error {
			_, err = am.applyConfig(ctx, cfg, false) // fail if the autogen config is invalid
			return err
		})
		if err != nil {
			outerErr = err
			return
		}
	})

	return outerErr
}

// ApplyConfig applies the configuration to the Alertmanager.
func (am *alertmanager) ApplyConfig(ctx context.Context, dbCfg *ngmodels.AlertConfiguration) error {
	var err error
	cfg, err := Load([]byte(dbCfg.AlertmanagerConfiguration))
	if err != nil {
		return fmt.Errorf("failed to parse Alertmanager config: %w", err)
	}

	var outerErr error
	am.Base.WithLock(func() {
		// Note: Adding the autogen config here causes alert_configuration_history to update last_applied more often.
		// Since we will now update last_applied when autogen changes even if the user-created config remains the same.
		// To fix this however, the local alertmanager needs to be able to tell the difference between user-created and
		// autogen config, which may introduce cross-cutting complexity.
		configChanged, err := am.applyConfig(ctx, cfg, true)
		if err != nil {
			outerErr = fmt.Errorf("unable to apply configuration: %w", err)
			return
		}

		if !configChanged {
			return
		}
		markConfigCmd := ngmodels.MarkConfigurationAsAppliedCmd{
			OrgID:             am.Base.TenantID(),
			ConfigurationHash: dbCfg.ConfigurationHash,
		}
		err = am.Store.MarkConfigurationAsApplied(ctx, &markConfigCmd)
		if err != nil {
			outerErr = fmt.Errorf("unable to mark configuration as applied: %w", err)
		}
	})

	return outerErr
}

type AggregateMatchersUsage struct {
	Matchers       int
	MatchRE        int
	Match          int
	ObjectMatchers int
}

func (am *alertmanager) updateConfigMetrics(cfg *apimodels.PostableUserConfig, cfgSize int) {
	var amu AggregateMatchersUsage
	am.aggregateRouteMatchers(cfg.AlertmanagerConfig.Route, &amu)
	am.aggregateInhibitMatchers(cfg.AlertmanagerConfig.InhibitRules, &amu)
	am.ConfigMetrics.Matchers.Set(float64(amu.Matchers))
	am.ConfigMetrics.MatchRE.Set(float64(amu.MatchRE))
	am.ConfigMetrics.Match.Set(float64(amu.Match))
	am.ConfigMetrics.ObjectMatchers.Set(float64(amu.ObjectMatchers))

	am.ConfigMetrics.ConfigHash.
		WithLabelValues(strconv.FormatInt(am.Base.TenantID(), 10)).
		Set(hashAsMetricValue(am.Base.ConfigHash()))

	am.ConfigMetrics.ConfigSizeBytes.
		WithLabelValues(strconv.FormatInt(am.Base.TenantID(), 10)).
		Set(float64(cfgSize))
}

func (am *alertmanager) aggregateRouteMatchers(r *apimodels.Route, amu *AggregateMatchersUsage) {
	amu.Matchers += len(r.Matchers)
	amu.MatchRE += len(r.MatchRE)
	amu.Match += len(r.Match)
	amu.ObjectMatchers += len(r.ObjectMatchers)
	for _, next := range r.Routes {
		am.aggregateRouteMatchers(next, amu)
	}
}

func (am *alertmanager) aggregateInhibitMatchers(rules []config.InhibitRule, amu *AggregateMatchersUsage) {
	for _, r := range rules {
		amu.Matchers += len(r.SourceMatchers)
		amu.Matchers += len(r.TargetMatchers)
		amu.MatchRE += len(r.SourceMatchRE)
		amu.MatchRE += len(r.TargetMatchRE)
		amu.Match += len(r.SourceMatch)
		amu.Match += len(r.TargetMatch)
	}
}

// applyConfig applies a new configuration by re-initializing all components using the configuration provided.
// It returns a boolean indicating whether the user config was changed and an error.
// It is not safe to call concurrently.
func (am *alertmanager) applyConfig(ctx context.Context, cfg *apimodels.PostableUserConfig, skipInvalid bool) (bool, error) {
	err := am.crypto.DecryptExtraConfigs(ctx, cfg)
	if err != nil {
		return false, fmt.Errorf("failed to decrypt external configurations: %w", err)
	}

	mergeResult, err := cfg.GetMergedAlertmanagerConfig()
	if err != nil {
		return false, fmt.Errorf("failed to get full alertmanager configuration: %w", err)
	}
	if logInfo := mergeResult.LogContext(); len(logInfo) > 0 {
		am.logger.Info("Configurations merged successfully but some resources were renamed", logInfo...)
	}
	amConfig := mergeResult.Config
	templates := alertingNotify.PostableAPITemplatesToTemplateDefinitions(cfg.GetMergedTemplateDefinitions())

	// Now add autogenerated config to the route.
	err = AddAutogenConfig(ctx, am.logger, am.Store, am.Base.TenantID(), &amConfig, skipInvalid)
	if err != nil {
		return false, err
	}

	// First, let's make sure this config is not already loaded
	rawConfig, err := json.Marshal(cfg)
	if err != nil {
		// In theory, this should never happen.
		return false, err
	}

	// If configuration hasn't changed, we've got nothing to do.
	configHash := md5.Sum(rawConfig)
	if am.Base.ConfigHash() == configHash {
		am.logger.Debug("Config hasn't changed, skipping configuration sync.")
		return false, nil
	}

	receivers := PostableApiAlertingConfigToApiReceivers(amConfig)
	for _, recv := range receivers {
		err = patchNewSecureFields(ctx, recv, alertingNotify.DecodeSecretsFromBase64, am.decryptFn)
		if err != nil {
			return false, err
		}
	}

	am.logger.Info("Applying new configuration to Alertmanager", "configHash", fmt.Sprintf("%x", configHash))
	err = am.Base.ApplyConfig(alertingNotify.NotificationsConfiguration{
		RoutingTree:       amConfig.Route.AsAMRoute(),
		InhibitRules:      amConfig.InhibitRules,
		MuteTimeIntervals: amConfig.MuteTimeIntervals,
		TimeIntervals:     amConfig.TimeIntervals,
		Templates:         templates,
		Receivers:         receivers,
		DispatcherLimits:  &nilLimits{},
		Raw:               rawConfig,
		Hash:              configHash,
	})
	if err != nil {
		return false, err
	}

	am.updateConfigMetrics(cfg, len(rawConfig))
	return true, nil
}

func patchNewSecureFields(ctx context.Context, api *alertingNotify.APIReceiver, decode alertingNotify.DecodeSecretsFn, decrypt alertingNotify.GetDecryptedValueFn) error {
	for _, integration := range api.Integrations {
		switch integration.Type {
		case "dingding":
			err := patchSettingsFromSecureSettings(ctx, integration, "url", decode, decrypt)
			if err != nil {
				return err
			}
		}
	}
	return nil
}

func patchSettingsFromSecureSettings(ctx context.Context, integration *alertingNotify.GrafanaIntegrationConfig, key string, decode alertingNotify.DecodeSecretsFn, decrypt alertingNotify.GetDecryptedValueFn) error {
	if _, ok := integration.SecureSettings[key]; !ok {
		return nil
	}
	decoded, err := decode(integration.SecureSettings)
	if err != nil {
		return err
	}
	settings := map[string]any{}
	err = json.Unmarshal(integration.Settings, &settings)
	if err != nil {
		return err
	}
	currentValue, ok := settings[key]
	currentString := ""
	if ok {
		currentString, _ = currentValue.(string)
	}
	secretValue := decrypt(ctx, decoded, key, currentString)
	if secretValue == currentString {
		return nil
	}
	settings[key] = secretValue
	data, err := json.Marshal(settings)
	if err != nil {
		return err
	}
	integration.Settings = data
	return nil
}

// PutAlerts receives the alerts and then sends them through the corresponding route based on whenever the alert has a receiver embedded or not
func (am *alertmanager) PutAlerts(_ context.Context, postableAlerts apimodels.PostableAlerts) error {
	alerts := make(alertingNotify.PostableAlerts, 0, len(postableAlerts.PostableAlerts))
	for _, pa := range postableAlerts.PostableAlerts {
		alerts = append(alerts, &alertingNotify.PostableAlert{
			Annotations: pa.Annotations,
			EndsAt:      pa.EndsAt,
			StartsAt:    pa.StartsAt,
			Alert:       pa.Alert,
		})
	}

	return am.Base.PutAlerts(alerts)
}

// SilenceState returns the current internal state of silences.
func (am *alertmanager) SilenceState(_ context.Context) (alertingNotify.SilenceState, error) {
	return am.Base.SilenceState()
}

// AlertValidationError is the error capturing the validation errors
// faced on the alerts.
type AlertValidationError struct {
	Alerts []amv2.PostableAlert
	Errors []error // Errors[i] refers to Alerts[i].
}

func (e AlertValidationError) Error() string {
	errMsg := ""
	if len(e.Errors) != 0 {
		errMsg = e.Errors[0].Error()
		for _, e := range e.Errors[1:] {
			errMsg += ";" + e.Error()
		}
	}
	return errMsg
}

type nilLimits struct{}

func (n nilLimits) MaxNumberOfAggregationGroups() int { return 0 }

// This function is taken from upstream, modified to take a [16]byte instead of a []byte.
// https://github.com/prometheus/alertmanager/blob/30fa9cd44bc91c0d6adcc9985609bb08a09a127b/config/coordinator.go#L149-L156
func hashAsMetricValue(data [16]byte) float64 {
	// We only want 48 bits as a float64 only has a 53 bit mantissa.
	smallSum := data[0:6]
	bytes := make([]byte, 8)
	copy(bytes, smallSum)
	return float64(binary.LittleEndian.Uint64(bytes))
}
