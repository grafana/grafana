package apistore

import (
	"time"

	"github.com/prometheus/client_golang/prometheus"
)

type storageMetrics struct {
	duration *prometheus.HistogramVec
}

// storageDuration is a metric summary for storage duration
var storageDuration = prometheus.NewHistogramVec(prometheus.HistogramOpts{
	Name:                        "storage_duration_seconds",
	Help:                        "Histogram for the runtime of storage duration",
	Namespace:                   "grafana",
	NativeHistogramBucketFactor: 1.1,
}, []string{"is_error", "resource", "method"})

func (m *storageMetrics) recordStorageDuration(resource string, method string, startFrom time.Time) {
	duration := time.Since(startFrom).Seconds()
	m.duration.WithLabelValues(resource, method).Observe(duration)
}

func initMetrics(reg prometheus.Registerer) storageMetrics {
	reg.MustRegister(storageDuration)
	return storageMetrics{
		duration: storageDuration,
	}
}
