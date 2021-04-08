package notifier

import (
	"context"
	"fmt"
	"path/filepath"
	"sync"
	"time"

	"github.com/grafana/grafana/pkg/components/securejsondata"

	"github.com/grafana/grafana/pkg/models"

	gokit_log "github.com/go-kit/kit/log"
	"github.com/grafana/alerting-api/pkg/api"
	"github.com/pkg/errors"
	"github.com/prometheus/alertmanager/dispatch"
	"github.com/prometheus/alertmanager/nflog"
	"github.com/prometheus/alertmanager/nflog/nflogpb"
	"github.com/prometheus/alertmanager/notify"
	"github.com/prometheus/alertmanager/silence"
	"github.com/prometheus/alertmanager/template"
	"github.com/prometheus/alertmanager/types"
	"github.com/prometheus/client_golang/prometheus"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/registry"
	ngmodels "github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/services/ngalert/notifier/channels"
	"github.com/grafana/grafana/pkg/services/ngalert/store"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/services/sqlstore/migrator"
	"github.com/grafana/grafana/pkg/setting"
)

const (
	workingDir = "alerting"
	// How long should we keep silences and notification entries on-disk after they've served their purpose.
	retentionNotificationsAndSilences = 5 * 24 * time.Hour
)

type Alertmanager struct {
	logger   log.Logger
	Settings *setting.Cfg       `inject:""`
	SQLStore *sqlstore.SQLStore `inject:""`
	Store    store.AlertingStore

	// notificationLog keeps tracks of which notifications we've fired already.
	notificationLog *nflog.Log
	// silences keeps the track of which notifications we should not fire due to user configuration.
	silencer     *silence.Silencer
	silences     *silence.Silences
	marker       types.Marker
	alerts       *AlertProvider
	route        *dispatch.Route
	dispatcher   *dispatch.Dispatcher
	dispatcherWG sync.WaitGroup

	stageMetrics      *notify.Metrics
	dispatcherMetrics *dispatch.DispatcherMetrics

	reloadConfigMtx sync.RWMutex
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

	am.alerts, err = NewAlertProvider(nil, am.marker)
	if err != nil {
		return errors.Wrap(err, "unable to initialize the alert provider component of alerting")
	}

	return nil
}

func (am *Alertmanager) Run(ctx context.Context) error {
	// Make sure dispatcher starts. We can tolerate future reload failures.
	if err := am.SyncAndApplyConfigFromDatabase(); err != nil && !errors.Is(err, store.ErrNoAlertmanagerConfiguration) {
		return err
	}

	for {
		select {
		case <-ctx.Done():
			am.StopAndWait()
			return nil
		case <-time.After(1 * time.Minute):
			// TODO: once we have a check to skip reload on same config, uncomment this.
			//if err := am.SyncAndApplyConfigFromDatabase(); err != nil {
			//	if err == store.ErrNoAlertmanagerConfiguration {
			//		am.logger.Warn(errors.Wrap(err, "unable to sync configuration").Error())
			//	}
			//	am.logger.Error(errors.Wrap(err, "unable to sync configuration").Error())
			//}
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
	am.dispatcherWG.Wait()
}

// SyncAndApplyConfigFromDatabase picks the latest config from database and restarts
// the components with the new config.
func (am *Alertmanager) SyncAndApplyConfigFromDatabase() error {
	am.reloadConfigMtx.Lock()
	defer am.reloadConfigMtx.Unlock()

	// TODO: check if config is same as before using hashes and skip reload in case they are same.
	cfg, err := am.getConfigFromDatabase()
	if err != nil {
		return errors.Wrap(err, "get config from database")
	}
	return errors.Wrap(am.applyConfig(cfg), "reload from config")
}

func (am *Alertmanager) getConfigFromDatabase() (*api.PostableUserConfig, error) {
	// First, let's get the configuration we need from the database.
	q := &ngmodels.GetLatestAlertmanagerConfigurationQuery{}
	if err := am.Store.GetLatestAlertmanagerConfiguration(q); err != nil {
		return nil, err
	}

	// Then, let's parse and return the alertmanager configuration.
	return Load(q.Result.AlertmanagerConfiguration)
}

// ApplyConfig applies a new configuration by re-initializing all components using the configuration provided.
func (am *Alertmanager) ApplyConfig(cfg *api.PostableUserConfig) error {
	am.reloadConfigMtx.Lock()
	defer am.reloadConfigMtx.Unlock()

	return am.applyConfig(cfg)
}

// applyConfig applies a new configuration by re-initializing all components using the configuration provided.
// It is not safe to call concurrently.
func (am *Alertmanager) applyConfig(cfg *api.PostableUserConfig) error {
	// First, we need to make sure we persist the templates to disk.
	paths, _, err := PersistTemplates(cfg, am.WorkingDirPath())
	if err != nil {
		return err
	}

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

	am.silencer = silence.NewSilencer(am.silences, am.marker, gokit_log.NewNopLogger())
	silencingStage := notify.NewMuteStage(am.silencer)
	for name := range integrationsMap {
		stage := am.createReceiverStage(name, integrationsMap[name], waitFunc, am.notificationLog)
		routingStage[name] = notify.MultiStage{silencingStage, stage}
	}

	am.alerts.SetStage(routingStage)

	am.StopAndWait()
	am.route = dispatch.NewRoute(cfg.AlertmanagerConfig.Route, nil)
	am.dispatcher = dispatch.NewDispatcher(am.alerts, am.route, routingStage, am.marker, timeoutFunc, gokit_log.NewNopLogger(), am.dispatcherMetrics)

	am.dispatcherWG.Add(1)
	go func() {
		defer am.dispatcherWG.Done()
		am.dispatcher.Run()
	}()

	return nil
}

func (am *Alertmanager) WorkingDirPath() string {
	return filepath.Join(am.Settings.DataPath, workingDir)
}

// buildIntegrationsMap builds a map of name to the list of Grafana integration notifiers off of a list of receiver config.
func (am *Alertmanager) buildIntegrationsMap(receivers []*api.PostableApiReceiver, templates *template.Template) (map[string][]notify.Integration, error) {
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

// buildReceiverIntegrations builds a list of integration notifiers off of a receiver config.
func (am *Alertmanager) buildReceiverIntegrations(receiver *api.PostableApiReceiver, _ *template.Template) ([]notify.Integration, error) {
	var integrations []notify.Integration

	for i, r := range receiver.GrafanaManagedReceivers {
		switch r.Type {
		case "email":
			frequency, err := time.ParseDuration(r.Frequency)
			if err != nil {
				return nil, fmt.Errorf("unable to parse receiver frequency %s, %w", r.Frequency, err)
			}
			notification := models.AlertNotification{
				Uid:                   r.Uid,
				Name:                  r.Name,
				Type:                  r.Type,
				IsDefault:             r.IsDefault,
				SendReminder:          r.SendReminder,
				DisableResolveMessage: r.DisableResolveMessage,
				Frequency:             frequency,
				Settings:              r.Settings,
				SecureSettings:        securejsondata.GetEncryptedJsonData(r.SecureSettings),
			}
			n, err := channels.NewEmailNotifier(&notification)
			if err != nil {
				return nil, err
			}

			integrations = append(integrations, notify.NewIntegration(n, n, r.Name, i))
		}
	}

	return integrations, nil
}

// PutAlerts receives the alerts and then sends them through the corresponding route based on whenever the alert has a receiver embedded or not
func (am *Alertmanager) PutAlerts(alerts ...*PostableAlert) error {
	return am.alerts.PutPostableAlert(alerts...)
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
