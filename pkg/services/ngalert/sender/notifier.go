// THIS FILE IS COPIED FROM UPSTREAM
//
// https://github.com/prometheus/prometheus/blob/edfc3bcd025dd6fe296c167a14a216cab1e552ee/notifier/notifier.go
//
// Copyright 2013 The Prometheus Authors
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
// http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

// nolint
package sender

import (
	"context"
	"fmt"
	"net/http"
	"net/url"
	"path"
	"sync"
	"time"

	"github.com/go-kit/log"
	"github.com/go-kit/log/level"
	"github.com/go-openapi/strfmt"
	"github.com/prometheus/alertmanager/api/v2/models"
	"github.com/prometheus/client_golang/prometheus"
	config_util "github.com/prometheus/common/config"
	"github.com/prometheus/common/model"
	"github.com/prometheus/common/version"

	"github.com/prometheus/prometheus/config"
	"github.com/prometheus/prometheus/discovery/targetgroup"
	"github.com/prometheus/prometheus/model/labels"
	"github.com/prometheus/prometheus/model/relabel"
)

const (
	contentTypeJSON = "application/json"
)

// String constants for instrumentation.
const (
	namespace         = "prometheus"
	subsystem         = "notifications"
	alertmanagerLabel = "alertmanager"
)

var userAgent = fmt.Sprintf("Prometheus/%s", version.Version)

// Alert is a generic representation of an alert in the Prometheus eco-system.
type Alert struct {
	// Label value pairs for purpose of aggregation, matching, and disposition
	// dispatching. This must minimally include an "alertname" label.
	Labels labels.Labels `json:"labels"`

	// Extra key/value information which does not define alert identity.
	Annotations labels.Labels `json:"annotations"`

	// The known time range for this alert. Both ends are optional.
	StartsAt     time.Time `json:"startsAt,omitempty"`
	EndsAt       time.Time `json:"endsAt,omitempty"`
	GeneratorURL string    `json:"generatorURL,omitempty"`
}

// Name returns the name of the alert. It is equivalent to the "alertname" label.
func (a *Alert) Name() string {
	return a.Labels.Get(labels.AlertName)
}

// Hash returns a hash over the alert. It is equivalent to the alert labels hash.
func (a *Alert) Hash() uint64 {
	return a.Labels.Hash()
}

func (a *Alert) String() string {
	s := fmt.Sprintf("%s[%s]", a.Name(), fmt.Sprintf("%016x", a.Hash())[:7])
	if a.Resolved() {
		return s + "[resolved]"
	}
	return s + "[active]"
}

// Resolved returns true iff the activity interval ended in the past.
func (a *Alert) Resolved() bool {
	return a.ResolvedAt(time.Now())
}

// ResolvedAt returns true iff the activity interval ended before
// the given timestamp.
func (a *Alert) ResolvedAt(ts time.Time) bool {
	if a.EndsAt.IsZero() {
		return false
	}
	return !a.EndsAt.After(ts)
}

// Manager is responsible for dispatching alert notifications to an
// alert manager service.
type Manager struct {
	queue []*Alert
	opts  *Options

	metrics *alertMetrics

	more   chan struct{}
	mtx    sync.RWMutex
	ctx    context.Context
	cancel func()

	alertmanagers map[string]*alertmanagerSet
	logger        log.Logger
}

// Options are the configurable parameters of a Handler.
type Options struct {
	QueueCapacity  int
	ExternalLabels labels.Labels
	RelabelConfigs []*relabel.Config
	// Used for sending HTTP requests to the Alertmanager.
	Do func(ctx context.Context, client *http.Client, req *http.Request) (*http.Response, error)

	Registerer prometheus.Registerer
}

type alertMetrics struct {
	latency                 *prometheus.SummaryVec
	errors                  *prometheus.CounterVec
	sent                    *prometheus.CounterVec
	dropped                 prometheus.Counter
	queueLength             prometheus.GaugeFunc
	queueCapacity           prometheus.Gauge
	alertmanagersDiscovered prometheus.GaugeFunc
}

