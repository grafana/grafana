package resource

import (
	"sync"
	"time"

	"github.com/grafana/dskit/instrument"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promauto"
)

type StorageMetrics struct {
	WatchEventLatency *prometheus.HistogramVec
	PollerLatency     prometheus.Histogram
}

var (
	storageMetricsInstance *StorageMetrics
	storageMetricsMutex    sync.Mutex
)

// ProvideStorageMetrics returns the StorageMetrics instance using the singleton pattern to avoid duplicate registration
func ProvideStorageMetrics(reg prometheus.Registerer) *StorageMetrics {
	storageMetricsMutex.Lock()
	defer storageMetricsMutex.Unlock()

	if storageMetricsInstance != nil {
		return storageMetricsInstance
	}

	storageMetricsInstance = &StorageMetrics{
		WatchEventLatency: promauto.With(reg).NewHistogramVec(prometheus.HistogramOpts{
			Namespace:                       "storage_server",
			Name:                            "watch_latency_seconds",
			Help:                            "Time (in seconds) spent waiting for watch events to be sent",
			Buckets:                         instrument.DefBuckets,
			NativeHistogramBucketFactor:     1.1, // enable native histograms
			NativeHistogramMaxBucketNumber:  160,
			NativeHistogramMinResetDuration: time.Hour,
		}, []string{"resource"}),
		PollerLatency: promauto.With(reg).NewHistogram(prometheus.HistogramOpts{
			Namespace:                       "storage_server",
			Name:                            "poller_query_latency_seconds",
			Help:                            "poller query latency",
			Buckets:                         instrument.DefBuckets,
			NativeHistogramBucketFactor:     1.1, // enable native histograms
			NativeHistogramMaxBucketNumber:  160,
			NativeHistogramMinResetDuration: time.Hour,
		}),
	}
	return storageMetricsInstance
}
