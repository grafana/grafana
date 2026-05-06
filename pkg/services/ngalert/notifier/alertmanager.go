package notifier

import (
	"context"
	"encoding/json"
	"fmt"
	"strconv"
	"time"

	alertingNotify "github.com/grafana/alerting/notify"
	"github.com/grafana/alerting/notify/nfstatus"
	alertingTemplates "github.com/grafana/alerting/templates"

	amv2 "github.com/prometheus/alertmanager/api/v2/models"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	apimodels "github.com/grafana/grafana/pkg/services/ngalert/api/tooling/definitions"
	"github.com/grafana/grafana/pkg/services/ngalert/metrics"
	"github.com/grafana/grafana/pkg/services/ngalert/store"
	"github.com/grafana/grafana/pkg/services/notifications"
	"github.com/grafana/grafana/pkg/setting"
)

const (
	// How often we flush and garbage collect notifications and silences.
	maintenanceInterval = 15 * time.Minute

	// How long we keep silences in the kvstore after they've expired.
	silenceRetention = 5 * 24 * time.Hour

	// How long we keep flushes in the kvstore after they've expired.
	flushRetention = 5 * 24 * time.Hour
)

type AlertingStore interface {
	store.AlertingStore
	store.ImageStore
	autogenRuleStore
}

type stateStore interface {
	SaveSilences(ctx context.Context, st alertingNotify.State) (int64, error)
	SaveNotificationLog(ctx context.Context, st alertingNotify.State) (int64, error)
	SaveFlushLog(ctx context.Context, st alertingNotify.State) (int64, error)
	GetSilences(ctx context.Context) (string, error)
	GetNotificationLog(ctx context.Context) (string, error)
	GetFlushLog(ctx context.Context) (string, error)
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
	features             featuremgmt.FeatureToggles
	dynamicLimits        alertingNotify.DynamicLimits

	// We store the applied hash here instead of relying on Base's ConfigHash() to work around a bug where Base can
	// modify the configuration during ApplyConfig. This causes the change detection to fail in niche cases.
	appliedHash alertingNotify.ConfigFingerprint
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
	flushLog, err := stateStore.GetFlushLog(ctx)
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

	dispatchTimer := GetDispatchTimer(featureToggles)

	var flushLogOptions *maintenanceOptions
	if dispatchTimer == alertingNotify.DispatchTimerSync {
		flushLogOptions = &maintenanceOptions{
			initialState:         flushLog,
			retention:            flushRetention,
			maintenanceFrequency: maintenanceInterval,
			maintenanceFunc: func(state alertingNotify.State) (int64, error) {
				// Detached context here is to make sure that when the service is shut down the persist operation is executed.
				return stateStore.SaveFlushLog(context.Background(), state)
			},
		}
	}

	opts := alertingNotify.GrafanaAlertmanagerOpts{
		ExternalURL:        cfg.AppURL,
		AlertStoreCallback: nil,
		PeerTimeout:        cfg.UnifiedAlerting.HAPeerTimeout,
		Silences:           silencesOptions,
		Nflog:              nflogOptions,
		FlushLog:           flushLogOptions,
		DispatchTimer:      dispatchTimer,
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
		//nolint:staticcheck // not yet migrated to OpenFeature
		BuildWithManifestBuilder: !featureToggles.IsEnabledGlobally(featuremgmt.FlagAlertingDisableV0ReceiverConversion),
	}

	gam, err := alertingNotify.NewGrafanaAlertmanager(opts)
	if err != nil {
		return nil, err
	}

	limits := alertingNotify.DynamicLimits{
		Dispatcher: nilLimits{},
		Templates: alertingTemplates.Limits{
			MaxTemplateOutputSize: cfg.UnifiedAlerting.AlertmanagerMaxTemplateOutputSize,
		},
	}
	if err := limits.Templates.Validate(); err != nil {
		return nil, fmt.Errorf("invalid template limits: %w", err)
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
		features:             featureToggles,
		dynamicLimits:        limits,
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

// ApplyConfig applies the configuration to the Alertmanager.
func (am *alertmanager) ApplyConfig(_ context.Context, cfg alertingNotify.NotificationsConfiguration) (bool, error) {
	var configChanged bool
	var outerErr error
	am.Base.WithLock(func() {
		configChanged, outerErr = am.applyConfig(cfg)
	})
	return configChanged, outerErr
}

type AggregateMatchersUsage struct {
	Matchers       int
	MatchRE        int
	Match          int
	ObjectMatchers int
}

func (am *alertmanager) updateConfigMetrics(cfg alertingNotify.NotificationsConfiguration) {
	var amu AggregateMatchersUsage
	am.aggregateRouteMatchers(cfg.RoutingTree, &amu)
	am.aggregateInhibitMatchers(cfg.InhibitRules, &amu)
	am.ConfigMetrics.Matchers.Set(float64(amu.Matchers))
	am.ConfigMetrics.MatchRE.Set(float64(amu.MatchRE))
	am.ConfigMetrics.Match.Set(float64(amu.Match))
	am.ConfigMetrics.ObjectMatchers.Set(float64(amu.ObjectMatchers))

	am.ConfigMetrics.ConfigHash.
		WithLabelValues(strconv.FormatInt(am.Base.TenantID(), 10)).
		Set(hashAsMetricValue(am.appliedHash))

	if rawCfg, err := json.Marshal(cfg); err == nil {
		am.ConfigMetrics.ConfigSizeBytes.
			WithLabelValues(strconv.FormatInt(am.Base.TenantID(), 10)).
			Set(float64(len(rawCfg)))
	} else {
		am.logger.Error("Failed to update config size metric", "configHash", am.appliedHash.String(), "error", err)
	}
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

func (am *alertmanager) aggregateInhibitMatchers(rules []apimodels.InhibitRule, amu *AggregateMatchersUsage) {
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
func (am *alertmanager) applyConfig(cfg alertingNotify.NotificationsConfiguration) (bool, error) {
	// If configuration hasn't changed, we've got nothing to do.
	configHash := alertingNotify.CalculateConfigFingerprint(cfg)
	if am.appliedHash == configHash {
		am.logger.Debug("Config hasn't changed, skipping configuration sync.")
		return false, nil
	}

	am.logger.Info("Applying new configuration to Alertmanager", "configHash", fmt.Sprintf("%d", configHash))
	err := am.Base.ApplyConfig(cfg)
	if err != nil {
		return false, fmt.Errorf("unable to apply configuration: %w", err)
	}
	am.appliedHash = configHash

	am.updateConfigMetrics(cfg)
	return true, nil
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

const mask53 = (1 << 53) - 1

func hashAsMetricValue(data alertingNotify.ConfigFingerprint) float64 {
	// Prometheus stores metric values as float64, which can exactly represent integers only up to 2^53−1.
	// Directly casting the hash is probably fine here as well, since we don't really care about magnitudes or rates.
	return float64(data.Overall & mask53)
}
