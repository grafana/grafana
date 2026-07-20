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
	namespaceDurationSeconds       *prometheus.HistogramVec
	workQueueDepth                 prometheus.Gauge
	tuplesWrittenTotal             *prometheus.CounterVec
	isLeader                       prometheus.Gauge
	ensureNamespaceDurationSeconds *prometheus.HistogramVec
	crdFetchDurationSeconds        *prometheus.HistogramVec
	diffTuples                     *prometheus.HistogramVec
	expectedTuples                 prometheus.Histogram
	batchFailuresTotal             prometheus.Counter
	errorsTotal                    *prometheus.CounterVec
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

		isLeader: promauto.With(reg).NewGauge(prometheus.GaugeOpts{
			Namespace: metricsNamespace,
			Subsystem: metricsSubSystem,
			Name:      "is_leader",
			Help:      "Whether this instance currently holds the reconciler leader lease (1=leader, 0=follower)",
		}),

		ensureNamespaceDurationSeconds: promauto.With(reg).NewHistogramVec(
			prometheus.HistogramOpts{
				Namespace: metricsNamespace,
				Subsystem: metricsSubSystem,
				Name:      "ensure_namespace_duration_seconds",
				Help:      "Duration of EnsureNamespace calls by status (existing=already reconciled, reconciled=synced tuples, waited=piggybacked on another call, error=failed)",
				Buckets:   []float64{0.001, 0.01, 0.05, 0.1, 0.5, 1, 5, 10},
			},
			[]string{"status"},
		),
		crdFetchDurationSeconds: promauto.With(reg).NewHistogramVec(
			prometheus.HistogramOpts{
				Namespace: metricsNamespace,
				Subsystem: metricsSubSystem,
				Name:      "crd_fetch_duration_seconds",
				Help:      "Duration of fetching and translating CRDs per resource type",
				Buckets:   []float64{0.05, 0.1, 0.5, 1, 5, 10, 30},
			},
			[]string{"resource"},
		),

		diffTuples: promauto.With(reg).NewHistogramVec(
			prometheus.HistogramOpts{
				Namespace: metricsNamespace,
				Subsystem: metricsSubSystem,
				Name:      "diff_tuples",
				Help:      "Number of tuples in the reconciliation diff per direction",
				Buckets:   []float64{1, 5, 10, 50, 100, 500, 1000, 5000},
			},
			[]string{"direction"},
		),
		expectedTuples: promauto.With(reg).NewHistogram(prometheus.HistogramOpts{
			Namespace: metricsNamespace,
			Subsystem: metricsSubSystem,
			Name:      "expected_tuples",
			Help:      "Total expected tuple count per namespace reconciliation",
			Buckets:   []float64{10, 50, 100, 500, 1000, 5000, 10000, 50000},
		}),
		batchFailuresTotal: promauto.With(reg).NewCounter(prometheus.CounterOpts{
			Namespace: metricsNamespace,
			Subsystem: metricsSubSystem,
			Name:      "batch_failures_total",
			Help:      "Total number of failed tuple write batches",
		}),

		errorsTotal: promauto.With(reg).NewCounterVec(
			prometheus.CounterOpts{
				Namespace: metricsNamespace,
				Subsystem: metricsSubSystem,
				Name:      "errors_total",
				Help:      "Total reconciler errors by phase",
			},
			[]string{"phase"},
		),
	}
}
