package metrics

import (
	"sync"

	"github.com/prometheus/client_golang/prometheus"
)

const (
	namespace = "grafana_secrets_manager"
	subsystem = "outbox_storage"
)

// SecretsMetrics is a struct that contains all the metrics for an implementation of the secrets service.
type SecretsMetrics struct {
	OutboxAppendDuration                *prometheus.HistogramVec
	OutboxReceiveDuration               prometheus.Histogram
	OutboxAppendCount                   *prometheus.CounterVec
	OutboxReceiveCount                  prometheus.Counter
	OutboxDeleteDuration                prometheus.Histogram
	OutboxDeleteCount                   prometheus.Counter
	OutboxIncrementReceiveCountDuration prometheus.Histogram
	OutboxIncrementReceiveCountCount    prometheus.Counter
	OutboxTotalMessageLifetimeDuration  *prometheus.HistogramVec
}

func newSecretsMetrics() *SecretsMetrics {
	return &SecretsMetrics{
		// Outbox metrics
		OutboxAppendDuration: prometheus.NewHistogramVec(prometheus.HistogramOpts{
			Namespace: namespace,
			Subsystem: subsystem,
			Name:      "outbox_append_duration_seconds",
			Help:      "Duration of outbox message append operations",
			Buckets:   prometheus.DefBuckets,
		}, []string{"message_type"}),
		OutboxAppendCount: prometheus.NewCounterVec(prometheus.CounterOpts{
			Namespace: namespace,
			Subsystem: subsystem,
			Name:      "outbox_append_count",
			Help:      "Count of outbox message append operations",
		}, []string{"message_type"}),
		OutboxReceiveDuration: prometheus.NewHistogram(prometheus.HistogramOpts{
			Namespace: namespace,
			Subsystem: subsystem,
			Name:      "outbox_receive_duration_seconds",
			Help:      "Duration of outbox message receive operations",
			Buckets:   prometheus.DefBuckets,
		}),
		OutboxReceiveCount: prometheus.NewCounter(prometheus.CounterOpts{
			Namespace: namespace,
			Subsystem: subsystem,
			Name:      "outbox_receive_count",
			Help:      "Count of outbox message receive operations",
		}),
		OutboxDeleteDuration: prometheus.NewHistogram(prometheus.HistogramOpts{
			Namespace: namespace,
			Subsystem: subsystem,
			Name:      "outbox_delete_duration_seconds",
			Help:      "Duration of outbox message delete operations",
			Buckets:   prometheus.DefBuckets,
		}),
		OutboxDeleteCount: prometheus.NewCounter(prometheus.CounterOpts{
			Namespace: namespace,
			Subsystem: subsystem,
			Name:      "outbox_delete_count",
			Help:      "Count of outbox message delete operations",
		}),
		OutboxIncrementReceiveCountDuration: prometheus.NewHistogram(prometheus.HistogramOpts{
			Namespace: namespace,
			Subsystem: subsystem,
			Name:      "outbox_increment_receive_count_duration_seconds",
			Help:      "Duration of outbox message increment receive count operations",
			Buckets:   prometheus.DefBuckets,
		}),
		OutboxIncrementReceiveCountCount: prometheus.NewCounter(prometheus.CounterOpts{
			Namespace: namespace,
			Subsystem: subsystem,
			Name:      "outbox_increment_receive_count_count",
			Help:      "Count of outbox message increment receive count operations",
		}),
		OutboxTotalMessageLifetimeDuration: prometheus.NewHistogramVec(prometheus.HistogramOpts{
			Namespace: namespace,
			Subsystem: subsystem,
			Name:      "outbox_total_message_lifetime_duration_seconds",
			Help:      "Total duration of outbox message lifetime",
			Buckets:   prometheus.DefBuckets,
		}, []string{"message_type"}),

		// Keeper metrics

		// Secure value metrics

		// Decrypt metrics
	}
}

var (
	initOnce        sync.Once
	metricsInstance *SecretsMetrics
)

// NewStorageMetrics returns a singleton instance of the SecretsMetrics struct containing registered metrics
func NewStorageMetrics(reg prometheus.Registerer) *SecretsMetrics {
	initOnce.Do(func() {
		m := newSecretsMetrics()

		if reg != nil {
			reg.MustRegister(
				m.OutboxAppendDuration,
			)
		}

		metricsInstance = m
	})

	return metricsInstance
}

func NewTestMetrics() *SecretsMetrics {
	return newSecretsMetrics()
}
