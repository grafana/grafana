package nats

import (
	"time"

	natsclient "github.com/nats-io/nats.go"
	"github.com/prometheus/client_golang/prometheus"
)

const (
	metricsNamespace = "grafana"
	metricsSubsystem = "nats"
)

// connectionMetrics covers the lifecycle of a single NATS connection. Publisher
// and subscriber each own their own connection, so the role is baked into the
// metric name (grafana_nats_<role>_*) rather than carried as a label.
type connectionMetrics struct {
	connectionStatus    prometheus.Gauge
	reconnects          prometheus.Counter
	disconnects         prometheus.Counter
	connectionErrors    prometheus.Counter
	disconnectedSeconds prometheus.Histogram
	asyncErrors         *prometheus.CounterVec
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
			Help:      "Total number of failed NATS connect attempts.",
		}),
		// Observed when the connection is re-established: the length of each outage
		// is exactly the window during which this node relies on the polling
		// fallback rather than NATS push, so the histogram tracks degraded time.
		disconnectedSeconds: prometheus.NewHistogram(prometheus.HistogramOpts{
			Namespace: metricsNamespace,
			Subsystem: metricsSubsystem,
			Name:      prefix + "disconnected_seconds",
			Help:      "Duration of NATS disconnections, observed when the connection reconnects.",
			Buckets:   []float64{0.5, 1, 2, 5, 10, 30, 60, 120, 300},
		}),
		asyncErrors: prometheus.NewCounterVec(prometheus.CounterOpts{
			Namespace: metricsNamespace,
			Subsystem: metricsSubsystem,
			Name:      prefix + "async_errors_total",
			Help:      "NATS asynchronous errors reported on the connection, by group, resource and classified error.",
		}, []string{"group", "resource", "error"}),
	}
}

func (m connectionMetrics) recordAsyncError(sub *natsclient.Subscription, err error) {
	if err == nil {
		return
	}
	m.asyncErrors.WithLabelValues(asyncErrorLabels(sub, err)).Inc()
}

func (m connectionMetrics) collectors() []prometheus.Collector {
	return []prometheus.Collector{m.connectionStatus, m.reconnects, m.disconnects, m.connectionErrors, m.disconnectedSeconds, m.asyncErrors}
}

// publisherMetrics covers the publisher connection plus its publish counters.
type publisherMetrics struct {
	connectionMetrics
	messagesAccepted prometheus.Counter
	publishErrors    prometheus.Counter
}

func newPublisherMetrics() *publisherMetrics {
	return &publisherMetrics{
		connectionMetrics: newConnectionMetrics(rolePublisher),
		messagesAccepted: prometheus.NewCounter(prometheus.CounterOpts{
			Namespace: metricsNamespace,
			Subsystem: metricsSubsystem,
			Name:      "publisher_messages_accepted_total",
			Help:      "Total number of messages accepted by the local NATS client; this is not subscriber delivery.",
		}),
		publishErrors: prometheus.NewCounter(prometheus.CounterOpts{
			Namespace: metricsNamespace,
			Subsystem: metricsSubsystem,
			Name:      "publisher_publish_errors_total",
			Help:      "Total number of local NATS publish failures, before subscriber delivery.",
		}),
	}
}

func (m *publisherMetrics) collectors() []prometheus.Collector {
	return append(m.connectionMetrics.collectors(), m.messagesAccepted, m.publishErrors)
}

// subscriberMetrics covers the subscriber connection plus its delivery counters.
type subscriberMetrics struct {
	connectionMetrics
	messagesReceived prometheus.Counter
	subscribeErrors  prometheus.Counter
	handlerDuration  prometheus.Histogram
}

func newSubscriberMetrics() *subscriberMetrics {
	return &subscriberMetrics{
		connectionMetrics: newConnectionMetrics(roleSubscriber),
		messagesReceived: prometheus.NewCounter(prometheus.CounterOpts{
			Namespace: metricsNamespace,
			Subsystem: metricsSubsystem,
			Name:      "subscriber_messages_received_total",
			Help:      "Total number of messages received from NATS.",
		}),
		subscribeErrors: prometheus.NewCounter(prometheus.CounterOpts{
			Namespace: metricsNamespace,
			Subsystem: metricsSubsystem,
			Name:      "subscriber_subscribe_errors_total",
			Help:      "Total number of NATS subscribe errors.",
		}),
		// Time spent in the message handler, the leading indicator of a slow
		// consumer: a handler that lags lets the client-side buffer fill until the
		// broker drops messages (asyncErrors, error="slow_consumer").
		handlerDuration: prometheus.NewHistogram(prometheus.HistogramOpts{
			Namespace: metricsNamespace,
			Subsystem: metricsSubsystem,
			Name:      "subscriber_handler_duration_seconds",
			Help:      "Time spent processing a received message in the subscriber handler.",
			Buckets:   prometheus.DefBuckets,
		}),
	}
}

