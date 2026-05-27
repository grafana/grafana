package resource

import (
	"time"

	"github.com/grafana/dskit/instrument"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promauto"
)

type BleveIndexMetrics struct {
	IndexLatency         *prometheus.HistogramVec
	IndexSize            prometheus.Gauge
	IndexedKinds         *prometheus.GaugeVec
	IndexCreationTime    *prometheus.HistogramVec
	OpenIndexes          *prometheus.GaugeVec
	IndexBuilds          *prometheus.CounterVec
	IndexBuildFailures   prometheus.Counter
	IndexBuildSkipped    prometheus.Counter
	UpdateLatency        prometheus.Histogram
	UpdatedDocuments     prometheus.Summary
	SearchUpdateWaitTime *prometheus.HistogramVec
	RebuildQueueLength   prometheus.Gauge

	IndexSnapshotDownloads                *prometheus.CounterVec
	IndexSnapshotDownloadDuration         prometheus.Histogram
	IndexSnapshotUploads                  *prometheus.CounterVec
	IndexSnapshotUploadDuration           prometheus.Histogram
	IndexSnapshotBuildCoordinations       *prometheus.CounterVec
	IndexSnapshotNamespaceCleanups        *prometheus.CounterVec
	IndexSnapshotDeleted                  *prometheus.CounterVec
	IndexSnapshotIncompleteUploadsCleaned prometheus.Counter

	IndexDiskCleanupRuns        *prometheus.CounterVec
	IndexDiskCleanupDirsDeleted *prometheus.CounterVec
}

var IndexCreationBuckets = []float64{1, 5, 10, 25, 50, 75, 100, 200, 300, 400, 500, 600, 700, 800, 900, 1000}

