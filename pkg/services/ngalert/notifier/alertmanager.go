package notifier

import (
	"context"
	"path/filepath"
	"sort"
	"sync"
	"time"

	gokit_log "github.com/go-kit/kit/log"
	"github.com/pkg/errors"
	"github.com/prometheus/alertmanager/config"
	"github.com/prometheus/alertmanager/dispatch"
	"github.com/prometheus/alertmanager/nflog"
	"github.com/prometheus/alertmanager/nflog/nflogpb"
	"github.com/prometheus/alertmanager/notify"
	"github.com/prometheus/alertmanager/pkg/labels"
	"github.com/prometheus/alertmanager/silence"
	"github.com/prometheus/alertmanager/silence/silencepb"
	"github.com/prometheus/alertmanager/types"
	"github.com/prometheus/client_golang/prometheus"

	"github.com/grafana/alerting-api/pkg/api"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/registry"
	"github.com/grafana/grafana/pkg/setting"
)

type Alertmanager struct {
	logger log.Logger

	// notificationLog keeps tracks of which notifications we've fired already.
	notificationLog *nflog.Log
	// silences keeps the track of which notifications we should not fire due to user configuration.
	silences *silence.Silences
	marker   types.Marker
	alerts   *AlertProvider

	dispatcher   *dispatch.Dispatcher
	dispatcherWG sync.WaitGroup

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

	return nil
}

func (am *Alertmanager) Run(ctx context.Context) error {
	// Make sure dispatcher starts. We can tolerate future reload failures.
	if err := am.ReloadConfigFromDatabase(); err != nil {
		return err
	}
	for {
		select {
		case <-ctx.Done():
			am.StopAndWait()
			return nil
		case <-time.After(1 * time.Minute):
			// TODO: once we have a check to skip reload on same config, uncomment this.
			//if err := am.ReloadConfigFromDatabase(); err != nil {
			//	am.logger.Error("failed to sync config from database", "error", err)
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

// ReloadConfigFromDatabase picks the latest config from database and restarts
// the components with the new config.
func (am *Alertmanager) ReloadConfigFromDatabase() error {
	am.reloadConfigMtx.Lock()
	defer am.reloadConfigMtx.Unlock()

	// TODO: check if config is same as before using hashes and skip reload in case they are same.
	cfg, err := getConfigFromDatabase()
	if err != nil {
		return errors.Wrap(err, "get config from database")
	}
	return errors.Wrap(am.ApplyConfig(cfg), "reload from config")
}

func getConfigFromDatabase() (*api.PostableApiAlertingConfig, error) {
	// TODO: get configs from the database.
	return &api.PostableApiAlertingConfig{}, nil
}

// ApplyConfig applies a new configuration by re-initializing all components using the configuration provided.
// It is not safe to call concurrently.
func (am *Alertmanager) ApplyConfig(cfg *api.PostableApiAlertingConfig) error {
	// Now, let's put together our notification pipeline
	receivers := buildIntegrationsMap()
	routingStage := make(notify.RoutingStage, len(receivers))

	silencingStage := notify.NewMuteStage(silence.NewSilencer(am.silences, am.marker, gokit_log.NewNopLogger()))
	//TODO: We need to unify these receivers
	for name := range receivers {
		stage := createReceiverStage(name, receivers[name], waitFunc, am.notificationLog)
		routingStage[name] = notify.MultiStage{silencingStage, stage}
	}

	am.alerts.SetStage(routingStage)

	am.StopAndWait()
	am.dispatcher = dispatch.NewDispatcher(am.alerts, BuildRoutingConfiguration(), routingStage, am.marker, timeoutFunc, gokit_log.NewNopLogger(), nil)

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
		s = append(s, notify.NewRetryStage(integrations[i], name, nil))
		s = append(s, notify.NewSetNotifiesStage(notificationLog, recv))

		fs = append(fs, s)
	}
	return fs
}

// BuildRoutingConfiguration produces an alertmanager-based routing configuration.
func BuildRoutingConfiguration() *dispatch.Route {
	var cfg *config.Config
	return dispatch.NewRoute(cfg.Route, nil)
}

func buildIntegrationsMap() map[string][]notify.Integration {
	return map[string][]notify.Integration{}
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
