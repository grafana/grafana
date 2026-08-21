package resources

import (
	"sync"
	"time"

	"github.com/prometheus/client_golang/prometheus"
)

// FileSizeRecorder is satisfied by both ResourceMetrics (job execution) and the
// provisioning package's FilesMetrics (files API) — their RecordFileRead/
// RecordFileWrite methods already have matching signatures. Shared helpers
// that are called from both layers (e.g. WriteFolderMetadata) take this
// interface instead of a concrete type so either metric family can be plugged
// in without resources importing the provisioning package (which would be a
// cycle, since provisioning already imports resources).
type FileSizeRecorder interface {
	RecordFileRead(sizeBytes int, duration time.Duration, err error)
	RecordFileWrite(sizeBytes int, duration time.Duration, err error)
	// RecordOperation observes a repository operation that has no byte payload
	// (e.g. delete, move, tree listing) — duration and outcome only, since a
	// synthetic size of 0 would skew the size histogram's low end.
	RecordOperation(operation string, duration time.Duration, err error)
}

var _ FileSizeRecorder = (*ResourceMetrics)(nil)

// ResourceMetrics tracks resource files as they are read from or written to a
// repository during provisioning job execution (sync, export): their size,
// how long the read/write took, and how many succeeded or failed.
//
// Read and write share one metric family per dimension (labeled "operation")
// rather than separate metric names, so they can be aggregated/compared with
// a single query (e.g. sum by (operation)) — the same convention used by
// jobs.JobMetrics' action/operation labels elsewhere in this package tree.
type ResourceMetrics struct {
	fileSizeHist *prometheus.HistogramVec // operation
	durationHist *prometheus.HistogramVec // operation
	opsTotal     *prometheus.CounterVec   // operation, outcome
}

var (
	resourceMetricsOnce sync.Once
	resourceMetrics     ResourceMetrics
)

// RegisterResourceMetrics registers the resource file read/write metrics.
func RegisterResourceMetrics(registry prometheus.Registerer) ResourceMetrics {
	resourceMetricsOnce.Do(func() {
		fileSizeHist := prometheus.NewHistogramVec(
			prometheus.HistogramOpts{
				Name: "grafana_provisioning_resource_file_size_bytes",
				Help: "Size in bytes of resource files read from or written to a repository during provisioning job execution",
				// 128B -> 64MB. Deliberately well above ProvisioningMaxFileSizeDefault (5MiB)
				// so the configured cap sits mid-histogram instead of at the +Inf edge.
				Buckets: prometheus.ExponentialBuckets(128, 2, 20),
			},
			[]string{"operation"},
		)
		registry.MustRegister(fileSizeHist)

		durationHist := prometheus.NewHistogramVec(
			prometheus.HistogramOpts{
				Name:    "grafana_provisioning_resource_file_duration_seconds",
				Help:    "Duration of resource file read/write operations against a repository during provisioning job execution",
				Buckets: prometheus.ExponentialBucketsRange(0.001, 30, 10), // 1ms -> 30s
			},
			[]string{"operation"},
		)
		registry.MustRegister(durationHist)

		opsTotal := prometheus.NewCounterVec(
			prometheus.CounterOpts{
				Name: "grafana_provisioning_resource_file_operations_total",
				Help: "Total resource file read/write operations against a repository during provisioning job execution, by outcome",
			},
			[]string{"operation", "outcome"},
		)
		registry.MustRegister(opsTotal)

		resourceMetrics = ResourceMetrics{
			fileSizeHist: fileSizeHist,
			durationHist: durationHist,
			opsTotal:     opsTotal,
		}
	})
	return resourceMetrics
}

// RecordFileRead observes a repository read: its duration, outcome, and (on
// success) the size of the data read.
func (m *ResourceMetrics) RecordFileRead(sizeBytes int, duration time.Duration, err error) {
	m.record("read", sizeBytes, duration, err)
}

// RecordFileWrite observes a repository write: its duration, outcome, and (on
// success) the size of the data written.
func (m *ResourceMetrics) RecordFileWrite(sizeBytes int, duration time.Duration, err error) {
	m.record("write", sizeBytes, duration, err)
}

// RecordOperation observes a repository operation with no byte payload
// (delete, move, tree listing): duration and outcome only.
func (m *ResourceMetrics) RecordOperation(operation string, duration time.Duration, err error) {
	m.recordOutcome(operation, duration, err)
}

// record is nil-safe so a ResourcesManager built without metrics does not panic.
func (m *ResourceMetrics) record(operation string, sizeBytes int, duration time.Duration, err error) {
	if m == nil {
		return
	}
	m.recordOutcome(operation, duration, err)
	// Size is only meaningful once the data is actually known good; a failed
	// read/write has no reliable size and would otherwise skew the low end of
	// the histogram with zeroes.
	if err == nil && m.fileSizeHist != nil {
		m.fileSizeHist.WithLabelValues(operation).Observe(float64(sizeBytes))
	}
}

func (m *ResourceMetrics) recordOutcome(operation string, duration time.Duration, err error) {
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
}