func ProvideIndexMetrics(reg prometheus.Registerer) *BleveIndexMetrics {
	m := &BleveIndexMetrics{
		IndexLatency: promauto.With(reg).NewHistogramVec(prometheus.HistogramOpts{
			Name:                            "index_server_index_latency_seconds",
			Help:                            "Time (in seconds) until index is updated with new event",
			Buckets:                         instrument.DefBuckets,
			NativeHistogramBucketFactor:     1.1, // enable native histograms
			NativeHistogramMaxBucketNumber:  160,
			NativeHistogramMinResetDuration: time.Hour,
		}, []string{"resource"}),
		IndexSize: promauto.With(reg).NewGauge(prometheus.GaugeOpts{
			Name: "index_server_index_size",
			Help: "Size of the index in bytes - only for file-based indices",
		}),
		IndexedKinds: promauto.With(reg).NewGaugeVec(prometheus.GaugeOpts{
			Name: "index_server_indexed_kinds",
			Help: "Number of indexed documents by kind",
		}, []string{"kind"}),
		IndexCreationTime: promauto.With(reg).NewHistogramVec(prometheus.HistogramOpts{
			Name:                            "index_server_index_build_time_seconds",
			Help:                            "Time it takes to successfully build an index. Failed or skipped builds are not counted.",
			Buckets:                         IndexCreationBuckets,
			NativeHistogramBucketFactor:     1.1, // enable native histograms
			NativeHistogramMaxBucketNumber:  160,
			NativeHistogramMinResetDuration: time.Hour,
		}, []string{}),
		OpenIndexes: promauto.With(reg).NewGaugeVec(prometheus.GaugeOpts{
			Name: "index_server_open_indexes",
			Help: "Number of open indexes per storage type. An open index corresponds to single resource group.",
		}, []string{"index_storage"}), // index_storage is either "file" or "memory"
		IndexBuilds: promauto.With(reg).NewCounterVec(prometheus.CounterOpts{
			Name: "index_server_index_build_total",
			Help: "Number of times index build was attempted due to specific reason",
		}, []string{"reason"}),
		IndexBuildFailures: promauto.With(reg).NewCounter(prometheus.CounterOpts{
			Name: "index_server_index_build_failures_total",
			Help: "Number of times index build failed",
		}),
		IndexBuildSkipped: promauto.With(reg).NewCounter(prometheus.CounterOpts{
			Name: "index_server_index_build_skipped_total",
			Help: "Number of times index build has been skipped due to existing valid index being found on disk",
		}),
		UpdateLatency: promauto.With(reg).NewHistogram(prometheus.HistogramOpts{
			Name:                            "index_server_update_latency_seconds",
			Help:                            "Time to execute index update with latest modifications",
			NativeHistogramBucketFactor:     1.1,
			NativeHistogramMaxBucketNumber:  160,
			NativeHistogramMinResetDuration: time.Hour,
		}),
		UpdatedDocuments: promauto.With(reg).NewSummary(prometheus.SummaryOpts{
			Name: "index_server_update_documents",
			Help: "Number of documents indexed during index update",
		}),
		SearchUpdateWaitTime: promauto.With(reg).NewHistogramVec(prometheus.HistogramOpts{
			Name:                            "index_server_search_update_wait_time_seconds",
			Help:                            "Time spent waiting for index update during search queries",
			NativeHistogramBucketFactor:     1.1,
			NativeHistogramMaxBucketNumber:  160,
			NativeHistogramMinResetDuration: time.Hour,
		}, []string{"reason"}),
		RebuildQueueLength: promauto.With(reg).NewGauge(prometheus.GaugeOpts{
			Name: "index_server_rebuild_queue_length",
			Help: "Number of indexes waiting for rebuild",
		}),
		IndexSnapshotDownloads: promauto.With(reg).NewCounterVec(prometheus.CounterOpts{
			Name: "index_server_snapshot_downloads_total",
			Help: "Number of remote index snapshot download attempts at index build time, by selection policy and outcome.",
		}, []string{"policy", "status"}), // policy: tiered, same_version. status: success, empty, download_error, validate_error
		IndexSnapshotDownloadDuration: promauto.With(reg).NewHistogram(prometheus.HistogramOpts{
			Name:                            "index_server_snapshot_download_duration_seconds",
			Help:                            "Duration of successful remote index snapshot downloads, including open and validation.",
			Buckets:                         IndexCreationBuckets,
			NativeHistogramBucketFactor:     1.1,
			NativeHistogramMaxBucketNumber:  160,
			NativeHistogramMinResetDuration: time.Hour,
		}),
		IndexSnapshotUploads: promauto.With(reg).NewCounterVec(prometheus.CounterOpts{
			Name: "index_server_snapshot_uploads_total",
			Help: "Number of remote index snapshot upload attempts, by outcome.",
		}, []string{"status"}), // status: success, skip_no_changes, skip_lock_contention, skip_lock_lost, skip_recent_remote, skip_not_owner, error
		IndexSnapshotUploadDuration: promauto.With(reg).NewHistogram(prometheus.HistogramOpts{
			Name:                            "index_server_snapshot_upload_duration_seconds",
			Help:                            "Duration of successful remote index snapshot uploads, including snapshot creation.",
			Buckets:                         IndexCreationBuckets,
			NativeHistogramBucketFactor:     1.1,
			NativeHistogramMaxBucketNumber:  160,
			NativeHistogramMinResetDuration: time.Hour,
		}),
		IndexSnapshotBuildCoordinations: promauto.With(reg).NewCounterVec(prometheus.CounterOpts{
			Name: "index_server_snapshot_build_coordinations_total",
			Help: "Number of snapshot build coordination outcomes, by flow and outcome.",
		}, []string{"flow", "outcome"}), // flow: cold_start, rebuild. outcome: acquired_lock, downloaded_after_wait, wait_timed_out, lock_error, context_canceled
		IndexSnapshotNamespaceCleanups: promauto.With(reg).NewCounterVec(prometheus.CounterOpts{
			Name: "index_server_snapshot_namespace_cleanups_total",
			Help: "Number of namespace-level remote index snapshot cleanup attempts, by outcome.",
		}, []string{"status"}), // status: success, error, skip_lock_held, skip_unowned
		IndexSnapshotDeleted: promauto.With(reg).NewCounterVec(prometheus.CounterOpts{
			Name: "index_server_snapshot_deleted_total",
			Help: "Number of remote index snapshot delete attempts by cleanup, by outcome.",
		}, []string{"outcome"}), // outcome: success, error
		IndexSnapshotIncompleteUploadsCleaned: promauto.With(reg).NewCounter(prometheus.CounterOpts{
			Name: "index_server_snapshot_incomplete_uploads_cleaned_total",
			Help: "Number of incomplete (partial) index snapshots deleted by cleanup.",
		}),
		IndexDiskCleanupRuns: promauto.With(reg).NewCounterVec(prometheus.CounterOpts{
			Name: "index_server_disk_cleanup_runs_total",
			Help: "Number of on-disk index cleanup pass attempts, by outcome.",
		}, []string{"outcome"}), // outcome: success, error
		IndexDiskCleanupDirsDeleted: promauto.With(reg).NewCounterVec(prometheus.CounterOpts{
			Name: "index_server_disk_cleanup_dirs_deleted_total",
			Help: "Number of on-disk directories the disk cleanup pass attempted to delete, by kind and outcome.",
		}, []string{"kind", "outcome"}), // kind: index, snapshot_staging. outcome: success, error
	}

	// Always-on label series. Snapshot-specific series are initialised separately
	// in InitSnapshotMetrics so they don't appear on instances where the feature
	// is disabled — see InitSnapshotMetrics for rationale.
	m.OpenIndexes.WithLabelValues("file").Set(0)
	m.OpenIndexes.WithLabelValues("memory").Set(0)
	return m
}

