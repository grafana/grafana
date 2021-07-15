package notifier

import (
	"context"
	"crypto/md5"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"net/url"
	"path/filepath"
	"sync"
	"time"

	gokit_log "github.com/go-kit/kit/log"
	amv2 "github.com/prometheus/alertmanager/api/v2/models"
	"github.com/prometheus/alertmanager/dispatch"
	"github.com/prometheus/alertmanager/inhibit"
	"github.com/prometheus/alertmanager/nflog"
	"github.com/prometheus/alertmanager/nflog/nflogpb"
	"github.com/prometheus/alertmanager/notify"
	"github.com/prometheus/alertmanager/provider/mem"
	"github.com/prometheus/alertmanager/silence"
	"github.com/prometheus/alertmanager/template"
	"github.com/prometheus/alertmanager/types"
	"github.com/prometheus/common/model"

	"github.com/grafana/grafana/pkg/components/securejsondata"
	"github.com/grafana/grafana/pkg/infra/log"
	apimodels "github.com/grafana/grafana/pkg/services/ngalert/api/tooling/definitions"
	"github.com/grafana/grafana/pkg/services/ngalert/logging"
	"github.com/grafana/grafana/pkg/services/ngalert/metrics"
	ngmodels "github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/services/ngalert/notifier/channels"
	"github.com/grafana/grafana/pkg/services/ngalert/store"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/setting"
)

const (
	pollInterval = 1 * time.Minute
	workingDir   = "alerting"
	// How long should we keep silences and notification entries on-disk after they've served their purpose.
	retentionNotificationsAndSilences = 5 * 24 * time.Hour
	// maintenanceNotificationAndSilences how often should we flush and gargabe collect notifications and silences
	maintenanceNotificationAndSilences = 15 * time.Minute
	// defaultResolveTimeout is the default timeout used for resolving an alert
	// if the end time is not specified.
	defaultResolveTimeout = 5 * time.Minute
	// memoryAlertsGCInterval is the interval at which we'll remove resolved alerts from memory.
	memoryAlertsGCInterval = 30 * time.Minute
	// To start, the alertmanager needs at least one route defined.
	// TODO: we should move this to Grafana settings and define this as the default.
	alertmanagerDefaultConfiguration = `
{
	"alertmanager_config": {
		"route": {
			"receiver": "grafana-default-email"
		},
		"receivers": [{
			"name": "grafana-default-email",
			"grafana_managed_receiver_configs": [{
				"uid": "",
				"name": "email receiver",
				"type": "email",
				"isDefault": true,
				"settings": {
					"addresses": "<example@email.com>"
				}
			}]
		}]
	}
}
`
)

type Alertmanager struct {
	logger      log.Logger
	gokitLogger gokit_log.Logger

	Settings *setting.Cfg       `inject:""`
	SQLStore *sqlstore.SQLStore `inject:""`
	Store    store.AlertingStore
	Metrics  *metrics.Metrics `inject:""`

	notificationLog *nflog.Log
	marker          types.Marker
	alerts          *mem.Alerts
	route           *dispatch.Route

	dispatcher *dispatch.Dispatcher
	inhibitor  *inhibit.Inhibitor
	// wg is for dispatcher, inhibitor, silences and notifications
	// Across configuration changes dispatcher and inhibitor are completely replaced, however, silences, notification log and alerts remain the same.
	// stopc is used to let silences and notifications know we are done.
	wg    sync.WaitGroup
	stopc chan struct{}

	silencer *silence.Silencer
	silences *silence.Silences

	stageMetrics      *notify.Metrics
	dispatcherMetrics *dispatch.DispatcherMetrics

	reloadConfigMtx sync.RWMutex
	config          []byte
}

