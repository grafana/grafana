package resource

import (
	"sync"
	"time"

	"github.com/grafana/dskit/instrument"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promauto"
)

type BleveIndexMetrics struct {
	IndexLatency      *prometheus.HistogramVec
	IndexSize         prometheus.Gauge
	IndexedKinds      *prometheus.GaugeVec
	IndexCreationTime *prometheus.HistogramVec
	IndexTenants      *prometheus.CounterVec
}

var IndexCreationBuckets = []float64{1, 5, 10, 25, 50, 75, 100, 200, 300, 400, 500, 600, 700, 800, 900, 1000}

var (
	bleveIndexMetricsInstance *BleveIndexMetrics
	bleveIndexMetricsMutex    sync.Mutex
)

// ProvideIndexMetrics returns the BleveIndexMetrics instance using the singleton pattern to avoid duplicate registration
func ProvideIndexMetrics(reg prometheus.Registerer) *BleveIndexMetrics {
	bleveIndexMetricsMutex.Lock()
	defer bleveIndexMetricsMutex.Unlock()

	if bleveIndexMetricsInstance != nil {
		return bleveIndexMetricsInstance
	}

	bleveIndexMetricsInstance = &BleveIndexMetrics{
		IndexLatency: promauto.With(reg).NewHistogramVec(prometheus.HistogramOpts{
			Namespace:                       "index_server",
			Name:                            "index_latency_seconds",
			Help:                            "Time (in seconds) until index is updated with new event",
			Buckets:                         instrument.DefBuckets,
			NativeHistogramBucketFactor:     1.1, // enable native histograms
			NativeHistogramMaxBucketNumber:  160,
			NativeHistogramMinResetDuration: time.Hour,
		}, []string{"resource"}),
		IndexSize: promauto.With(reg).NewGauge(prometheus.GaugeOpts{
			Namespace: "index_server",
			Name:      "index_size",
			Help:      "Size of the index in bytes - only for file-based indices",
		}),
		IndexedKinds: promauto.With(reg).NewGaugeVec(prometheus.GaugeOpts{
			Namespace: "index_server",
			Name:      "indexed_kinds",
			Help:      "Number of indexed documents by kind",
		}, []string{"kind"}),
		IndexCreationTime: promauto.With(reg).NewHistogramVec(prometheus.HistogramOpts{
			Namespace:                       "index_server",
			Name:                            "index_creation_time_seconds",
			Help:                            "Time (in seconds) it takes until index is created",
			Buckets:                         IndexCreationBuckets,
			NativeHistogramBucketFactor:     1.1, // enable native histograms
			NativeHistogramMaxBucketNumber:  160,
			NativeHistogramMinResetDuration: time.Hour,
		}, []string{}),
		IndexTenants: promauto.With(reg).NewCounterVec(prometheus.CounterOpts{
			Namespace: "index_server",
			Name:      "index_tenants",
			Help:      "Number of tenants in the index",
		}, []string{"index_storage"}), // index_storage is either "file" or "memory"
	}
	return bleveIndexMetricsInstance
}
