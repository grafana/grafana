package nats

import (
	"github.com/prometheus/client_golang/prometheus"
)

const (
	metricsNamespace = "grafana"
	metricsSubsystem = "nats"
)

const roleLabel = "role"

// clientMetrics covers the NATS client side (connections and publishing). Every
// series is keyed by the `role` label, so a single registration serves every
// role an environment actually runs: roles that never connect or publish emit
// no series at all.
type clientMetrics struct {
	connectionStatus *prometheus.GaugeVec
	reconnects       *prometheus.CounterVec
	disconnects      *prometheus.CounterVec
	connectionErrors *prometheus.CounterVec
	messagesPub      *prometheus.CounterVec
	publishErrors    *prometheus.CounterVec
}

// TODO: we can further break down into per-role metrics, e.g. publisher vs subscriber, if we want to track
// metrics separately. For now, we just have a single set of metrics for all roles.
func newClientMetrics(reg prometheus.Registerer) *clientMetrics {
	m := &clientMetrics{
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
	}

	reg.MustRegister(
		m.connectionStatus,
		m.reconnects,
		m.disconnects,
		m.connectionErrors,
		m.messagesPub,
		m.publishErrors,
	)

	return m
}

// serverMetrics covers the embedded NATS server. It is registered only in
// environments that actually run the embedded server, so external/Cloud
// deployments never export a misleading `embedded_server_up 0`.
type serverMetrics struct {
	embeddedServerUp prometheus.Gauge
}

func newServerMetrics(reg prometheus.Registerer) *serverMetrics {
	m := &serverMetrics{
		embeddedServerUp: prometheus.NewGauge(prometheus.GaugeOpts{
			Namespace: metricsNamespace,
			Subsystem: metricsSubsystem,
			Name:      "embedded_server_up",
			Help:      "Whether the embedded NATS server is running (1 = up, 0 = down).",
		}),
	}

	reg.MustRegister(m.embeddedServerUp)

	return m
}