func (m *subscriberMetrics) collectors() []prometheus.Collector {
	return append(m.connectionMetrics.collectors(), m.messagesReceived, m.subscribeErrors, m.handlerDuration)
}

// serverMetrics covers the embedded NATS server. It is registered only in
// environments that actually run the embedded server, so external/Cloud
// deployments never export a misleading `embedded_server_up 0`.
type serverMetrics struct {
	embeddedServerUp       prometheus.Gauge
	embeddedServerRoutes   prometheus.GaugeFunc
	discoveryWakesReceived prometheus.Counter
}

// routedPeers is read at scrape time, so the gauge follows routes that fail or
// drop between discovery reconciles.
func newServerMetrics(reg prometheus.Registerer, routedPeers func() int) *serverMetrics {
	m := &serverMetrics{
		embeddedServerUp: prometheus.NewGauge(prometheus.GaugeOpts{
			Namespace: metricsNamespace,
			Subsystem: metricsSubsystem,
			Name:      "embedded_server_up",
			Help:      "Whether the embedded NATS server is running (1 = up, 0 = down).",
		}),
		embeddedServerRoutes: prometheus.NewGaugeFunc(prometheus.GaugeOpts{
			Name: "grafana_nats_embedded_server_routes",
			Help: "Number of other instances the embedded NATS server has an established cluster route to. Instances minus one when the cluster is fully connected.",
		}, func() float64 { return float64(routedPeers()) }),
		discoveryWakesReceived: prometheus.NewCounter(prometheus.CounterOpts{
			Namespace: metricsNamespace,
			Subsystem: metricsSubsystem,
			Name:      "discovery_wakes_received_total",
			Help:      "Total number of wake hints received from peers leaving the cluster.",
		}),
	}

	reg.MustRegister(m.embeddedServerUp, m.embeddedServerRoutes, m.discoveryWakesReceived)

	return m
}

func (m *serverMetrics) recordDiscoveryWake() {
	m.discoveryWakesReceived.Inc()
}

// clusterTLSMetrics covers certificate reloads. It is registered only when
// cluster TLS is configured.
type clusterTLSMetrics struct {
	reloadFailures    *prometheus.CounterVec
	lastReloadSuccess prometheus.Gauge
}

func newClusterTLSMetrics(reg prometheus.Registerer) *clusterTLSMetrics {
	m := &clusterTLSMetrics{
		reloadFailures: prometheus.NewCounterVec(prometheus.CounterOpts{
			Namespace: metricsNamespace,
			Subsystem: metricsSubsystem,
			Name:      "cluster_tls_reload_failures_total",
			Help:      "Failed checks of the cluster TLS certificate files, by reason (read, invalid, apply). The last valid certificates stay in use.",
		}, []string{"reason"}),
		lastReloadSuccess: prometheus.NewGauge(prometheus.GaugeOpts{
			Namespace: metricsNamespace,
			Subsystem: metricsSubsystem,
			Name:      "cluster_tls_last_reload_success_timestamp_seconds",
			Help:      "Unix time of the last successful cluster TLS certificate load, at startup or on reload.",
		}),
	}
	// Export every reason from the start so rate() sees the first failure.
	for _, reason := range []string{clusterTLSReasonRead, clusterTLSReasonInvalid, clusterTLSReasonApply} {
		m.reloadFailures.WithLabelValues(reason)
	}

	reg.MustRegister(m.reloadFailures, m.lastReloadSuccess)

	return m
}

func (m *clusterTLSMetrics) recordReloadFailure(reason string) {
	m.reloadFailures.WithLabelValues(reason).Inc()
}

func (m *clusterTLSMetrics) recordReloadSuccess(at time.Time) {
	m.lastReloadSuccess.Set(float64(at.Unix()))
}
