package resources

import (
	"sync"

	"github.com/prometheus/client_golang/prometheus"
)

// ResourceMetrics tracks the size of resource files as they are read from or
// written to a repository during provisioning job execution (sync, export).
type ResourceMetrics struct {
	fileSizeHist *prometheus.HistogramVec
}

var (
	resourceMetricsOnce sync.Once
	resourceMetrics     ResourceMetrics
)

// RegisterResourceMetrics registers the resource file-size histogram.
func RegisterResourceMetrics(registry prometheus.Registerer) ResourceMetrics {
	resourceMetricsOnce.Do(func() {
		fileSizeHist := prometheus.NewHistogramVec(
			prometheus.HistogramOpts{
				Name: "grafana_provisioning_resource_file_size_bytes",
				Help: "Size in bytes of resource files read from or written to a repository during provisioning job execution",
				// 128B -> 4MB, matching the byte-bucket convention used elsewhere in Grafana
				// (e.g. pkg/middleware/request_metrics.go).
				Buckets: prometheus.ExponentialBuckets(128, 2, 16),
			},
			[]string{"operation"},
		)
		registry.MustRegister(fileSizeHist)

		resourceMetrics = ResourceMetrics{
			fileSizeHist: fileSizeHist,
		}
	})
	return resourceMetrics
}

// RecordFileSize observes a file size for the given operation ("read" or
// "write"). Nil-safe so a ResourcesManager built without metrics does not panic.
func (m *ResourceMetrics) RecordFileSize(operation string, sizeBytes int) {
	if m == nil || m.fileSizeHist == nil {
		return
	}
	m.fileSizeHist.WithLabelValues(operation).Observe(float64(sizeBytes))
}