func New(cfg *setting.Cfg, store store.AlertingStore, m *metrics.Metrics) (*Alertmanager, error) {
	am := &Alertmanager{
		Settings:          cfg,
		stopc:             make(chan struct{}),
		logger:            log.New("alertmanager"),
		marker:            types.NewMarker(m.Registerer),
		stageMetrics:      notify.NewMetrics(m.Registerer),
		dispatcherMetrics: dispatch.NewDispatcherMetrics(m.Registerer),
		Store:             store,
		Metrics:           m,
	}

	am.gokitLogger = gokit_log.NewLogfmtLogger(logging.NewWrapper(am.logger))

	// Initialize the notification log
	am.wg.Add(1)
	var err error
	am.notificationLog, err = nflog.New(
		nflog.WithRetention(retentionNotificationsAndSilences),
		nflog.WithSnapshot(filepath.Join(am.WorkingDirPath(), "notifications")),
		nflog.WithMaintenance(maintenanceNotificationAndSilences, am.stopc, am.wg.Done),
	)
	if err != nil {
		return nil, fmt.Errorf("unable to initialize the notification log component of alerting: %w", err)
	}
	// Initialize silences
	am.silences, err = silence.New(silence.Options{
		Metrics:      m.Registerer,
		SnapshotFile: filepath.Join(am.WorkingDirPath(), "silences"),
		Retention:    retentionNotificationsAndSilences,
	})
	if err != nil {
		return nil, fmt.Errorf("unable to initialize the silencing component of alerting: %w", err)
	}

	am.wg.Add(1)
	go func() {
		am.silences.Maintenance(15*time.Minute, filepath.Join(am.WorkingDirPath(), "silences"), am.stopc)
		am.wg.Done()
	}()

	// Initialize in-memory alerts
	am.alerts, err = mem.NewAlerts(context.Background(), am.marker, memoryAlertsGCInterval, am.gokitLogger)
	if err != nil {
		return nil, fmt.Errorf("unable to initialize the alert provider component of alerting: %w", err)
	}

	return am, nil
}

func (am *Alertmanager) Ready() bool {
	// We consider AM as ready only when the config has been
	// applied at least once successfully. Until then, some objects
	// can still be nil.
	am.reloadConfigMtx.RLock()
	defer am.reloadConfigMtx.RUnlock()

	return len(am.config) > 0
}

func (am *Alertmanager) Run(ctx context.Context) error {
	// Make sure dispatcher starts. We can tolerate future reload failures.
	if err := am.SyncAndApplyConfigFromDatabase(); err != nil {
		am.logger.Error("unable to sync configuration", "err", err)
	}

	for {
		select {
		case <-ctx.Done():
			return am.StopAndWait()
		case <-time.After(pollInterval):
			if err := am.SyncAndApplyConfigFromDatabase(); err != nil {
				am.logger.Error("unable to sync configuration", "err", err)
			}
		}
	}
}

func (am *Alertmanager) StopAndWait() error {
	if am.dispatcher != nil {
		am.dispatcher.Stop()
	}

	if am.inhibitor != nil {
		am.inhibitor.Stop()
	}

	am.alerts.Close()

	close(am.stopc)

	am.wg.Wait()
	return nil
}

// SaveAndApplyConfig saves the configuration the database and applies the configuration to the Alertmanager.
// It rollbacks the save if we fail to apply the configuration.
func (am *Alertmanager) SaveAndApplyConfig(cfg *apimodels.PostableUserConfig) error {
	rawConfig, err := json.Marshal(&cfg)
	if err != nil {
		return fmt.Errorf("failed to serialize to the Alertmanager configuration: %w", err)
	}

	am.reloadConfigMtx.Lock()
	defer am.reloadConfigMtx.Unlock()

	cmd := &ngmodels.SaveAlertmanagerConfigurationCmd{
		AlertmanagerConfiguration: string(rawConfig),
		ConfigurationVersion:      fmt.Sprintf("v%d", ngmodels.AlertConfigurationVersion),
	}

	err = am.Store.SaveAlertmanagerConfigurationWithCallback(cmd, func() error {
		if err := am.applyConfig(cfg, rawConfig); err != nil {
			return err
		}
		return nil
	})
	if err != nil {
		return err
	}
	am.Metrics.ActiveConfigurations.Set(1)

	return nil
}

