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

	logger log.Logger

	client  postAlertsClient
	timeout time.Duration
}

type postAlertsClient interface {
	PostAlerts(params *amalert.PostAlertsParams, opts ...amalert.ClientOption) (*amalert.PostAlertsOK, error)
}

// Options are the configurable parameters of a Handler.
type Options struct {
	QueueCapacity  int
	ExternalLabels labels.Labels
	RelabelConfigs []*relabel.Config

	Registerer prometheus.Registerer
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

func NewManager(o *Options, logger log.Logger, c postAlertsClient, timeout time.Duration) *Manager {
	ctx, cancel := context.WithCancel(context.Background())

	if logger == nil {
		logger = log.NewNopLogger()
	}

	n := &Manager{
		queue:   make([]*Alert, 0, o.QueueCapacity),
		ctx:     ctx,
		cancel:  cancel,
		more:    make(chan struct{}, 1),
		opts:    o,
		logger:  logger,
		client:  c,
		timeout: timeout,
	}

	queueLenFunc := func() float64 { return float64(n.queueLen()) }

	n.metrics = newAlertMetrics(
		o.Registerer,
		o.QueueCapacity,
		queueLenFunc,
	)

	return n
}

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
		select {
		case <-n.ctx.Done():
			return
		case <-n.more:
		}
		alerts := n.nextBatch()

		if err := n.send(alerts...); err != nil {
			n.metrics.dropped.Add(float64(len(alerts)))
		}
		// If the queue still has items left, kick off the next iteration.
		if n.queueLen() > 0 {
			n.setMore()
		}
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

		a.Labels = lb.Labels(a.Labels)
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

// NOTE(santiago): necessary?
func alertsToOpenAPIAlerts(alerts []*Alert) models.PostableAlerts {
	openAPIAlerts := models.PostableAlerts{}
	for _, a := range alerts {
		start := strfmt.DateTime(a.StartsAt)
		end := strfmt.DateTime(a.EndsAt)
		openAPIAlerts = append(openAPIAlerts, &models.PostableAlert{
			// NOTE(santiago): use
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

func (m *Manager) send(alerts ...*Alert) error {
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
