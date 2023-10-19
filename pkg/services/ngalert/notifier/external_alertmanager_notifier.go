// THIS FILE IS PARTLY COPIED FROM UPSTREAM
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
package notifier

import (
	"context"
	"sync"
	"time"

	"github.com/go-kit/log"
	"github.com/go-kit/log/level"
	"github.com/go-openapi/strfmt"
	amalert "github.com/prometheus/alertmanager/api/v2/client/alert"
	"github.com/prometheus/alertmanager/api/v2/models"
	"github.com/prometheus/client_golang/prometheus"

	"github.com/prometheus/prometheus/discovery/targetgroup"
	"github.com/prometheus/prometheus/model/labels"
	"github.com/prometheus/prometheus/model/relabel"
)

// String constants for instrumentation.
const (
	alertmanagerLabel = "alertmanager"
	maxBatchSize      = 64
	namespace         = "prometheus"
	subsystem         = "notifications"
)

// Alert is a generic representation of an alert in the Prometheus eco-system.
type alert struct {
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

// Manager is responsible for dispatching alert notifications to an
// alert manager service.
type Manager struct {
	logger  log.Logger
	metrics *alertMetrics
	opts    *options
	timeout time.Duration

	cancel func()
	client postAlertsClient
	ctx    context.Context
	queue  []*alert
	more   chan struct{}
	mtx    sync.RWMutex
}

type postAlertsClient interface {
	PostAlerts(params *amalert.PostAlertsParams, opts ...amalert.ClientOption) (*amalert.PostAlertsOK, error)
}

// Options are the configurable parameters of a Handler.
type options struct {
	queueCapacity  int
	externalLabels labels.Labels
	relabelConfigs []*relabel.Config
	registerer     prometheus.Registerer
	timeout        time.Duration
}

type alertMetrics struct {
	latency       *prometheus.SummaryVec
	errors        *prometheus.CounterVec
	sent          *prometheus.CounterVec
	dropped       prometheus.Counter
	queueLength   prometheus.GaugeFunc
	queueCapacity prometheus.Gauge
}

// TODO(santiago): update
func newAlertMetrics(r prometheus.Registerer, queueCap int, queueLen func() float64) *alertMetrics {
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
		)
	}

	return m
}

func NewManager(o *options, logger log.Logger, c postAlertsClient) *Manager {
	if logger == nil {
		logger = log.NewNopLogger()
	}

	ctx, cancel := context.WithCancel(context.Background())
	n := &Manager{
		queue:   make([]*alert, 0, o.queueCapacity),
		ctx:     ctx,
		cancel:  cancel,
		more:    make(chan struct{}, 1),
		opts:    o,
		logger:  logger,
		client:  c,
		timeout: o.timeout,
	}

	queueLenFunc := func() float64 { return float64(n.queueLen()) }

	n.metrics = newAlertMetrics(
		o.registerer,
		o.queueCapacity,
		queueLenFunc,
	)

	return n
}

func (m *Manager) queueLen() int {
	m.mtx.RLock()
	defer m.mtx.RUnlock()

	return len(m.queue)
}

func (m *Manager) nextBatch() []*alert {
	m.mtx.Lock()
	defer m.mtx.Unlock()

	var alerts []*alert

	if len(m.queue) > maxBatchSize {
		alerts = append(make([]*alert, 0, maxBatchSize), m.queue[:maxBatchSize]...)
		m.queue = m.queue[maxBatchSize:]
	} else {
		alerts = append(make([]*alert, 0, len(m.queue)), m.queue...)
		m.queue = m.queue[:0]
	}

	return alerts
}

// Run dispatches notifications continuously.
func (m *Manager) Run(tsets <-chan map[string][]*targetgroup.Group) {
	for {
		select {
		case <-m.ctx.Done():
			return
		case <-m.more:
			alerts := m.nextBatch()
			if err := m.send(alerts...); err != nil {
				m.metrics.dropped.Add(float64(len(alerts)))
			}
			// If the queue still has items left, kick off the next iteration.
			if m.queueLen() > 0 {
				m.setMore()
			}
		}
	}
}

// Send queues the given notification requests for processing.
// Panics if called on a handler that is not running.
func (m *Manager) Send(alerts ...*alert) {
	m.mtx.Lock()
	defer m.mtx.Unlock()

	// Attach external labels before relabeling and sending.
	for _, a := range alerts {
		lb := labels.NewBuilder(a.Labels)

		m.opts.externalLabels.Range(func(l labels.Label) {
			if a.Labels.Get(l.Name) == "" {
				lb.Set(l.Name, l.Value)
			}
		})

		a.Labels = lb.Labels(a.Labels)
	}

	alerts = m.relabelAlerts(alerts)
	if len(alerts) == 0 {
		return
	}

	// Queue capacity should be significantly larger than a single alert
	// batch could be.
	if d := len(alerts) - m.opts.queueCapacity; d > 0 {
		alerts = alerts[d:]

		level.Warn(m.logger).Log("msg", "Alert batch larger than queue capacity, dropping alerts", "num_dropped", d)
		m.metrics.dropped.Add(float64(d))
	}

	// If the queue is full, remove the oldest alerts in favor
	// of newer ones.
	if d := (len(m.queue) + len(alerts)) - m.opts.queueCapacity; d > 0 {
		m.queue = m.queue[d:]

		level.Warn(m.logger).Log("msg", "Alert notification queue full, dropping alerts", "num_dropped", d)
		m.metrics.dropped.Add(float64(d))
	}
	m.queue = append(m.queue, alerts...)

	// Notify sending goroutine that there are alerts to be processed.
	m.setMore()
}

func (m *Manager) relabelAlerts(alerts []*alert) []*alert {
	var relabeledAlerts []*alert

	for _, alert := range alerts {
		labels, keep := relabel.Process(alert.Labels, m.opts.relabelConfigs...)
		if keep {
			alert.Labels = labels
			relabeledAlerts = append(relabeledAlerts, alert)
		}
	}
	return relabeledAlerts
}

// setMore signals that the alert queue has items.
func (m *Manager) setMore() {
	// If we cannot send on the channel, it means the signal already exists
	// and has not been consumed yet.
	select {
	case m.more <- struct{}{}:
	default:
	}
}

func alertsToOpenAPIAlerts(alerts []*alert) models.PostableAlerts {
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
func (m *Manager) Stop() {
	level.Info(m.logger).Log("msg", "Stopping notification manager...")
	m.cancel()
}

func (m *Manager) send(alerts ...*alert) error {
	if len(alerts) == 0 {
		return nil
	}
	openAPIAlerts := alertsToOpenAPIAlerts(alerts)
	ctx, cancel := context.WithTimeout(m.ctx, m.timeout)
	defer cancel()

	params := amalert.NewPostAlertsParamsWithContext(ctx).WithAlerts(openAPIAlerts)
	_, err := m.client.PostAlerts(params)
	return err
}