// SyncAndApplyConfigFromDatabase picks the latest config from database and restarts
// the components with the new config.
func (am *Alertmanager) SyncAndApplyConfigFromDatabase() error {
	am.reloadConfigMtx.Lock()
	defer am.reloadConfigMtx.Unlock()

	// First, let's get the configuration we need from the database.
	q := &ngmodels.GetLatestAlertmanagerConfigurationQuery{}
	if err := am.Store.GetLatestAlertmanagerConfiguration(q); err != nil {
		// If there's no configuration in the database, let's use the default configuration.
		if errors.Is(err, store.ErrNoAlertmanagerConfiguration) {
			// First, let's save it to the database. We don't need to use a transaction here as we'll always succeed.
			am.logger.Info("no Alertmanager configuration found, saving and applying a default")
			savecmd := &ngmodels.SaveAlertmanagerConfigurationCmd{
				AlertmanagerConfiguration: alertmanagerDefaultConfiguration,
				Default:                   true,
				ConfigurationVersion:      fmt.Sprintf("v%d", ngmodels.AlertConfigurationVersion),
			}
			if err := am.Store.SaveAlertmanagerConfiguration(savecmd); err != nil {
				return err
			}

			q.Result = &ngmodels.AlertConfiguration{AlertmanagerConfiguration: alertmanagerDefaultConfiguration, Default: true}
		} else {
			return fmt.Errorf("unable to get Alertmanager configuration from the database: %w", err)
		}
	}

	cfg, err := Load([]byte(q.Result.AlertmanagerConfiguration))
	if err != nil {
		return err
	}

	if err := am.applyConfig(cfg, nil); err != nil {
		return fmt.Errorf("unable to reload configuration: %w", err)
	}

	if q.Result.Default {
		am.Metrics.ActiveConfigurations.Set(0)
	} else {
		am.Metrics.ActiveConfigurations.Set(1)
	}

	return nil
}

// applyConfig applies a new configuration by re-initializing all components using the configuration provided.
// It is not safe to call concurrently.
func (am *Alertmanager) applyConfig(cfg *apimodels.PostableUserConfig, rawConfig []byte) (err error) {
	// First, let's make sure this config is not already loaded
	var configChanged bool
	if rawConfig == nil {
		enc, err := json.Marshal(cfg.AlertmanagerConfig)
		if err != nil {
			// In theory, this should never happen.
			return err
		}
		rawConfig = enc
	}

	if md5.Sum(am.config) != md5.Sum(rawConfig) {
		configChanged = true
	}

	if cfg.TemplateFiles == nil {
		cfg.TemplateFiles = map[string]string{}
	}
	cfg.TemplateFiles["__default__.tmpl"] = channels.DefaultTemplateString

	// next, we need to make sure we persist the templates to disk.
	paths, templatesChanged, err := PersistTemplates(cfg, am.WorkingDirPath())
	if err != nil {
		return err
	}

	// If neither the configuration nor templates have changed, we've got nothing to do.
	if !configChanged && !templatesChanged {
		am.logger.Debug("neither config nor template have changed, skipping configuration sync.")
		return nil
	}

	// With the templates persisted, create the template list using the paths.
	tmpl, err := template.FromGlobs(paths...)
	if err != nil {
		return err
	}
	externalURL, err := url.Parse(am.Settings.AppURL)
	if err != nil {
		return err
	}
	tmpl.ExternalURL = externalURL

	// Finally, build the integrations map using the receiver configuration and templates.
	integrationsMap, err := am.buildIntegrationsMap(cfg.AlertmanagerConfig.Receivers, tmpl)
	if err != nil {
		return err
	}
	// Now, let's put together our notification pipeline
	routingStage := make(notify.RoutingStage, len(integrationsMap))

	if am.inhibitor != nil {
		am.inhibitor.Stop()
	}
	if am.dispatcher != nil {
		am.dispatcher.Stop()
	}

	am.inhibitor = inhibit.NewInhibitor(am.alerts, cfg.AlertmanagerConfig.InhibitRules, am.marker, am.gokitLogger)
	am.silencer = silence.NewSilencer(am.silences, am.marker, am.gokitLogger)

	inhibitionStage := notify.NewMuteStage(am.inhibitor)
	silencingStage := notify.NewMuteStage(am.silencer)
	for name := range integrationsMap {
		stage := am.createReceiverStage(name, integrationsMap[name], waitFunc, am.notificationLog)
		routingStage[name] = notify.MultiStage{silencingStage, inhibitionStage, stage}
	}

	am.route = dispatch.NewRoute(cfg.AlertmanagerConfig.Route, nil)
	am.dispatcher = dispatch.NewDispatcher(am.alerts, am.route, routingStage, am.marker, timeoutFunc, am.gokitLogger, am.dispatcherMetrics)

	am.wg.Add(1)
	go func() {
		defer am.wg.Done()
		am.dispatcher.Run()
	}()

	am.wg.Add(1)
	go func() {
		defer am.wg.Done()
		am.inhibitor.Run()
	}()

	am.config = rawConfig
	return nil
}

func (am *Alertmanager) WorkingDirPath() string {
	return filepath.Join(am.Settings.DataPath, workingDir)
}

