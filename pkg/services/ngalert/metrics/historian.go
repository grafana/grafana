package metrics

import (
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promauto"
	"github.com/weaveworks/common/instrument"
)

type Historian struct {
	TransitionsTotal       *prometheus.CounterVec
	TransitionsFailedTotal *prometheus.CounterVec
	WritesTotal            prometheus.Counter
	WritesFailedTotal      prometheus.Counter
	ActiveWriteGoroutines  prometheus.Gauge
	PersistDuration        prometheus.Histogram
	WriteDuration          *instrument.HistogramCollector
}

func NewHistorianMetrics(r prometheus.Registerer) *Historian {
	return &Historian{
		WriteDuration: instrument.NewHistogramCollector(promauto.With(r).NewHistogramVec(prometheus.HistogramOpts{
			Namespace: Namespace,
			Subsystem: Subsystem,
			Name:      "state_history_request_duration_seconds",
			Help:      "Histogram of request durations to the state history store.",
			Buckets:   instrument.DefBuckets,
		}, instrument.HistogramCollectorBuckets)),
		TransitionsTotal: promauto.With(r).NewCounterVec(prometheus.CounterOpts{
			Namespace: Namespace,
			Subsystem: Subsystem,
			Name:      "historian_transitions_total",
			Help:      "The total number of state transitions processed by the state historian.",
		}, []string{"org"}),
		TransitionsFailedTotal: promauto.With(r).NewCounterVec(prometheus.CounterOpts{
			Namespace: Namespace,
			Subsystem: Subsystem,
			Name:      "historian_transitions_failed_total",
			Help:      "The total number of state transitions that failed to be written.",
		}, []string{"org"}),
		WritesTotal: promauto.With(r).NewCounter(prometheus.CounterOpts{
			Namespace: Namespace,
			Subsystem: Subsystem,
			Name:      "historian_batch_writes_total",
			Help:      "The total number of state history batches that were attempted to be written.",
		}),
		WritesFailedTotal: promauto.With(r).NewCounter(prometheus.CounterOpts{
			Namespace: Namespace,
			Subsystem: Subsystem,
			Name:      "historian_batch_writes_failed_total",
			Help:      "The total number of failed writes of state history batches.",
		}),
		ActiveWriteGoroutines: promauto.With(r).NewGauge(prometheus.GaugeOpts{
			Namespace: Namespace,
			Subsystem: Subsystem,
			Name:      "historian_active_write_goroutines",
			Help:      "The current number of active goroutines trying to persist state history data.",
		}),
		PersistDuration: promauto.With(r).NewHistogram(prometheus.HistogramOpts{
			Namespace: Namespace,
			Subsystem: Subsystem,
			Name:      "historian_persist_duration_seconds",
			Help:      "Histogram of write times to the state history store.",
			Buckets:   prometheus.DefBuckets,
		}),
	}
}
