package metrics

import (
	"github.com/grafana/dskit/instrument"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promauto"
)

type EvalHistorian struct {
	Info          prometheus.Gauge
	WritesTotal   *prometheus.CounterVec
	WritesFailed  *prometheus.CounterVec
	WriteDuration *instrument.HistogramCollector
	BytesWritten  prometheus.Counter
}

func NewEvalHistorianMetrics(r prometheus.Registerer, subsystem string) *EvalHistorian {
	return &EvalHistorian{
		Info: promauto.With(r).NewGauge(prometheus.GaugeOpts{
			Namespace: Namespace,
			Subsystem: subsystem,
			Name:      "eval_history_info",
			Help:      "Information about the evaluation history store.",
		}),
		WritesTotal: promauto.With(r).NewCounterVec(prometheus.CounterOpts{
			Namespace: Namespace,
			Subsystem: subsystem,
			Name:      "eval_history_writes_total",
			Help:      "The total number of evaluation history batches that were attempted to be written.",
		}, []string{"org"}),
		WritesFailed: promauto.With(r).NewCounterVec(prometheus.CounterOpts{
			Namespace: Namespace,
			Subsystem: subsystem,
			Name:      "eval_history_writes_failed_total",
			Help:      "The total number of failed writes of evaluation history batches.",
		}, []string{"org"}),
		WriteDuration: instrument.NewHistogramCollector(promauto.With(r).NewHistogramVec(prometheus.HistogramOpts{
			Namespace: Namespace,
			Subsystem: subsystem,
			Name:      "eval_history_request_duration_seconds",
			Help:      "Histogram of request durations to the evaluation history store. Only valid when using external stores.",
			Buckets:   instrument.DefBuckets,
		}, instrument.HistogramCollectorBuckets)),
		BytesWritten: promauto.With(r).NewCounter(prometheus.CounterOpts{
			Namespace: Namespace,
			Subsystem: subsystem,
			Name:      "eval_history_writes_bytes_total",
			Help:      "The total number of bytes sent within a batch to the evaluation history store. Only valid when using the Loki store.",
		}),
	}
}