// InitSnapshotMetrics zero-initialises the per-status label series of the
// snapshot-related counters. Call once at startup only when the snapshot
// feature is configured to run on this instance, so disabled instances don't
// emit permanently-zero `index_server_snapshot_*` series. Registration of
// the CounterVecs themselves stays unconditional in ProvideIndexMetrics.
func (m *BleveIndexMetrics) InitSnapshotMetrics() {
	if m == nil {
		return
	}
	for _, policy := range []string{"tiered", "same_version", "cold_start"} {
		m.IndexSnapshotDownloads.WithLabelValues(policy, "success").Add(0)
		m.IndexSnapshotDownloads.WithLabelValues(policy, "empty").Add(0)
		m.IndexSnapshotDownloads.WithLabelValues(policy, "download_error").Add(0)
		m.IndexSnapshotDownloads.WithLabelValues(policy, "validate_error").Add(0)
	}
	m.IndexSnapshotUploads.WithLabelValues("success").Add(0)
	m.IndexSnapshotUploads.WithLabelValues("skip_no_changes").Add(0)
	m.IndexSnapshotUploads.WithLabelValues("skip_lock_contention").Add(0)
	m.IndexSnapshotUploads.WithLabelValues("skip_lock_lost").Add(0)
	m.IndexSnapshotUploads.WithLabelValues("skip_recent_remote").Add(0)
	m.IndexSnapshotUploads.WithLabelValues("skip_not_owner").Add(0)
	m.IndexSnapshotUploads.WithLabelValues("error").Add(0)
	for _, flow := range []string{"cold_start", "rebuild"} {
		m.IndexSnapshotBuildCoordinations.WithLabelValues(flow, "acquired_lock").Add(0)
		m.IndexSnapshotBuildCoordinations.WithLabelValues(flow, "downloaded_after_wait").Add(0)
		m.IndexSnapshotBuildCoordinations.WithLabelValues(flow, "wait_timed_out").Add(0)
		m.IndexSnapshotBuildCoordinations.WithLabelValues(flow, "lock_error").Add(0)
		m.IndexSnapshotBuildCoordinations.WithLabelValues(flow, "context_canceled").Add(0)
	}
	m.IndexSnapshotNamespaceCleanups.WithLabelValues("success").Add(0)
	m.IndexSnapshotNamespaceCleanups.WithLabelValues("error").Add(0)
	m.IndexSnapshotNamespaceCleanups.WithLabelValues("skip_lock_held").Add(0)
	m.IndexSnapshotNamespaceCleanups.WithLabelValues("skip_unowned").Add(0)
	m.IndexSnapshotDeleted.WithLabelValues("success").Add(0)
	m.IndexSnapshotDeleted.WithLabelValues("error").Add(0)
	m.IndexSnapshotIncompleteUploadsCleaned.Add(0)
}

// InitDiskCleanupMetrics zero-initialises the per-label series of the disk
// cleanup counters. Call once at startup only when the disk cleanup loop is
// configured to run on this instance, so disabled instances don't emit
// permanently-zero `index_server_disk_cleanup_*` series.
func (m *BleveIndexMetrics) InitDiskCleanupMetrics() {
	if m == nil {
		return
	}
	m.IndexDiskCleanupRuns.WithLabelValues("success").Add(0)
	m.IndexDiskCleanupRuns.WithLabelValues("error").Add(0)
	for _, kind := range []string{"index", "snapshot_staging"} {
		m.IndexDiskCleanupDirsDeleted.WithLabelValues(kind, "success").Add(0)
		m.IndexDiskCleanupDirsDeleted.WithLabelValues(kind, "error").Add(0)
	}
}