func newAlertMetrics(r prometheus.Registerer, queueCap int, queueLen, alertmanagersDiscovered func() float64) *alertMetrics {
	m := &alertMetrics{
		latency: prometheus.NewSummaryVec(prometheus.SummaryOpts{
			Namespace:  namespace,
			Subsystem:  subsystem,
			Name:       "latency_seconds",
			Help:       "Latency quantiles for sending alert notifications.",
			Objectives: map[float64]float64{0.5: 0.05, 0.9: 0.01, 0.99: 0.001},
		},
			[]string{alertmanagerLabel},
		),
		errors: prometheus.NewCounterVec(prometheus.CounterOpts{
			Namespace: namespace,
			Subsystem: subsystem,
			Name:      "errors_total",
			Help:      "Total number of errors sending alert notifications.",
		},
			[]string{alertmanagerLabel},
		),
		sent: prometheus.NewCounterVec(prometheus.CounterOpts{
			Namespace: namespace,
			Subsystem: subsystem,
			Name:      "sent_total",
			Help:      "Total number of alerts sent.",
		},
			[]string{alertmanagerLabel},
		),
		dropped: prometheus.NewCounter(prometheus.CounterOpts{
			Namespace: namespace,
			Subsystem: subsystem,
			Name:      "dropped_total",
			Help:      "Total number of alerts dropped due to errors when sending to Alertmanager.",
		}),
		queueLength: prometheus.NewGaugeFunc(prometheus.GaugeOpts{
			Namespace: namespace,
			Subsystem: subsystem,
			Name:      "queue_length",
			Help:      "The number of alert notifications in the queue.",
		}, queueLen),
		queueCapacity: prometheus.NewGauge(prometheus.GaugeOpts{
			Namespace: namespace,
			Subsystem: subsystem,
			Name:      "queue_capacity",
			Help:      "The capacity of the alert notifications queue.",
		}),
		alertmanagersDiscovered: prometheus.NewGaugeFunc(prometheus.GaugeOpts{
			Name: "prometheus_notifications_alertmanagers_discovered",
			Help: "The number of alertmanagers discovered and active.",
		}, alertmanagersDiscovered),
	}

	m.queueCapacity.Set(float64(queueCap))

	if r != nil {
		r.MustRegister(
			m.latency,
			m.errors,
			m.sent,
			m.dropped,
			m.queueLength,
			m.queueCapacity,
			m.alertmanagersDiscovered,
		)
	}

	return m
}

func do(ctx context.Context, client *http.Client, req *http.Request) (*http.Response, error) {
	if client == nil {
		client = http.DefaultClient
	}
	return client.Do(req.WithContext(ctx))
}

// NewManager is the manager constructor.
func NewManager(o *Options, logger log.Logger) *Manager {
	ctx, cancel := context.WithCancel(context.Background())

	if o.Do == nil {
		o.Do = do
	}
	if logger == nil {
		logger = log.NewNopLogger()
	}

	n := &Manager{
		queue:  make([]*Alert, 0, o.QueueCapacity),
		ctx:    ctx,
		cancel: cancel,
		more:   make(chan struct{}, 1),
		opts:   o,
		logger: logger,
	}

	queueLenFunc := func() float64 { return float64(n.queueLen()) }
	alertmanagersDiscoveredFunc := func() float64 { return float64(len(n.Alertmanagers())) }

	n.metrics = newAlertMetrics(
		o.Registerer,
		o.QueueCapacity,
		queueLenFunc,
		alertmanagersDiscoveredFunc,
	)

	return n
}

const maxBatchSize = 64

func (n *Manager) queueLen() int {
	n.mtx.RLock()
	defer n.mtx.RUnlock()

	return len(n.queue)
}

func (n *Manager) nextBatch() []*Alert {
	n.mtx.Lock()
	defer n.mtx.Unlock()

	var alerts []*Alert

	if len(n.queue) > maxBatchSize {
		alerts = append(make([]*Alert, 0, maxBatchSize), n.queue[:maxBatchSize]...)
		n.queue = n.queue[maxBatchSize:]
	} else {
		alerts = append(make([]*Alert, 0, len(n.queue)), n.queue...)
		n.queue = n.queue[:0]
	}

	return alerts
}

// Run dispatches notifications continuously.
func (n *Manager) Run(tsets <-chan map[string][]*targetgroup.Group) {
	for {
		// The select is split in two parts, such as we will first try to read
		// new alertmanager targets if they are available, before sending new
		// alerts.
		select {
		case <-n.ctx.Done():
			return
		case ts := <-tsets:
			n.reload(ts)
		default:
			select {
			case <-n.ctx.Done():
				return
			case ts := <-tsets:
				n.reload(ts)
			case <-n.more:
			}
		}
		alerts := n.nextBatch()

		if !n.sendAll(alerts...) {
			n.metrics.dropped.Add(float64(len(alerts)))
		}
		// If the queue still has items left, kick off the next iteration.
		if n.queueLen() > 0 {
			n.setMore()
		}
	}
}

