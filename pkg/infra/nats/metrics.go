package nats

import (
	"github.com/prometheus/client_golang/prometheus"
)

const (
	metricsNamespace = "grafana"
	metricsSubsystem = "nats"
)

// roleLabel distinguishes the publisher and subscriber connections, which may
// hold distinct least-privilege credentials.
const roleLabel = "role"

type metrics struct {
	connectionStatus *prometheus.GaugeVec
	reconnects       *prometheus.CounterVec
	disconnects      *prometheus.CounterVec
	connectionErrors *prometheus.CounterVec
	messagesPub      prometheus.Counter
	publishErrors    prometheus.Counter
	messagesRecv     prometheus.Counter
	slowConsumers    prometheus.Counter
	embeddedServerUp prometheus.Gauge
}

func newMetrics(reg prometheus.Registerer) *metrics {
	m := &metrics{
		connectionStatus: prometheus.NewGaugeVec(prometheus.GaugeOpts{
			Namespace: metricsNamespace,
			Subsystem: metricsSubsystem,
			Name:      "connection_status",
			Help:      "Current NATS connection status per role (1 = connected, 0 = disconnected).",
		}, []string{roleLabel}),
		reconnects: prometheus.NewCounterVec(prometheus.CounterOpts{
			Namespace: metricsNamespace,
			Subsystem: metricsSubsystem,
			Name:      "reconnects_total",
			Help:      "Total number of NATS reconnections per role.",
		}, []string{roleLabel}),
		disconnects: prometheus.NewCounterVec(prometheus.CounterOpts{
			Namespace: metricsNamespace,
			Subsystem: metricsSubsystem,
			Name:      "disconnects_total",
			Help:      "Total number of NATS disconnections per role.",
		}, []string{roleLabel}),
		connectionErrors: prometheus.NewCounterVec(prometheus.CounterOpts{
			Namespace: metricsNamespace,
			Subsystem: metricsSubsystem,
			Name:      "connection_errors_total",
			Help:      "Total number of NATS asynchronous connection errors per role.",
		}, []string{roleLabel}),
		messagesPub: prometheus.NewCounter(prometheus.CounterOpts{
			Namespace: metricsNamespace,
			Subsystem: metricsSubsystem,
			Name:      "messages_published_total",
			Help:      "Total number of messages published to NATS.",
		}),
		publishErrors: prometheus.NewCounter(prometheus.CounterOpts{
			Namespace: metricsNamespace,
			Subsystem: metricsSubsystem,
			Name:      "publish_errors_total",
			Help:      "Total number of NATS publish errors.",
		}),
		messagesRecv: prometheus.NewCounter(prometheus.CounterOpts{
			Namespace: metricsNamespace,
			Subsystem: metricsSubsystem,
			Name:      "messages_received_total",
			Help:      "Total number of messages received from NATS subscriptions.",
		}),
		slowConsumers: prometheus.NewCounter(prometheus.CounterOpts{
			Namespace: metricsNamespace,
			Subsystem: metricsSubsystem,
			Name:      "slow_consumer_errors_total",
			Help:      "Total number of NATS slow-consumer errors (dropped messages).",
		}),
		embeddedServerUp: prometheus.NewGauge(prometheus.GaugeOpts{
			Namespace: metricsNamespace,
			Subsystem: metricsSubsystem,
			Name:      "embedded_server_up",
			Help:      "Whether the embedded NATS server is running (1 = up, 0 = down).",
		}),
	}

	reg.MustRegister(
		m.connectionStatus,
		m.reconnects,
		m.disconnects,
		m.connectionErrors,
		m.messagesPub,
		m.publishErrors,
		m.messagesRecv,
		m.slowConsumers,
		m.embeddedServerUp,
	)

	return m
}
