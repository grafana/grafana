package notifier

import (
	"context"
	"path/filepath"
	"sort"
	"sync"
	"time"

	gokit_log "github.com/go-kit/kit/log"
	"github.com/grafana/alerting-api/pkg/api"
	"github.com/pkg/errors"
	"github.com/prometheus/alertmanager/dispatch"
	"github.com/prometheus/alertmanager/nflog"
	"github.com/prometheus/alertmanager/nflog/nflogpb"
	"github.com/prometheus/alertmanager/notify"
	"github.com/prometheus/alertmanager/pkg/labels"
	"github.com/prometheus/alertmanager/silence"
	"github.com/prometheus/alertmanager/silence/silencepb"
	"github.com/prometheus/alertmanager/template"
	"github.com/prometheus/alertmanager/types"
	"github.com/prometheus/client_golang/prometheus"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/registry"
	"github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/services/ngalert/notifier/channels"
	"github.com/grafana/grafana/pkg/services/ngalert/store"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/services/sqlstore/migrator"
	"github.com/grafana/grafana/pkg/setting"
)

const (
	workingDir = "alerting"
)

type Alertmanager struct {
	logger   log.Logger
	Settings *setting.Cfg       `inject:""`
	SQLStore *sqlstore.SQLStore `inject:""`
	Store    store.AlertingStore

	// notificationLog keeps tracks of which notifications we've fired already.
	notificationLog *nflog.Log
	// silences keeps the track of which notifications we should not fire due to user configuration.
	silences *silence.Silences
	marker   types.Marker
	alerts   *AlertProvider

	dispatcher   *dispatch.Dispatcher
	dispatcherWG sync.WaitGroup

	stageMetrics *notify.Metrics

	reloadConfigMtx sync.Mutex
}

func init() {
	registry.RegisterService(&Alertmanager{})
}

func (am *Alertmanager) IsDisabled() bool {
	return !setting.AlertingEnabled || !setting.ExecuteAlerts
}

func (am *Alertmanager) Init() (err error) {
	am.logger = log.New("alertmanager")
	r := prometheus.NewRegistry()
	am.marker = types.NewMarker(r)
	am.stageMetrics = notify.NewMetrics(r)
	am.Store = store.DBstore{SQLStore: am.SQLStore}

	am.notificationLog, err = nflog.New(
		nflog.WithRetention(time.Hour*24),                         //TODO: This is a setting.
		nflog.WithSnapshot(filepath.Join("dir", "notifications")), //TODO: This should be a setting
	)
	if err != nil {
		return errors.Wrap(err, "unable to initialize the notification log component of alerting")
	}
	am.silences, err = silence.New(silence.Options{
		SnapshotFile: filepath.Join("dir", "silences"), //TODO: This is a setting
		Retention:    time.Hour * 24,                   //TODO: This is also a setting
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
	q := &models.GetLatestAlertmanagerConfigurationQuery{}
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

	silencingStage := notify.NewMuteStage(silence.NewSilencer(am.silences, am.marker, gokit_log.NewNopLogger()))
	for name := range integrationsMap {
		stage := am.createReceiverStage(name, integrationsMap[name], waitFunc, am.notificationLog)
		routingStage[name] = notify.MultiStage{silencingStage, stage}
	}

	am.alerts.SetStage(routingStage)

	am.StopAndWait()
	//TODO: Verify this is correct
	route := dispatch.NewRoute(cfg.AlertmanagerConfig.Route, nil)
	//TODO: This needs the metrics
	am.dispatcher = dispatch.NewDispatcher(am.alerts, route, routingStage, am.marker, timeoutFunc, gokit_log.NewNopLogger(), nil)

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
			n, err := channels.NewEmailNotifier(r.Result)
			if err != nil {
				return nil, err
			}

			integrations = append(integrations, notify.NewIntegration(n, n, r.Name, i))
		}
	}

	return integrations, nil
}

