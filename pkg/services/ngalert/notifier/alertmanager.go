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
	pkgmodels "github.com/grafana/grafana/pkg/models"
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
	silences          *silence.Silences
	marker            types.Marker
	alerts            *AlertProvider
	integrationsMap   map[string][]notify.Integration
	dispatcher        *dispatch.Dispatcher
	dispatcherMetrics *dispatch.DispatcherMetrics
	dispatcherWG      sync.WaitGroup

	reloadConfigMtx sync.Mutex
}

func init() {
	registry.RegisterService(&Alertmanager{})
}

func (am *Alertmanager) IsDisabled() bool {
	if am.Settings == nil {
		return true
	}
	// Check also about expressions?
	return !am.Settings.IsNgAlertEnabled()
}

func (am *Alertmanager) Init() (err error) {
	am.logger = log.New("alertmanager")
	am.Store = store.DBstore{SQLStore: am.SQLStore}

	//TODO: Speak with David Parrot wrt to the marker, we'll probably need our own.
	am.marker = types.NewMarker(prometheus.DefaultRegisterer)

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

	am.dispatcherMetrics = dispatch.NewDispatcherMetrics(prometheus.DefaultRegisterer)

	return nil
}

func (am *Alertmanager) Run(ctx context.Context) error {
	// Make sure dispatcher starts. We can tolerate future reload failures.
	//if err := am.SyncAndApplyConfigFromDatabase(); err != nil && err != store.ErrNoAlertmanagerConfiguration {
	//	return err
	//}

	//go func() {
	//	// TODO: ONLY FOR DEMO.
	//	// TODO: move this goroutine to the config API POST and initiate it there.
	//	<-time.After(4 * time.Second)
	//	fmt.Println("Sending alert")
	//	err := am.CreateAlerts(&PostableAlert{
	//		PostableAlert: amv2.PostableAlert{
	//			Annotations: amv2.LabelSet{
	//				"foo_annotation": "asdf",
	//			},
	//			EndsAt:   strfmt.DateTime(time.Now().Add(15 * time.Minute)),
	//			StartsAt: strfmt.DateTime(time.Now()),
	//			Alert: amv2.Alert{
	//				GeneratorURL: "https://example.com",
	//				Labels: amv2.LabelSet{
	//					"alertname": "DemoAlert",
	//				},
	//			},
	//		},
	//		Receivers: []string{"demo_receiver"},
	//	})
	//	if err == nil {
	//		fmt.Println("ALERT SENT! WOHOOO!")
	//	} else {
	//		fmt.Println("SENDING ALERT FAILED", err)
	//	}
	//}()

	for {
		select {
		case <-ctx.Done():
			am.StopAndWait()
			return nil
		case <-time.After(1 * time.Minute):
			// TODO: Skip if we have the same configuration
			//if err := am.SyncAndApplyConfigFromDatabase(); err != nil {
			//	if err != store.ErrNoAlertmanagerConfiguration {
			//		am.logger.Warn(errors.Wrap(err, "unable to sync configuration").Error())
			//	}
			//}
		}
	}
}

func (am *Alertmanager) StopAndWait() {
	if am.dispatcher != nil {
		am.dispatcher.Stop()
	}
	am.dispatcherWG.Wait()
}

func (am *Alertmanager) AddMigration(mg *migrator.Migrator) {
	if am.IsDisabled() {
		return
	}

	alertmanagerConfigurationMigration(mg)
}

// SyncAndApplyConfigFromDatabase picks the latest config from database and restarts
// the components with the new config.
func (am *Alertmanager) SyncAndApplyConfigFromDatabase() error {
	am.reloadConfigMtx.Lock()
	defer am.reloadConfigMtx.Unlock()

	// TODO: check if config is same as before using hashes and skip reload in case they are same.
	cfg, err := am.getConfigFromDatabase()
	if err != nil {
		return err
	}
	return errors.Wrap(am.ApplyConfig(cfg), "reload from config")
}

