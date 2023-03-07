package metrics

import (
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promauto"
	"github.com/weaveworks/common/instrument"
)

type Historian struct {
	Info              *prometheus.GaugeVec
	TransitionsTotal  *prometheus.CounterVec
	TransitionsFailed *prometheus.CounterVec
	WritesTotal       *prometheus.CounterVec
	WritesFailed      *prometheus.CounterVec
	WriteDuration     *instrument.HistogramCollector
	BytesWritten      prometheus.Counter
}

func NewHistorianMetrics(r prometheus.Registerer) *Historian {
	return &Historian{
		Info: promauto.With(r).NewGaugeVec(prometheus.GaugeOpts{
			Namespace: Namespace,
			Subsystem: Subsystem,
			Name:      "state_history_info",
			Help:      "Information about the state history store.",
		}, []string{"backend"}),
		TransitionsTotal: promauto.With(r).NewCounterVec(prometheus.CounterOpts{
			Namespace: Namespace,
			Subsystem: Subsystem,
			Name:      "state_history_transitions_total",
			Help:      "The total number of state transitions processed.",
		}, []string{"org"}),
		TransitionsFailed: promauto.With(r).NewCounterVec(prometheus.CounterOpts{
			Namespace: Namespace,
			Subsystem: Subsystem,
			Name:      "state_history_transitions_failed_total",
			Help:      "The total number of state transitions that failed to be written - they are not retried.",
		}, []string{"org"}),
		WritesTotal: promauto.With(r).NewCounterVec(prometheus.CounterOpts{
			Namespace: Namespace,
			Subsystem: Subsystem,
			Name:      "state_history_writes_total",
			Help:      "The total number of state history batches that were attempted to be written.",
		}, []string{"org"}),
		WritesFailed: promauto.With(r).NewCounterVec(prometheus.CounterOpts{
			Namespace: Namespace,
			Subsystem: Subsystem,
			Name:      "state_history_writes_failed_total",
			Help:      "The total number of failed writes of state history batches.",
		}, []string{"org"}),
		WriteDuration: instrument.NewHistogramCollector(promauto.With(r).NewHistogramVec(prometheus.HistogramOpts{
			Namespace: Namespace,
			Subsystem: Subsystem,
			Name:      "state_history_request_duration_seconds",
			Help:      "Histogram of request durations to the state history store. Only valid when using external stores.",
			Buckets:   instrument.DefBuckets,
		}, instrument.HistogramCollectorBuckets)),
		BytesWritten: promauto.With(r).NewCounter(prometheus.CounterOpts{
			Namespace: Namespace,
			Subsystem: Subsystem,
			Name:      "state_history_writes_bytes_total",
			Help:      "The total number of bytes sent within a batch to the state history store. Only valid when using the Loki store.",
		}),
	}
}
