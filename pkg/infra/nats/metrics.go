package nats

import (
	"github.com/prometheus/client_golang/prometheus"
)

const (
	metricsNamespace = "grafana"
	metricsSubsystem = "nats"
)

const roleLabel = "role"

type metrics struct {
	connectionStatus *prometheus.GaugeVec
	reconnects       *prometheus.CounterVec
	disconnects      *prometheus.CounterVec
	connectionErrors *prometheus.CounterVec
	messagesPub      *prometheus.CounterVec
	publishErrors    *prometheus.CounterVec
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
		messagesPub: prometheus.NewCounterVec(prometheus.CounterOpts{
			Namespace: metricsNamespace,
			Subsystem: metricsSubsystem,
			Name:      "messages_published_total",
			Help:      "Total number of messages published to NATS per role.",
		}, []string{roleLabel}),
		publishErrors: prometheus.NewCounterVec(prometheus.CounterOpts{
			Namespace: metricsNamespace,
			Subsystem: metricsSubsystem,
			Name:      "publish_errors_total",
			Help:      "Total number of NATS publish errors per role.",
		}, []string{roleLabel}),
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
		m.embeddedServerUp,
	)

	return m
}