func (n *Manager) reload(tgs map[string][]*targetgroup.Group) {
	n.mtx.Lock()
	defer n.mtx.Unlock()

	for id, tgroup := range tgs {
		am, ok := n.alertmanagers[id]
		if !ok {
			level.Error(n.logger).Log("msg", "couldn't sync alert manager set", "err", fmt.Sprintf("invalid id:%v", id))
			continue
		}
		am.sync(tgroup)
	}
}

// Send queues the given notification requests for processing.
// Panics if called on a handler that is not running.
func (n *Manager) Send(alerts ...*Alert) {
	n.mtx.Lock()
	defer n.mtx.Unlock()

	// Attach external labels before relabelling and sending.
	for _, a := range alerts {
		lb := labels.NewBuilder(a.Labels)

		n.opts.ExternalLabels.Range(func(l labels.Label) {
			if a.Labels.Get(l.Name) == "" {
				lb.Set(l.Name, l.Value)
			}
		})

		a.Labels = lb.Labels()
	}

	alerts = n.relabelAlerts(alerts)
	if len(alerts) == 0 {
		return
	}

	// Queue capacity should be significantly larger than a single alert
	// batch could be.
	if d := len(alerts) - n.opts.QueueCapacity; d > 0 {
		alerts = alerts[d:]

		level.Warn(n.logger).Log("msg", "Alert batch larger than queue capacity, dropping alerts", "num_dropped", d)
		n.metrics.dropped.Add(float64(d))
	}

	// If the queue is full, remove the oldest alerts in favor
	// of newer ones.
	if d := (len(n.queue) + len(alerts)) - n.opts.QueueCapacity; d > 0 {
		n.queue = n.queue[d:]

		level.Warn(n.logger).Log("msg", "Alert notification queue full, dropping alerts", "num_dropped", d)
		n.metrics.dropped.Add(float64(d))
	}
	n.queue = append(n.queue, alerts...)

	// Notify sending goroutine that there are alerts to be processed.
	n.setMore()
}

func (n *Manager) relabelAlerts(alerts []*Alert) []*Alert {
	var relabeledAlerts []*Alert

	for _, alert := range alerts {
		labels, keep := relabel.Process(alert.Labels, n.opts.RelabelConfigs...)
		if keep {
			alert.Labels = labels
			relabeledAlerts = append(relabeledAlerts, alert)
		}
	}
	return relabeledAlerts
}

// setMore signals that the alert queue has items.
func (n *Manager) setMore() {
	// If we cannot send on the channel, it means the signal already exists
	// and has not been consumed yet.
	select {
	case n.more <- struct{}{}:
	default:
	}
}

// Alertmanagers returns a slice of Alertmanager URLs.
func (n *Manager) Alertmanagers() []*url.URL {
	n.mtx.RLock()
	amSets := n.alertmanagers
	n.mtx.RUnlock()

	var res []*url.URL

	for _, ams := range amSets {
		ams.mtx.RLock()
		for _, am := range ams.ams {
			res = append(res, am.url())
		}
		ams.mtx.RUnlock()
	}

	return res
}

// DroppedAlertmanagers returns a slice of Alertmanager URLs.
func (n *Manager) DroppedAlertmanagers() []*url.URL {
	n.mtx.RLock()
	amSets := n.alertmanagers
	n.mtx.RUnlock()

	var res []*url.URL

	for _, ams := range amSets {
		ams.mtx.RLock()
		for _, dam := range ams.droppedAms {
			res = append(res, dam.url())
		}
		ams.mtx.RUnlock()
	}

	return res
}

func alertsToOpenAPIAlerts(alerts []*Alert) models.PostableAlerts {
	openAPIAlerts := models.PostableAlerts{}
	for _, a := range alerts {
		start := strfmt.DateTime(a.StartsAt)
		end := strfmt.DateTime(a.EndsAt)
		openAPIAlerts = append(openAPIAlerts, &models.PostableAlert{
			Annotations: labelsToOpenAPILabelSet(a.Annotations),
			EndsAt:      end,
			StartsAt:    start,
			Alert: models.Alert{
				GeneratorURL: strfmt.URI(a.GeneratorURL),
				Labels:       labelsToOpenAPILabelSet(a.Labels),
			},
		})
	}

	return openAPIAlerts
}

