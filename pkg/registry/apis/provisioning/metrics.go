package provisioning

import (
	"sync"
	"time"

	"github.com/prometheus/client_golang/prometheus"
)

// FilesMetrics tracks files served through the provisioning files API
// (GET/POST/PUT/move): their size, how long the read/write took, and how
// many succeeded or failed.
//
// Read and write share one metric family per dimension (labeled "operation",
// matching resources.ResourceMetrics) rather than separate metric names, so
// file sizes/durations can be compared across the API and job-execution
// paths with a single query.
type FilesMetrics struct {
	sizeHist     *prometheus.HistogramVec // operation
	durationHist *prometheus.HistogramVec // operation
	opsTotal     *prometheus.CounterVec   // operation, outcome
}

var (
	filesMetricsOnce sync.Once
	filesMetrics     FilesMetrics
)

// RegisterFilesMetrics registers the files API read/write metrics.
func RegisterFilesMetrics(registry prometheus.Registerer) FilesMetrics {
	filesMetricsOnce.Do(func() {
		sizeHist := prometheus.NewHistogramVec(
			prometheus.HistogramOpts{
				Name: "grafana_provisioning_files_size_bytes",
				Help: "Size in bytes of files served through the provisioning files API",
				// 128B -> 64MB. Deliberately well above ProvisioningMaxFileSizeDefault (5MiB)
				// so the configured cap sits mid-histogram instead of at the +Inf edge.
				Buckets: prometheus.ExponentialBuckets(128, 2, 20),
			},
			[]string{"operation"},
		)
		registry.MustRegister(sizeHist)

		durationHist := prometheus.NewHistogramVec(
			prometheus.HistogramOpts{
				Name:    "grafana_provisioning_files_duration_seconds",
				Help:    "Duration of read/write operations against the provisioning files API",
				Buckets: prometheus.ExponentialBucketsRange(0.001, 30, 10), // 1ms -> 30s
			},
			[]string{"operation"},
		)
		registry.MustRegister(durationHist)

		opsTotal := prometheus.NewCounterVec(
			prometheus.CounterOpts{
				Name: "grafana_provisioning_files_operations_total",
				Help: "Total read/write operations against the provisioning files API, by outcome",
			},
			[]string{"operation", "outcome"},
		)
		registry.MustRegister(opsTotal)

		filesMetrics = FilesMetrics{
			sizeHist:     sizeHist,
			durationHist: durationHist,
			opsTotal:     opsTotal,
		}
	})
	return filesMetrics
}

// RecordFileRead observes a files-API read: its duration, outcome, and (on
// success) the size of the data read.
func (m *FilesMetrics) RecordFileRead(sizeBytes int, duration time.Duration, err error) {
	m.record("read", sizeBytes, duration, err)
}

// RecordFileWrite observes a files-API write: its duration, outcome, and (on
// success) the size of the data written.
func (m *FilesMetrics) RecordFileWrite(sizeBytes int, duration time.Duration, err error) {
	m.record("write", sizeBytes, duration, err)
}

// record is nil-safe so a filesConnector built without metrics does not panic.
func (m *FilesMetrics) record(operation string, sizeBytes int, duration time.Duration, err error) {
	if m == nil {
		return
	}

	outcome := "success"
	if err != nil {
		outcome = "error"
	}

	if m.opsTotal != nil {
		m.opsTotal.WithLabelValues(operation, outcome).Inc()
	}
	if m.durationHist != nil {
		m.durationHist.WithLabelValues(operation).Observe(duration.Seconds())
	}
	// Size is only meaningful once the data is actually known good; a failed
	// read/write has no reliable size and would otherwise skew the low end of
	// the histogram with zeroes.
	if err == nil && m.sizeHist != nil {
		m.sizeHist.WithLabelValues(operation).Observe(float64(sizeBytes))
	}
}
