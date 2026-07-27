package annotation

import (
	"time"

	"github.com/grafana/dskit/instrument"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promauto"
)

const (
	metricsNamespace = "grafana"
	metricsSubsystem = "annotations"
)

// Metrics groups every Prometheus collector exposed by the annotations service.
type Metrics struct {
	RequestDuration        *prometheus.HistogramVec
	StoreOperationDuration *prometheus.HistogramVec

	CleanupDuration    prometheus.Histogram
	CleanupRuns        *prometheus.CounterVec
	CleanupRowsDeleted prometheus.Counter

	TagCacheHits   prometheus.Counter
	TagCacheMisses prometheus.Counter
}

// ProvideMetrics builds and registers the metrics collectors
func ProvideMetrics(reg prometheus.Registerer) *Metrics {
	if reg == nil {
		reg = prometheus.NewRegistry()
	}
	f := promauto.With(reg)
	return &Metrics{
		RequestDuration: f.NewHistogramVec(prometheus.HistogramOpts{
			Namespace:                       metricsNamespace,
			Subsystem:                       metricsSubsystem,
			Name:                            "request_duration_seconds",
			Help:                            "Time spent serving annotations API requests.",
			Buckets:                         instrument.DefBuckets,
			NativeHistogramBucketFactor:     1.1,
			NativeHistogramMaxBucketNumber:  160,
			NativeHistogramMinResetDuration: time.Hour,
		}, []string{"operation", "status"}),
		StoreOperationDuration: f.NewHistogramVec(prometheus.HistogramOpts{
			Namespace:                       metricsNamespace,
			Subsystem:                       metricsSubsystem,
			Name:                            "store_operation_duration_seconds",
			Help:                            "Time spent in the storage backend serving annotation operations.",
			Buckets:                         instrument.DefBuckets,
			NativeHistogramBucketFactor:     1.1,
			NativeHistogramMaxBucketNumber:  160,
			NativeHistogramMinResetDuration: time.Hour,
		}, []string{"operation", "status"}),
		CleanupDuration: f.NewHistogram(prometheus.HistogramOpts{
			Namespace:                       metricsNamespace,
			Subsystem:                       metricsSubsystem,
			Name:                            "cleanup_duration_seconds",
			Help:                            "Time of each successful cleanup loop iteration. Failures are excluded so the timeout ceiling does not pin p99 during incidents (see cleanup_runs_total).",
			Buckets:                         []float64{1, 5, 15, 30, 60, 120, 240, 300},
			NativeHistogramBucketFactor:     1.1,
			NativeHistogramMaxBucketNumber:  160,
			NativeHistogramMinResetDuration: time.Hour,
		}),
		CleanupRuns: f.NewCounterVec(prometheus.CounterOpts{
			Namespace: metricsNamespace,
			Subsystem: metricsSubsystem,
			Name:      "cleanup_runs_total",
			Help:      "Cumulative number of cleanup loop runs by outcome.",
		}, []string{"result"}),
		CleanupRowsDeleted: f.NewCounter(prometheus.CounterOpts{
			Namespace: metricsNamespace,
			Subsystem: metricsSubsystem,
			Name:      "cleanup_rows_deleted_total",
			Help:      "Cumulative number of annotation rows removed by the cleanup loop.",
		}),
		TagCacheHits: f.NewCounter(prometheus.CounterOpts{
			Namespace: metricsNamespace,
			Subsystem: metricsSubsystem,
			Name:      "tag_cache_hits_total",
			Help:      "Cumulative number of tag cache hits in the postgres backend.",
		}),
		TagCacheMisses: f.NewCounter(prometheus.CounterOpts{
			Namespace: metricsNamespace,
			Subsystem: metricsSubsystem,
			Name:      "tag_cache_misses_total",
			Help:      "Cumulative number of tag cache misses in the postgres backend.",
		}),
	}
}

type pgxPoolCollector struct {
	pool *pgxpool.Pool

	acquiredConns     *prometheus.Desc
	idleConns         *prometheus.Desc
	totalConns        *prometheus.Desc
	acquireCount      *prometheus.Desc
	emptyAcquireCount *prometheus.Desc
}

func newPgxPoolCollector(pool *pgxpool.Pool) *pgxPoolCollector {
	d := func(name, help string) *prometheus.Desc {
		return prometheus.NewDesc(prometheus.BuildFQName(metricsNamespace, metricsSubsystem, name), help, nil, nil)
	}
	return &pgxPoolCollector{
		pool:              pool,
		acquiredConns:     d("pgxpool_acquired_conns", "Number of currently acquired connections in the pool."),
		idleConns:         d("pgxpool_idle_conns", "Number of currently idle connections in the pool."),
		totalConns:        d("pgxpool_total_conns", "Total number of resources currently in the pool."),
		acquireCount:      d("pgxpool_acquire_total", "Cumulative count of successful acquires from the pool."),
		emptyAcquireCount: d("pgxpool_empty_acquire_total", "Cumulative count of acquires that had to wait for a connection."),
	}
}

func (c *pgxPoolCollector) Describe(ch chan<- *prometheus.Desc) {
	ch <- c.acquiredConns
	ch <- c.idleConns
	ch <- c.totalConns
	ch <- c.acquireCount
	ch <- c.emptyAcquireCount
}

func (c *pgxPoolCollector) Collect(ch chan<- prometheus.Metric) {
	s := c.pool.Stat()
	ch <- prometheus.MustNewConstMetric(c.acquiredConns, prometheus.GaugeValue, float64(s.AcquiredConns()))
	ch <- prometheus.MustNewConstMetric(c.idleConns, prometheus.GaugeValue, float64(s.IdleConns()))
	ch <- prometheus.MustNewConstMetric(c.totalConns, prometheus.GaugeValue, float64(s.TotalConns()))
	ch <- prometheus.MustNewConstMetric(c.acquireCount, prometheus.CounterValue, float64(s.AcquireCount()))
	ch <- prometheus.MustNewConstMetric(c.emptyAcquireCount, prometheus.CounterValue, float64(s.EmptyAcquireCount()))
}
