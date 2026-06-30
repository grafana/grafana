package nats

import (
	"github.com/prometheus/client_golang/prometheus"
)

const (
	metricsNamespace = "grafana"
	metricsSubsystem = "nats"
)

// subscriberLabel identifies which logical consumer (e.g. "provisioning-controller")
// a subscription belongs to, so the per-subscriber delivery counters can be told apart.
const subscriberLabel = "subscriber"

// connectionMetrics covers the lifecycle of a single NATS connection. Publisher
// and subscriber each own their own connection, so the role is baked into the
// metric name (grafana_nats_<role>_*) rather than carried as a label.
type connectionMetrics struct {
	connectionStatus prometheus.Gauge
	reconnects       prometheus.Counter
	disconnects      prometheus.Counter
	connectionErrors prometheus.Counter
}

func newConnectionMetrics(role connRole) connectionMetrics {
	prefix := string(role) + "_"
	return connectionMetrics{
		connectionStatus: prometheus.NewGauge(prometheus.GaugeOpts{
			Namespace: metricsNamespace,
			Subsystem: metricsSubsystem,
			Name:      prefix + "connection_status",
			Help:      "Current NATS connection status (1 = connected, 0 = disconnected).",
		}),
		reconnects: prometheus.NewCounter(prometheus.CounterOpts{
			Namespace: metricsNamespace,
			Subsystem: metricsSubsystem,
			Name:      prefix + "reconnects_total",
			Help:      "Total number of NATS reconnections.",
		}),
		disconnects: prometheus.NewCounter(prometheus.CounterOpts{
			Namespace: metricsNamespace,
			Subsystem: metricsSubsystem,
			Name:      prefix + "disconnects_total",
			Help:      "Total number of NATS disconnections.",
		}),
		connectionErrors: prometheus.NewCounter(prometheus.CounterOpts{
			Namespace: metricsNamespace,
			Subsystem: metricsSubsystem,
			Name:      prefix + "connection_errors_total",
			Help:      "Total number of NATS asynchronous connection errors.",
		}),
	}
}

func (m connectionMetrics) collectors() []prometheus.Collector {
	return []prometheus.Collector{m.connectionStatus, m.reconnects, m.disconnects, m.connectionErrors}
}

// publisherMetrics covers the publisher connection plus its publish counters.
type publisherMetrics struct {
	connectionMetrics
	messagesPublished prometheus.Counter
	publishErrors     prometheus.Counter
}

func newPublisherMetrics(reg prometheus.Registerer) *publisherMetrics {
	m := &publisherMetrics{
		connectionMetrics: newConnectionMetrics(rolePublisher),
		messagesPublished: prometheus.NewCounter(prometheus.CounterOpts{
			Namespace: metricsNamespace,
			Subsystem: metricsSubsystem,
			Name:      "publisher_messages_published_total",
			Help:      "Total number of messages published to NATS.",
		}),
		publishErrors: prometheus.NewCounter(prometheus.CounterOpts{
			Namespace: metricsNamespace,
			Subsystem: metricsSubsystem,
			Name:      "publisher_publish_errors_total",
			Help:      "Total number of NATS publish errors.",
		}),
	}

	reg.MustRegister(append(m.connectionMetrics.collectors(), m.messagesPublished, m.publishErrors)...)

	return m
}

// subscriberMetrics covers the subscriber connection plus its delivery counters.
// The delivery counters are keyed by the subscriber identifier so traffic can be
// attributed to the individual consumer that registered the subscription.
type subscriberMetrics struct {
	connectionMetrics
	messagesReceived *prometheus.CounterVec
	subscribeErrors  *prometheus.CounterVec
}

func newSubscriberMetrics(reg prometheus.Registerer) *subscriberMetrics {
	m := &subscriberMetrics{
		connectionMetrics: newConnectionMetrics(roleSubscriber),
		messagesReceived: prometheus.NewCounterVec(prometheus.CounterOpts{
			Namespace: metricsNamespace,
			Subsystem: metricsSubsystem,
			Name:      "subscriber_messages_received_total",
			Help:      "Total number of messages received from NATS per subscriber.",
		}, []string{subscriberLabel}),
		subscribeErrors: prometheus.NewCounterVec(prometheus.CounterOpts{
			Namespace: metricsNamespace,
			Subsystem: metricsSubsystem,
			Name:      "subscriber_subscribe_errors_total",
			Help:      "Total number of NATS subscribe errors per subscriber.",
		}, []string{subscriberLabel}),
	}

	reg.MustRegister(append(m.connectionMetrics.collectors(), m.messagesReceived, m.subscribeErrors)...)

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
