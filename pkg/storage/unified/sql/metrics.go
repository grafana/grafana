package sql

import (
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promauto"
)

type QOSMetrics struct {
	QueueLength       *prometheus.GaugeVec
	DiscardedRequests *prometheus.CounterVec
	EnqueueDuration   prometheus.Histogram
}

func ProvideQOSMetrics(reg prometheus.Registerer) *QOSMetrics {
	return &QOSMetrics{
		QueueLength: promauto.With(reg).NewGaugeVec(prometheus.GaugeOpts{
			Namespace: "storage_server",
			Name:      "qos_queue_length",
			Help:      "Number of items in the queue",
		}, []string{"namespace"}),
		DiscardedRequests: promauto.With(reg).NewCounterVec(prometheus.CounterOpts{
			Namespace: "storage_server",
			Name:      "qos_discarded_requests_total",
			Help:      "Total number of discarded requests",
		}, []string{"namespace", "reason"}),
		EnqueueDuration: promauto.With(reg).NewHistogram(prometheus.HistogramOpts{
			Namespace: "storage_server",
			Name:      "qos_enqueue_duration_seconds",
			Help:      "Duration of enqueue operation in seconds",
			Buckets:   prometheus.DefBuckets,
		}),
	}
}
