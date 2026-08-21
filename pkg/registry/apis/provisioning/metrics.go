package provisioning

import (
	"sync"

	"github.com/prometheus/client_golang/prometheus"
)

// FilesMetrics tracks the size of files served through the provisioning
// files API (GET/POST/PUT/move).
type FilesMetrics struct {
	sizeHist *prometheus.HistogramVec
}

var (
	filesMetricsOnce sync.Once
	filesMetrics     FilesMetrics
)

// RegisterFilesMetrics registers the files API file-size histogram.
func RegisterFilesMetrics(registry prometheus.Registerer) FilesMetrics {
	filesMetricsOnce.Do(func() {
		sizeHist := prometheus.NewHistogramVec(
			prometheus.HistogramOpts{
				Name: "grafana_provisioning_files_size_bytes",
				Help: "Size in bytes of files served through the provisioning files API",
				// 128B -> 4MB, matching the byte-bucket convention used elsewhere in Grafana
				// (e.g. pkg/middleware/request_metrics.go).
				Buckets: prometheus.ExponentialBuckets(128, 2, 16),
			},
			// operation matches the label used by resources.ResourceMetrics (read/write) so
			// file sizes can be compared across the API and job-execution paths.
			[]string{"operation"},
		)
		registry.MustRegister(sizeHist)

		filesMetrics = FilesMetrics{
			sizeHist: sizeHist,
		}
	})
	return filesMetrics
}

// RecordFileSize observes a file size for the given operation ("read" or
// "write"). Nil-safe so a filesConnector built without metrics does not panic.
func (m *FilesMetrics) RecordFileSize(operation string, sizeBytes int) {
	if m == nil || m.sizeHist == nil {
		return
	}
	m.sizeHist.WithLabelValues(operation).Observe(float64(sizeBytes))
}
