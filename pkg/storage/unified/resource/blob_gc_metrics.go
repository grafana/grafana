package resource

import (
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promauto"
)

// BlobGCMetrics records bounded, per-backend results for each collection pass.
type BlobGCMetrics struct {
	Runs       prometheus.Counter
	Candidates prometheus.Gauge
	// SkippedWithoutAge is the number of unreferenced blobs the latest successful
	// pass left alone because their age could not be determined (legacy UIDs).
	SkippedWithoutAge prometheus.Gauge
	Deleted           prometheus.Counter
	Errors            prometheus.Counter
}

func NewBlobGCMetricsIfEnabled(reg prometheus.Registerer, backend string, enabled bool) *BlobGCMetrics {
	if !enabled {
		return nil
	}
	factory := promauto.With(prometheus.WrapRegistererWith(prometheus.Labels{"backend": backend}, reg))
	return &BlobGCMetrics{
		Runs: factory.NewCounter(prometheus.CounterOpts{
			Name: "grafana_unified_storage_blob_gc_runs_total",
			Help: "Number of blob garbage collection passes attempted.",
		}),
		Candidates: factory.NewGauge(prometheus.GaugeOpts{
			Name: "grafana_unified_storage_blob_gc_candidates",
			Help: "Number of eligible unreferenced blobs found in the latest successful collection pass (also in dry-run mode).",
		}),
		SkippedWithoutAge: factory.NewGauge(prometheus.GaugeOpts{
			Name: "grafana_unified_storage_blob_gc_skipped_without_age",
			Help: "Number of unreferenced blobs left alone in the latest successful collection pass because no upload time could be determined.",
		}),
		Deleted: factory.NewCounter(prometheus.CounterOpts{
			Name: "grafana_unified_storage_blob_gc_deleted_total",
			Help: "Number of blobs deleted by garbage collection.",
		}),
		Errors: factory.NewCounter(prometheus.CounterOpts{
			Name: "grafana_unified_storage_blob_gc_errors_total",
			Help: "Number of blob garbage collection passes that encountered an error.",
		}),
	}
}

func (m *BlobGCMetrics) Record(count int, dryRun bool, err error) {
	if m == nil {
		return
	}
	m.recordProgress(count, dryRun)
	if err != nil {
		m.Errors.Inc()
	} else {
		m.Candidates.Set(float64(count))
	}
}

// RecordInterrupted retains attempted runs and completed deletions without
// treating a partial pass as a successful scan or a failure.
func (m *BlobGCMetrics) RecordInterrupted(count int, dryRun bool) {
	if m != nil {
		m.recordProgress(count, dryRun)
	}
}

func (m *BlobGCMetrics) recordProgress(count int, dryRun bool) {
	m.Runs.Inc()
	if !dryRun {
		m.Deleted.Add(float64(count))
	}
}

// RecordSkippedWithoutAge records the size of the legacy backlog. A failed pass
// reports only a partial count, so it leaves the previous value in place.
func (m *BlobGCMetrics) RecordSkippedWithoutAge(count int, err error) {
	if m == nil || err != nil {
		return
	}
	m.SkippedWithoutAge.Set(float64(count))
}
