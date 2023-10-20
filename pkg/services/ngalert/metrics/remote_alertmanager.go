package metrics

import (
	"github.com/prometheus/client_golang/prometheus"
)

type RemoteAlertmanagerMetrics struct {
	Dropped       prometheus.Counter
	Errors        prometheus.Counter
	Latency       prometheus.Summary
	QueueLength   prometheus.GaugeFunc
	QueueCapacity prometheus.Gauge
	Sent          prometheus.Counter
}

// NewRemoteAlertmanagerMetrics creates a set of metrics for the remote Alertmanager.
func NewRemoteAlertmanagerMetrics(r prometheus.Registerer, queueCap int, queueLen func() float64) *RemoteAlertmanagerMetrics {
	m := &RemoteAlertmanagerMetrics{
		Latency: prometheus.NewSummary(prometheus.SummaryOpts{
			Namespace:  Namespace,
			Subsystem:  Subsystem,
			Name:       "remote_alertmanager_sender_latency_seconds",
			Help:       "Latency quantiles for sending alert notifications.",
			Objectives: map[float64]float64{0.5: 0.05, 0.9: 0.01, 0.99: 0.001},
		}),
		Errors: prometheus.NewCounter(prometheus.CounterOpts{
			Namespace: Namespace,
			Subsystem: Subsystem,
			Name:      "remote_alertmanager_sender_errors_total",
			Help:      "Total number of errors sending alert notifications.",
		}),
		Sent: prometheus.NewCounter(prometheus.CounterOpts{
			Namespace: Namespace,
			Subsystem: Subsystem,
			Name:      "remote_alertmanager_sender_alerts_sent_total",
			Help:      "Total number of alerts sent.",
		}),
		Dropped: prometheus.NewCounter(prometheus.CounterOpts{
			Namespace: Namespace,
			Subsystem: Subsystem,
			Name:      "remote_alertmanager_alerts_dropped_total",
			Help:      "Total number of alerts dropped due to errors when sending to Alertmanager.",
		}),
		QueueLength: prometheus.NewGaugeFunc(prometheus.GaugeOpts{
			Namespace: Namespace,
			Subsystem: Subsystem,
			Name:      "remote_alertmanager_queue_length",
			Help:      "The number of alert notifications in the queue.",
		}, queueLen),
		QueueCapacity: prometheus.NewGauge(prometheus.GaugeOpts{
			Namespace: Namespace,
			Subsystem: Subsystem,
			Name:      "remote_alertmanager_queue_capacity",
			Help:      "The capacity of the alert notifications queue.",
		}),
	}

	m.QueueCapacity.Set(float64(queueCap))

	if r != nil {
		r.MustRegister(m.Latency, m.Errors, m.Sent, m.Dropped, m.QueueLength, m.QueueCapacity)
	}
	return m
}
