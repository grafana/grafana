package generic

import (
	"strconv"
	"time"

	"github.com/prometheus/client_golang/prometheus"
)

type storageMetrics struct {
	Duration *prometheus.HistogramVec
}

// storageDuration is a metric summary for storage duration
var storageDuration = prometheus.NewHistogramVec(prometheus.HistogramOpts{
	Name:                        "storage_duration_seconds",
	Help:                        "Histogram for the runtime of storage duration",
	Namespace:                   "grafana",
	NativeHistogramBucketFactor: 1.1,
}, []string{"is_error", "resource", "method"})

func (m *storageMetrics) recordStorageDuration(isError bool, resource string, method string, startFrom time.Time) {
	duration := time.Since(startFrom).Seconds()
	m.Duration.WithLabelValues(strconv.FormatBool(isError), resource, method).Observe(duration)
}

func (m *storageMetrics) init() {
	m.Duration = storageDuration

	reg := prometheus.DefaultRegisterer
	reg.MustRegister(m.Duration)
}