func labelsToOpenAPILabelSet(modelLabelSet labels.Labels) models.LabelSet {
	apiLabelSet := models.LabelSet{}
	modelLabelSet.Range(func(label labels.Label) {
		apiLabelSet[label.Name] = label.Value
	})

	return apiLabelSet
}

// Stop shuts down the notification handler.
func (n *Manager) Stop() {
	level.Info(n.logger).Log("msg", "Stopping notification manager...")
	n.cancel()
}

// Alertmanager holds Alertmanager endpoint information.
type alertmanager interface {
	url() *url.URL
}

type alertmanagerLabels struct{ labels.Labels }

const pathLabel = "__alerts_path__"

func (a alertmanagerLabels) url() *url.URL {
	return &url.URL{
		Scheme: a.Get(model.SchemeLabel),
		Host:   a.Get(model.AddressLabel),
		Path:   a.Get(pathLabel),
	}
}

func newAlertmanagerSet(cfg *config.AlertmanagerConfig, logger log.Logger, metrics *alertMetrics) (*alertmanagerSet, error) {
	client, err := config_util.NewClientFromConfig(cfg.HTTPClientConfig, "alertmanager")
	if err != nil {
		return nil, err
	}
	s := &alertmanagerSet{
		client:  client,
		cfg:     cfg,
		logger:  logger,
		metrics: metrics,
	}
	return s, nil
}

// sync extracts a deduplicated set of Alertmanager endpoints from a list
// of target groups definitions.
func (s *alertmanagerSet) sync(tgs []*targetgroup.Group) {
	allAms := []alertmanager{}
	allDroppedAms := []alertmanager{}

	for _, tg := range tgs {
		ams, droppedAms, err := AlertmanagerFromGroup(tg, s.cfg)
		if err != nil {
			level.Error(s.logger).Log("msg", "Creating discovered Alertmanagers failed", "err", err)
			continue
		}
		allAms = append(allAms, ams...)
		allDroppedAms = append(allDroppedAms, droppedAms...)
	}

	s.mtx.Lock()
	defer s.mtx.Unlock()
	// Set new Alertmanagers and deduplicate them along their unique URL.
	s.ams = []alertmanager{}
	s.droppedAms = []alertmanager{}
	s.droppedAms = append(s.droppedAms, allDroppedAms...)
	seen := map[string]struct{}{}

	for _, am := range allAms {
		us := am.url().String()
		if _, ok := seen[us]; ok {
			continue
		}

		// This will initialize the Counters for the AM to 0.
		s.metrics.sent.WithLabelValues(us)
		s.metrics.errors.WithLabelValues(us)

		seen[us] = struct{}{}
		s.ams = append(s.ams, am)
	}
}

func postPath(pre string, v config.AlertmanagerAPIVersion) string {
	alertPushEndpoint := fmt.Sprintf("/api/%v/alerts", string(v))
	return path.Join("/", pre, alertPushEndpoint)
}

// AlertmanagerFromGroup extracts a list of alertmanagers from a target group
// and an associated AlertmanagerConfig.
func AlertmanagerFromGroup(tg *targetgroup.Group, cfg *config.AlertmanagerConfig) ([]alertmanager, []alertmanager, error) {
	res := make([]alertmanager, 0, len(tg.Targets))
	var droppedAlertManagers []alertmanager

	for _, tlset := range tg.Targets {
		lbls := make([]labels.Label, 0, len(tlset)+2+len(tg.Labels))

		for ln, lv := range tlset {
			lbls = append(lbls, labels.Label{Name: string(ln), Value: string(lv)})
		}
		// Set configured scheme as the initial scheme label for overwrite.
		lbls = append(lbls, labels.Label{Name: model.SchemeLabel, Value: cfg.Scheme})
		lbls = append(lbls, labels.Label{Name: pathLabel, Value: postPath(cfg.PathPrefix, cfg.APIVersion)})

		// Combine target labels with target group labels.
		for ln, lv := range tg.Labels {
			if _, ok := tlset[ln]; !ok {
				lbls = append(lbls, labels.Label{Name: string(ln), Value: string(lv)})
			}
		}

		lset, keep := relabel.Process(labels.New(lbls...), cfg.RelabelConfigs...)
		if !keep {
			droppedAlertManagers = append(droppedAlertManagers, alertmanagerLabels{labels.New(lbls...)})
			continue
		}

		addr := lset.Get(model.AddressLabel)
		if err := config.CheckTargetAddress(model.LabelValue(addr)); err != nil {
			return nil, nil, err
		}

		res = append(res, alertmanagerLabels{lset})
	}
	return res, droppedAlertManagers, nil
}
