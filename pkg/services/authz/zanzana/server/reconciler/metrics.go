package reconciler

import (
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promauto"
)

const (
	metricsNamespace = "iam"
	metricsSubSystem = "authz_zanzana_reconciler"
)

type reconcilerMetrics struct {
	namespaceDurationSeconds *prometheus.HistogramVec
	workQueueDepth           prometheus.Gauge
	tuplesWrittenTotal       *prometheus.CounterVec
}

func newReconcilerMetrics(reg prometheus.Registerer) *reconcilerMetrics {
	return &reconcilerMetrics{
		namespaceDurationSeconds: promauto.With(reg).NewHistogramVec(
			prometheus.HistogramOpts{
				Namespace: metricsNamespace,
				Subsystem: metricsSubSystem,
				Name:      "namespace_reconcile_duration_seconds",
				Help:      "Duration of per-namespace reconciliation runs",
				Buckets:   []float64{0.1, 0.5, 1, 5, 10, 30, 60, 120},
			},
			[]string{"status"},
		),
		workQueueDepth: promauto.With(reg).NewGauge(prometheus.GaugeOpts{
			Namespace: metricsNamespace,
			Subsystem: metricsSubSystem,
			Name:      "work_queue_depth",
			Help:      "Number of namespaces currently waiting in the reconciler work queue",
		}),
		tuplesWrittenTotal: promauto.With(reg).NewCounterVec(
			prometheus.CounterOpts{
				Namespace: metricsNamespace,
				Subsystem: metricsSubSystem,
				Name:      "tuples_written_total",
				Help:      "Total number of tuples written to Zanzana by the reconciler",
			},
			[]string{"operation"},
		),
	}
}