// buildIntegrationsMap builds a map of name to the list of Grafana integration notifiers off of a list of receiver config.
func (am *Alertmanager) buildIntegrationsMap(receivers []*apimodels.PostableApiReceiver, templates *template.Template) (map[string][]notify.Integration, error) {
	integrationsMap := make(map[string][]notify.Integration, len(receivers))
	for _, receiver := range receivers {
		integrations, err := am.buildReceiverIntegrations(receiver, templates)
		if err != nil {
			return nil, err
		}
		integrationsMap[receiver.Name] = integrations
	}

	return integrationsMap, nil
}

type NotificationChannel interface {
	notify.Notifier
	notify.ResolvedSender
}

// buildReceiverIntegrations builds a list of integration notifiers off of a receiver config.
func (am *Alertmanager) buildReceiverIntegrations(receiver *apimodels.PostableApiReceiver, tmpl *template.Template) ([]notify.Integration, error) {
	var integrations []notify.Integration

	for i, r := range receiver.GrafanaManagedReceivers {
		// secure settings are already encrypted at this point
		secureSettings := securejsondata.SecureJsonData(make(map[string][]byte, len(r.SecureSettings)))

		for k, v := range r.SecureSettings {
			d, err := base64.StdEncoding.DecodeString(v)
			if err != nil {
				return nil, fmt.Errorf("failed to decode secure setting")
			}
			secureSettings[k] = d
		}
		var (
			cfg = &channels.NotificationChannelConfig{
				UID:                   r.UID,
				Name:                  r.Name,
				Type:                  r.Type,
				DisableResolveMessage: r.DisableResolveMessage,
				Settings:              r.Settings,
				SecureSettings:        secureSettings,
			}
			n   NotificationChannel
			err error
		)
		switch r.Type {
		case "email":
			n, err = channels.NewEmailNotifier(cfg, tmpl) // Email notifier already has a default template.
		case "pagerduty":
			n, err = channels.NewPagerdutyNotifier(cfg, tmpl)
		case "pushover":
			n, err = channels.NewPushoverNotifier(cfg, tmpl)
		case "slack":
			n, err = channels.NewSlackNotifier(cfg, tmpl)
		case "telegram":
			n, err = channels.NewTelegramNotifier(cfg, tmpl)
		case "victorops":
			n, err = channels.NewVictoropsNotifier(cfg, tmpl)
		case "teams":
			n, err = channels.NewTeamsNotifier(cfg, tmpl)
		case "dingding":
			n, err = channels.NewDingDingNotifier(cfg, tmpl)
		case "kafka":
			n, err = channels.NewKafkaNotifier(cfg, tmpl)
		case "webhook":
			n, err = channels.NewWebHookNotifier(cfg, tmpl)
		case "sensugo":
			n, err = channels.NewSensuGoNotifier(cfg, tmpl)
		case "discord":
			n, err = channels.NewDiscordNotifier(cfg, tmpl)
		case "googlechat":
			n, err = channels.NewGoogleChatNotifier(cfg, tmpl)
		case "line":
			n, err = channels.NewLineNotifier(cfg, tmpl)
		case "threema":
			n, err = channels.NewThreemaNotifier(cfg, tmpl)
		case "opsgenie":
			n, err = channels.NewOpsgenieNotifier(cfg, tmpl)
		case "prometheus-alertmanager":
			n, err = channels.NewAlertmanagerNotifier(cfg, tmpl)
		default:
			return nil, fmt.Errorf("notifier %s is not supported", r.Type)
		}
		if err != nil {
			return nil, err
		}
		integrations = append(integrations, notify.NewIntegration(n, n, r.Type, i))
	}

	return integrations, nil
}

