package resource

import (
	"time"

	"github.com/grafana/dskit/instrument"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promauto"
)

type StorageMetrics struct {
	WatchEventLatency *prometheus.HistogramVec
	PollerLatency     prometheus.Histogram
}

func ProvideStorageMetrics(reg prometheus.Registerer) *StorageMetrics {
	return &StorageMetrics{
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
}

type QOSMetrics struct {
	QueueLength       *prometheus.GaugeVec   // per slug
	DiscardedRequests *prometheus.CounterVec // per slug
	EnqueueDuration   prometheus.Histogram
}

func ProvideQOSMetrics(reg prometheus.Registerer) *QOSMetrics {
	return &QOSMetrics{
		QueueLength: promauto.With(reg).NewGaugeVec(prometheus.GaugeOpts{
			Namespace: "storage_server",
			Name:      "qos_queue_length",
			Help:      "Number of items in the queue",
		}, []string{"slug"}),
		DiscardedRequests: promauto.With(reg).NewCounterVec(prometheus.CounterOpts{
			Namespace: "storage_server",
			Name:      "qos_discarded_requests_total",
			Help:      "Total number of discarded requests",
		}, []string{"slug", "reason"}),
		EnqueueDuration: promauto.With(reg).NewHistogram(prometheus.HistogramOpts{
			Namespace: "storage_server",
			Name:      "qos_enqueue_duration_seconds",
			Help:      "Duration of enqueue operation in seconds",
			Buckets:   prometheus.DefBuckets,
		}),
	}
}
