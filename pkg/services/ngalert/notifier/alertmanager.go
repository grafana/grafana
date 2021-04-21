package notifier

import (
	"context"
	"crypto/md5"
	"encoding/json"
	"fmt"
	"net/url"
	"path/filepath"
	"sync"
	"time"

	gokit_log "github.com/go-kit/kit/log"
	apimodels "github.com/grafana/grafana/pkg/services/ngalert/api/tooling/definitions"
	"github.com/pkg/errors"
	"github.com/prometheus/alertmanager/dispatch"
	"github.com/prometheus/alertmanager/inhibit"
	"github.com/prometheus/alertmanager/nflog"
	"github.com/prometheus/alertmanager/nflog/nflogpb"
	"github.com/prometheus/alertmanager/notify"
	"github.com/prometheus/alertmanager/silence"
	"github.com/prometheus/alertmanager/template"
	"github.com/prometheus/alertmanager/types"
	"github.com/prometheus/client_golang/prometheus"

	"github.com/grafana/grafana/pkg/components/securejsondata"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/registry"
	"github.com/grafana/grafana/pkg/services/alerting"
	ngmodels "github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/services/ngalert/notifier/channels"
	"github.com/grafana/grafana/pkg/services/ngalert/store"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/services/sqlstore/migrator"
	"github.com/grafana/grafana/pkg/setting"
)

const (
	pollInterval = 1 * time.Minute
	workingDir   = "alerting"
	// How long should we keep silences and notification entries on-disk after they've served their purpose.
	retentionNotificationsAndSilences = 5 * 24 * time.Hour
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
	logger   log.Logger
	Settings *setting.Cfg       `inject:""`
	SQLStore *sqlstore.SQLStore `inject:""`
	Store    store.AlertingStore

	// notificationLog keeps tracks of which notifications we've fired already.
	notificationLog *nflog.Log
	// silences keeps the track of which notifications we should not fire due to user configuration.
	silencer   *silence.Silencer
	silences   *silence.Silences
	marker     types.Marker
	alerts     *AlertProvider
	route      *dispatch.Route
	dispatcher *dispatch.Dispatcher
	inhibitor  *inhibit.Inhibitor
	wg         sync.WaitGroup

	stageMetrics      *notify.Metrics
	dispatcherMetrics *dispatch.DispatcherMetrics

	reloadConfigMtx sync.RWMutex
	config          []byte
}

func init() {
	registry.RegisterService(&Alertmanager{})
}

func (am *Alertmanager) IsDisabled() bool {
	if am.Settings == nil {
		return true
	}
	return !am.Settings.IsNgAlertEnabled()
}

func (am *Alertmanager) Init() (err error) {
	am.logger = log.New("alertmanager")
	r := prometheus.NewRegistry()
	am.marker = types.NewMarker(r)
	am.stageMetrics = notify.NewMetrics(r)
	am.dispatcherMetrics = dispatch.NewDispatcherMetrics(r)
	am.Store = store.DBstore{SQLStore: am.SQLStore}

	am.notificationLog, err = nflog.New(
		nflog.WithRetention(retentionNotificationsAndSilences),
		nflog.WithSnapshot(filepath.Join(am.WorkingDirPath(), "notifications")),
	)
	if err != nil {
		return errors.Wrap(err, "unable to initialize the notification log component of alerting")
	}
	am.silences, err = silence.New(silence.Options{
		SnapshotFile: filepath.Join(am.WorkingDirPath(), "silences"),
		Retention:    retentionNotificationsAndSilences,
	})
	if err != nil {
		return errors.Wrap(err, "unable to initialize the silencing component of alerting")
	}

	am.alerts, err = NewAlertProvider(am.marker)
	if err != nil {
		return errors.Wrap(err, "unable to initialize the alert provider component of alerting")
	}

	return nil
}

func (am *Alertmanager) Run(ctx context.Context) error {
	// Make sure dispatcher starts. We can tolerate future reload failures.
	if err := am.SyncAndApplyConfigFromDatabase(); err != nil {
		am.logger.Error(errors.Wrap(err, "unable to sync configuration").Error())
	}

	for {
		select {
		case <-ctx.Done():
			am.StopAndWait()
			return nil
		case <-time.After(pollInterval):
			if err := am.SyncAndApplyConfigFromDatabase(); err != nil {
				am.logger.Error(errors.Wrap(err, "unable to sync configuration").Error())
			}
		}
	}
}

// AddMigration runs the database migrations as the service starts.
func (am *Alertmanager) AddMigration(mg *migrator.Migrator) {
	alertmanagerConfigurationMigration(mg)
}

func (am *Alertmanager) StopAndWait() {
	if am.dispatcher != nil {
		am.dispatcher.Stop()
	}

	if am.inhibitor != nil {
		am.inhibitor.Stop()
	}
	am.wg.Wait()
}