// CreateAlerts receives the alerts and then sends them through the corresponding route based on whenever the alert has a receiver embedded or not
func (am *Alertmanager) CreateAlerts(alerts ...*PostableAlert) error {
	return am.alerts.PutPostableAlert(alerts...)
}

func (am *Alertmanager) ListSilences(matchers []*labels.Matcher) ([]types.Silence, error) {
	pbsilences, _, err := am.silences.Query()
	if err != nil {
		return nil, errors.Wrap(err, "unable to query for the list of silences")
	}
	r := []types.Silence{}
	for _, pbs := range pbsilences {
		s, err := silenceFromProto(pbs)
		if err != nil {
			return nil, errors.Wrap(err, "unable to marshal silence")
		}

		sms := make(map[string]string)
		for _, m := range s.Matchers {
			sms[m.Name] = m.Value
		}

		if !matchFilterLabels(matchers, sms) {
			continue
		}

		r = append(r, *s)
	}

	var active, pending, expired []types.Silence
	for _, s := range r {
		switch s.Status.State {
		case types.SilenceStateActive:
			active = append(active, s)
		case types.SilenceStatePending:
			pending = append(pending, s)
		case types.SilenceStateExpired:
			expired = append(expired, s)
		}
	}

	sort.Slice(active, func(i int, j int) bool {
		return active[i].EndsAt.Before(active[j].EndsAt)
	})
	sort.Slice(pending, func(i int, j int) bool {
		return pending[i].EndsAt.Before(pending[j].EndsAt)
	})
	sort.Slice(expired, func(i int, j int) bool {
		return expired[i].EndsAt.After(expired[j].EndsAt)
	})

	// Initialize silences explicitly to an empty list (instead of nil)
	// So that it does not get converted to "null" in JSON.
	silences := []types.Silence{}
	silences = append(silences, active...)
	silences = append(silences, pending...)
	silences = append(silences, expired...)

	return silences, nil
}

func (am *Alertmanager) GetSilence(silence *types.Silence)    {}
func (am *Alertmanager) CreateSilence(silence *types.Silence) {}
func (am *Alertmanager) DeleteSilence(silence *types.Silence) {}

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
		//TODO: This probably won't work w/o the metrics
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

// copied from the Alertmanager
func silenceFromProto(s *silencepb.Silence) (*types.Silence, error) {
	sil := &types.Silence{
		ID:        s.Id,
		StartsAt:  s.StartsAt,
		EndsAt:    s.EndsAt,
		UpdatedAt: s.UpdatedAt,
		Status: types.SilenceStatus{
			State: types.CalcSilenceState(s.StartsAt, s.EndsAt),
		},
		Comment:   s.Comment,
		CreatedBy: s.CreatedBy,
	}
	for _, m := range s.Matchers {
		var t labels.MatchType
		switch m.Type {
		case silencepb.Matcher_EQUAL:
			t = labels.MatchEqual
		case silencepb.Matcher_REGEXP:
			t = labels.MatchRegexp
		case silencepb.Matcher_NOT_EQUAL:
			t = labels.MatchNotEqual
		case silencepb.Matcher_NOT_REGEXP:
			t = labels.MatchNotRegexp
		}
		matcher, err := labels.NewMatcher(t, m.Name, m.Pattern)
		if err != nil {
			return nil, err
		}

		sil.Matchers = append(sil.Matchers, matcher)
	}

	return sil, nil
}

func matchFilterLabels(matchers []*labels.Matcher, sms map[string]string) bool {
	for _, m := range matchers {
		v, prs := sms[m.Name]
		switch m.Type {
		case labels.MatchNotRegexp, labels.MatchNotEqual:
			if m.Value == "" && prs {
				continue
			}
			if !m.Matches(v) {
				return false
			}
		default:
			if m.Value == "" && !prs {
				continue
			}
			if !m.Matches(v) {
				return false
			}
		}
	}

	return true
}