// PutAlerts receives the alerts and then sends them through the corresponding route based on whenever the alert has a receiver embedded or not
func (am *Alertmanager) PutAlerts(postableAlerts apimodels.PostableAlerts) error {
	now := time.Now()
	alerts := make([]*types.Alert, 0, len(postableAlerts.PostableAlerts))
	var validationErr *AlertValidationError
	for _, a := range postableAlerts.PostableAlerts {
		alert := &types.Alert{
			Alert: model.Alert{
				Labels:       model.LabelSet{},
				Annotations:  model.LabelSet{},
				StartsAt:     time.Time(a.StartsAt),
				EndsAt:       time.Time(a.EndsAt),
				GeneratorURL: a.GeneratorURL.String(),
			},
			UpdatedAt: now,
		}
		for k, v := range a.Labels {
			if len(v) == 0 || k == ngmodels.NamespaceUIDLabel { // Skip empty and namespace UID labels.
				continue
			}
			alert.Alert.Labels[model.LabelName(k)] = model.LabelValue(v)
		}
		for k, v := range a.Annotations {
			if len(v) == 0 { // Skip empty annotation.
				continue
			}
			alert.Alert.Annotations[model.LabelName(k)] = model.LabelValue(v)
		}

		// Ensure StartsAt is set.
		if alert.StartsAt.IsZero() {
			if alert.EndsAt.IsZero() {
				alert.StartsAt = now
			} else {
				alert.StartsAt = alert.EndsAt
			}
		}
		// If no end time is defined, set a timeout after which an alert
		// is marked resolved if it is not updated.
		if alert.EndsAt.IsZero() {
			alert.Timeout = true
			alert.EndsAt = now.Add(defaultResolveTimeout)
		}

		if alert.EndsAt.After(now) {
			am.Metrics.Firing().Inc()
		} else {
			am.Metrics.Resolved().Inc()
		}

		if err := validateAlert(alert); err != nil {
			if validationErr == nil {
				validationErr = &AlertValidationError{}
			}
			validationErr.Alerts = append(validationErr.Alerts, a)
			validationErr.Errors = append(validationErr.Errors, err)
			am.Metrics.Invalid().Inc()
			continue
		}

		alerts = append(alerts, alert)
	}

	if err := am.alerts.Put(alerts...); err != nil {
		// Notification sending alert takes precedence over validation errors.
		return err
	}
	if validationErr != nil {
		// Even if validationErr is nil, the require.NoError fails on it.
		return validationErr
	}
	return nil
}

// validateAlert is a.Validate() while additionally allowing
// space for label and annotation names.
func validateAlert(a *types.Alert) error {
	if a.StartsAt.IsZero() {
		return fmt.Errorf("start time missing")
	}
	if !a.EndsAt.IsZero() && a.EndsAt.Before(a.StartsAt) {
		return fmt.Errorf("start time must be before end time")
	}
	if err := validateLabelSet(a.Labels); err != nil {
		return fmt.Errorf("invalid label set: %s", err)
	}
	if len(a.Labels) == 0 {
		return fmt.Errorf("at least one label pair required")
	}
	if err := validateLabelSet(a.Annotations); err != nil {
		return fmt.Errorf("invalid annotations: %s", err)
	}
	return nil
}

// validateLabelSet is ls.Validate() while additionally allowing
// space for label names.
func validateLabelSet(ls model.LabelSet) error {
	for ln, lv := range ls {
		if !isValidLabelName(ln) {
			return fmt.Errorf("invalid name %q", ln)
		}
		if !lv.IsValid() {
			return fmt.Errorf("invalid value %q", lv)
		}
	}
	return nil
}

// isValidLabelName is ln.IsValid() while additionally allowing spaces.
// The regex for Prometheus data model is ^[a-zA-Z_][a-zA-Z0-9_]*$
// while we will follow ^[a-zA-Z_][a-zA-Z0-9_ ]*$
func isValidLabelName(ln model.LabelName) bool {
	if len(ln) == 0 {
		return false
	}
	for i, b := range ln {
		if !((b >= 'a' && b <= 'z') ||
			(b >= 'A' && b <= 'Z') ||
			b == '_' ||
			(i > 0 && (b == ' ' || (b >= '0' && b <= '9')))) {
			return false
		}
	}
	return true
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

// createReceiverStage creates a pipeline of stages for a receiver.
func (am *Alertmanager) createReceiverStage(name string, integrations []notify.Integration, wait func() time.Duration, notificationLog notify.NotificationLog) notify.Stage {
	var fs notify.FanoutStage
	for i := range integrations {
		recv := &nflogpb.Receiver{
			GroupName:   name,
			Integration: integrations[i].Name(),
			Idx:         uint32(integrations[i].Index()),
		}
		var s notify.MultiStage
		s = append(s, notify.NewWaitStage(wait))
		s = append(s, notify.NewDedupStage(&integrations[i], notificationLog, recv))
		s = append(s, notify.NewRetryStage(integrations[i], name, am.stageMetrics))
		s = append(s, notify.NewSetNotifiesStage(notificationLog, recv))

		fs = append(fs, s)
	}
	return fs
}

func waitFunc() time.Duration {
	return setting.AlertingNotificationTimeout
}

func timeoutFunc(d time.Duration) time.Duration {
	//TODO: What does MinTimeout means here?
	if d < notify.MinTimeout {
		d = notify.MinTimeout
	}
	return d + waitFunc()
}
