package metrics

import (
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promauto"
	"github.com/weaveworks/common/instrument"
)

type Historian struct {
	Registerer            prometheus.Registerer
	TransitionsTotal      *prometheus.CounterVec
	WriteFailuresTotal    prometheus.Counter
	ActiveWriteGoroutines prometheus.Gauge
	PersistDuration       prometheus.Histogram
	WriteDuration         *instrument.HistogramCollector
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
		Registerer: r,
		TransitionsTotal: promauto.With(r).NewCounterVec(prometheus.CounterOpts{
			Namespace: Namespace,
			Subsystem: Subsystem,
			Name:      "historian_transitions_total",
			Help:      "The total number of state transitions recorded by the state historian.",
		}, []string{"org"}),
		WriteFailuresTotal: promauto.With(r).NewCounter(prometheus.CounterOpts{
			Namespace: Namespace,
			Subsystem: Subsystem,
			Name:      "historian_write_failures_total",
			Help:      "The total number of failed state history writes",
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