func (am *Alertmanager) getConfigFromDatabase() (cfg *api.PostableUserConfig, rerr error) {
	//defer func() {
	//	// TODO: THIS IS ONLY FOR DEMO.
	//	// TODO: use this config while POSTing and remove it from here.
	//	if cfg == nil {
	//		cfg = &api.PostableUserConfig{
	//			TemplateFiles: nil,
	//			AlertmanagerConfig: api.PostableApiAlertingConfig{
	//				Config: config.Config{
	//					Route: &config.Route{},
	//				},
	//				Receivers: nil,
	//			},
	//		}
	//		rerr = nil
	//	}
	//
	//	settings, err := simplejson.NewJson([]byte(`{"addresses": "ganesh@grafana.com"}`))
	//	if err != nil {
	//		rerr = err
	//		return
	//	}
	//
	//	cfg.AlertmanagerConfig.Receivers = append(cfg.AlertmanagerConfig.Receivers, &api.PostableApiReceiver{
	//		Receiver: config.Receiver{
	//			Name: "demo_receiver",
	//		},
	//		PostableGrafanaReceivers: api.PostableGrafanaReceivers{
	//			GrafanaManagedReceivers: []*api.PostableGrafanaReceiver{
	//				{
	//					Uid:      "",
	//					Name:     fmt.Sprintf("demo_email_%d", rand.Int()),
	//					Type:     "email",
	//					Settings: settings,
	//				},
	//			},
	//		},
	//	})
	//
	//	b, _ := json.Marshal(cfg)
	//	fmt.Print(string(b))
	//}()

	// First, let's get the configuration we need from the database and settings.
	q := &models.GetLatestAlertmanagerConfigurationQuery{}
	if err := am.Store.GetLatestAlertmanagerConfiguration(q); err != nil {
		return nil, err
	}

	// Next, let's parse the alertmanager configuration.
	return Load(q.Result.AlertmanagerConfiguration)
}

// ApplyConfig applies a new configuration by re-initializing all components using the configuration provided.
// It is not safe to call concurrently.
func (am *Alertmanager) ApplyConfig(cfg *api.PostableUserConfig) error {
	// With that, we need to make sure we persist the templates to disk.
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
	am.integrationsMap, err = am.buildIntegrationsMap(cfg.AlertmanagerConfig.Receivers, tmpl)
	if err != nil {
		return err
	}

	//TODO: DO I need to set this to the grafana URL?
	//tmpl.ExternalURL = url.URL{}

	// Now, let's put together our notification pipeline
	routingStage := make(notify.RoutingStage, len(am.integrationsMap))

	silencingStage := notify.NewMuteStage(silence.NewSilencer(am.silences, am.marker, gokit_log.NewNopLogger()))
	//TODO: We need to unify these receivers
	for name := range am.integrationsMap {
		stage := createReceiverStage(name, am.integrationsMap[name], waitFunc, am.notificationLog)
		routingStage[name] = notify.MultiStage{silencingStage, stage}
	}

	am.alerts.SetStage(routingStage)

	am.StopAndWait()
	am.dispatcher = dispatch.NewDispatcher(
		am.alerts,
		dispatch.NewRoute(cfg.AlertmanagerConfig.Route, nil),
		routingStage,
		am.marker,
		timeoutFunc,
		gokit_log.NewNopLogger(),
		am.dispatcherMetrics,
	)

	am.dispatcherWG.Add(1)
	go func() {
		defer am.dispatcherWG.Done()
		am.dispatcher.Run()
	}()

	return nil
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
		return pending[i].StartsAt.Before(pending[j].EndsAt)
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

func (am *Alertmanager) WorkingDirPath() string {
	return filepath.Join(am.Settings.DataPath, workingDir)
}

// buildIntegrationsMap builds a map of name to the list of integration notifiers off of a list of receiver config.
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
func (am *Alertmanager) buildReceiverIntegrations(receiver *api.PostableApiReceiver, templates *template.Template) ([]notify.Integration, error) {
	var integrations []notify.Integration

	for i, r := range receiver.GrafanaManagedReceivers {
		switch r.Type {
		case "email":
			// TODO: this may not be the right way. Verify that new entry is not added to database always. (UID should be same to avoid it?).
			if err := sqlstore.CreateAlertNotificationCommand((*pkgmodels.CreateAlertNotificationCommand)(r)); err != nil {
				return nil, err
			}

			n, err := channels.NewEmailNotifier(r.Result)
			if err != nil {
				return nil, err
			}

			integrations = append(integrations, notify.NewIntegration(n, n, r.Name, i))
		}
	}

	return integrations, nil
}

// createReceiverStage creates a pipeline of stages for a receiver.
func createReceiverStage(name string, integrations []notify.Integration, wait func() time.Duration, notificationLog notify.NotificationLog) notify.Stage {
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
		s = append(s, notify.NewRetryStage(integrations[i], name, notify.NewMetrics(prometheus.DefaultRegisterer)))
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