func (am *Alertmanager) SaveAndApplyConfig(cfg *apimodels.PostableUserConfig) error {
	rawConfig, err := json.Marshal(&cfg)
	if err != nil {
		return errors.Wrap(err, "failed to serialize to the Alertmanager configuration")
	}

	am.reloadConfigMtx.Lock()
	defer am.reloadConfigMtx.Unlock()

	cmd := &ngmodels.SaveAlertmanagerConfigurationCmd{
		AlertmanagerConfiguration: string(rawConfig),
		ConfigurationVersion:      fmt.Sprintf("v%d", ngmodels.AlertConfigurationVersion),
	}

	if err := am.Store.SaveAlertmanagerConfiguration(cmd); err != nil {
		return errors.Wrap(err, "failed to save Alertmanager configuration")
	}

	return errors.Wrap(am.applyConfig(cfg), "unable to reload configuration")
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
			q.Result = &ngmodels.AlertConfiguration{AlertmanagerConfiguration: alertmanagerDefaultConfiguration}
		} else {
			return errors.Wrap(err, "unable to get Alertmanager configuration from the database")
		}
	}

	cfg, err := Load([]byte(q.Result.AlertmanagerConfiguration))
	if err != nil {
		return err
	}

	return errors.Wrap(am.applyConfig(cfg), "unable to reload configuration")
}

// ApplyConfig applies a new configuration by re-initializing all components using the configuration provided.
func (am *Alertmanager) ApplyConfig(cfg *apimodels.PostableUserConfig) error {
	am.reloadConfigMtx.Lock()
	defer am.reloadConfigMtx.Unlock()

	return am.applyConfig(cfg)
}

const defaultTemplate = "templates/default.tmpl"

// applyConfig applies a new configuration by re-initializing all components using the configuration provided.
// It is not safe to call concurrently.
func (am *Alertmanager) applyConfig(cfg *apimodels.PostableUserConfig) error {
	// First, let's make sure this config is not already loaded
	var configChanged bool
	rawConfig, err := json.Marshal(cfg.AlertmanagerConfig)
	if err != nil {
		// In theory, this should never happen.
		return err
	}

	if md5.Sum(am.config) != md5.Sum(rawConfig) {
		configChanged = true
	}
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

	paths = append([]string{defaultTemplate}, paths...)

	// With the templates persisted, create the template list using the paths.
	tmpl, err := template.FromGlobs(paths...)
	if err != nil {
		return err
	}

	// Finally, build the integrations map using the receiver configuration and templates.
	integrationsMap, err := am.buildIntegrationsMap(cfg.AlertmanagerConfig.Receivers, tmpl)
	if err != nil {
		return err
	}
	// Now, let's put together our notification pipeline
	routingStage := make(notify.RoutingStage, len(integrationsMap))

	am.inhibitor = inhibit.NewInhibitor(am.alerts, cfg.AlertmanagerConfig.InhibitRules, am.marker, gokit_log.NewNopLogger())
	am.silencer = silence.NewSilencer(am.silences, am.marker, gokit_log.NewNopLogger())

	inhibitionStage := notify.NewMuteStage(am.inhibitor)
	silencingStage := notify.NewMuteStage(am.silencer)
	for name := range integrationsMap {
		stage := am.createReceiverStage(name, integrationsMap[name], waitFunc, am.notificationLog)
		routingStage[name] = notify.MultiStage{silencingStage, inhibitionStage, stage}
	}

	am.StopAndWait()
	am.route = dispatch.NewRoute(cfg.AlertmanagerConfig.Route, nil)
	am.dispatcher = dispatch.NewDispatcher(am.alerts, am.route, routingStage, am.marker, timeoutFunc, gokit_log.NewNopLogger(), am.dispatcherMetrics)

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
		var (
			cfg = &models.AlertNotification{
				Uid:                   r.Uid,
				Name:                  r.Name,
				Type:                  r.Type,
				IsDefault:             r.IsDefault,
				SendReminder:          r.SendReminder,
				DisableResolveMessage: r.DisableResolveMessage,
				Settings:              r.Settings,
				SecureSettings:        securejsondata.GetEncryptedJsonData(r.SecureSettings),
			}
			n   NotificationChannel
			err error
		)
		externalURL, err := url.Parse(am.Settings.AppURL)
		if err != nil {
			return nil, err
		}
		switch r.Type {
		case "email":
			n, err = channels.NewEmailNotifier(cfg, externalURL)
		case "pagerduty":
			n, err = channels.NewPagerdutyNotifier(cfg, tmpl, externalURL)
		case "slack":
			n, err = channels.NewSlackNotifier(cfg, tmpl, externalURL)
		}
		if err != nil {
			return nil, err
		}
		integrations = append(integrations, notify.NewIntegration(n, n, r.Name, i))
	}

	return integrations, nil
}

// PutAlerts receives the alerts and then sends them through the corresponding route based on whenever the alert has a receiver embedded or not
func (am *Alertmanager) PutAlerts(alerts apimodels.PostableAlerts) error {
	return am.alerts.PutPostableAlert(alerts)
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

// GetAvailableNotifiers returns the metadata of all the notification channels that can be configured.
func (am *Alertmanager) GetAvailableNotifiers() []*alerting.NotifierPlugin {
	return []*alerting.NotifierPlugin{
		{
			Type:        "email",
			Name:        "Email",
			Description: "Sends notifications using Grafana server configured SMTP settings",
			Heading:     "Email settings",
			Options: []alerting.NotifierOption{
				{
					Label:        "Single email",
					Description:  "Send a single email to all recipients",
					Element:      alerting.ElementTypeCheckbox,
					PropertyName: "singleEmail",
				}, {
					Label:        "Addresses",
					Description:  "You can enter multiple email addresses using a \";\" separator",
					Element:      alerting.ElementTypeTextArea,
					PropertyName: "addresses",
					Required:     true,
				},
			},
		},
	}
}
