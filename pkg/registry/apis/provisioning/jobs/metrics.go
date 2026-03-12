package jobs

import (
	"time"

	"github.com/grafana/grafana/pkg/registry/apis/provisioning/utils"
	"github.com/prometheus/client_golang/prometheus"
)

type JobMetrics struct {
	registry       prometheus.Registerer
	processedTotal *prometheus.CounterVec
	durationHist   *prometheus.HistogramVec

	incrementalSyncPhaseDurationHist *prometheus.HistogramVec // phases of incremental sync
	fullSyncPhaseDurationHist        *prometheus.HistogramVec // phases of full sync
	syncDurationHist                 *prometheus.HistogramVec // total sync durations

	warningsHist        *prometheus.HistogramVec // warning counts per job run by reason
	errorsHist          *prometheus.HistogramVec // error counts per job run
	fileOperationsTotal *prometheus.CounterVec   // file operations in the repository
	resourceOpsTotal    *prometheus.CounterVec   // notable resource operations
}

type QueueMetrics struct {
	queueSize     *prometheus.GaugeVec
	queueWaitTime *prometheus.HistogramVec
}

func RegisterQueueMetrics(registry prometheus.Registerer) QueueMetrics {
	queueSize := prometheus.NewGaugeVec(
		prometheus.GaugeOpts{
			Name: "grafana_provisioning_jobs_queue_size",
			Help: "Number of jobs currently in the queue",
		},
		[]string{"action"},
	)
	registry.MustRegister(queueSize)

	queueWaitTime := prometheus.NewHistogramVec(
		prometheus.HistogramOpts{
			Name:    "grafana_provisioning_jobs_queue_wait_seconds",
			Help:    "Time jobs spend waiting in the queue before being claimed",
			Buckets: []float64{1.0, 5.0, 10.0, 30.0, 60.0, 120.0, 300.0},
		},
		[]string{"action"},
	)
	registry.MustRegister(queueWaitTime)

	return QueueMetrics{
		queueSize:     queueSize,
		queueWaitTime: queueWaitTime,
	}
}

func (m *QueueMetrics) IncreaseQueueSize(action string) {
	m.queueSize.WithLabelValues(action).Inc()
}

func (m *QueueMetrics) DecreaseQueueSize(action string) {
	m.queueSize.WithLabelValues(action).Dec()
}

func (m *QueueMetrics) RecordWaitTime(action string, waitSeconds float64) {
	m.queueWaitTime.WithLabelValues(action).Observe(waitSeconds)
}

func RegisterJobMetrics(registry prometheus.Registerer) JobMetrics {
	processedTotal := prometheus.NewCounterVec(
		prometheus.CounterOpts{
			Name: "grafana_provisioning_jobs_processed_total",
			Help: "Total number of jobs processed",
		},
		[]string{"action", "outcome"},
	)
	registry.MustRegister(processedTotal)

	durationHist := prometheus.NewHistogramVec(
		prometheus.HistogramOpts{
			Name:    "grafana_provisioning_jobs_duration_seconds",
			Help:    "Duration of job",
			Buckets: []float64{5.0, 10.0, 30.0, 60.0, 120.0, 300.0},
		},
		[]string{"action", "resources_changed_bucket"},
	)

	incrementalSyncPhaseDurationHist := prometheus.NewHistogramVec(
		prometheus.HistogramOpts{
			Name:    "grafana_provisioning_jobs_incremental_sync_phase_duration_seconds",
			Help:    "Duration of job phases for incremental sync",
			Buckets: prometheus.ExponentialBucketsRange(0.01, 10*60, 8), // 1ms -> 10m
		},
		[]string{"phase"},
	)
	registry.MustRegister(incrementalSyncPhaseDurationHist)

	fullSyncPhaseDurationHist := prometheus.NewHistogramVec(
		prometheus.HistogramOpts{
			Name:    "grafana_provisioning_jobs_full_sync_phase_duration_seconds",
			Help:    "Duration of job phases for full sync",
			Buckets: prometheus.ExponentialBucketsRange(0.01, 10*60, 8), // 1ms -> 10m
		},
		[]string{"phase"},
	)
	registry.MustRegister(fullSyncPhaseDurationHist)

	syncDurationHist := prometheus.NewHistogramVec(
		prometheus.HistogramOpts{
			Name:    "grafana_provisioning_jobs_sync_duration_seconds",
			Help:    "Duration of sync (full or incremental)",
			Buckets: prometheus.ExponentialBucketsRange(0.01, 10*60, 8), // 1ms -> 10m
		},
		[]string{"type"},
	)
	registry.MustRegister(syncDurationHist)

	warningsHist := prometheus.NewHistogramVec(
		prometheus.HistogramOpts{
			Name:    "grafana_provisioning_jobs_warnings",
			Help:    "Distribution of warning counts per provisioning job run, broken down by action and reason",
			Buckets: []float64{0, 1, 5, 10, 25, 50, 100, 250},
		},
		[]string{"action", "reason"},
	)
	registry.MustRegister(warningsHist)

	errorsHist := prometheus.NewHistogramVec(
		prometheus.HistogramOpts{
			Name:    "grafana_provisioning_jobs_errors",
			Help:    "Distribution of resource error counts per provisioning job run",
			Buckets: []float64{0, 1, 5, 10, 25, 50, 100, 250},
		},
		[]string{"action"},
	)
	registry.MustRegister(errorsHist)

	fileOperationsTotal := prometheus.NewCounterVec(
		prometheus.CounterOpts{
			Name: "grafana_provisioning_jobs_file_operations_total",
			Help: "Total file operations performed during provisioning job runs",
		},
		[]string{"action", "operation", "reason"},
	)
	registry.MustRegister(fileOperationsTotal)

	resourceOpsTotal := prometheus.NewCounterVec(
		prometheus.CounterOpts{
			Name: "grafana_provisioning_jobs_resource_operations_total",
			Help: "Total notable resource operations performed during provisioning job runs",
		},
		[]string{"action", "operation", "reason", "group", "kind"},
	)
	registry.MustRegister(resourceOpsTotal)

	return JobMetrics{
		registry:                         registry,
		processedTotal:                   processedTotal,
		durationHist:                     durationHist,
		incrementalSyncPhaseDurationHist: incrementalSyncPhaseDurationHist,
		fullSyncPhaseDurationHist:        fullSyncPhaseDurationHist,
		syncDurationHist:                 syncDurationHist,
		warningsHist:                     warningsHist,
		errorsHist:                       errorsHist,
		fileOperationsTotal:              fileOperationsTotal,
		resourceOpsTotal:                 resourceOpsTotal,
	}
}

func (m *JobMetrics) RecordJob(jobAction string, outcome string, resourceCountChanged int, duration float64) {
	m.processedTotal.WithLabelValues(jobAction, outcome).Inc()

	// only record duration when the job was successful. otherwise resource count will be incorrect
	if outcome == utils.SuccessOutcome {
		m.durationHist.WithLabelValues(jobAction, utils.GetResourceCountBucket(resourceCountChanged)).Observe(duration)
	}
}

func (m *JobMetrics) RecordIncrementalSyncPhase(phase IncrementalSyncPhase, duration time.Duration) {
	m.incrementalSyncPhaseDurationHist.WithLabelValues(phase.String()).Observe(duration.Seconds())
}

func (m *JobMetrics) RecordFullSyncPhase(phase FullSyncPhase, duration time.Duration) {
	m.fullSyncPhaseDurationHist.WithLabelValues(phase.String()).Observe(duration.Seconds())
}

func (m *JobMetrics) RecordSyncDuration(syncType SyncType, duration time.Duration) {
	m.syncDurationHist.WithLabelValues(syncType.String()).Observe(duration.Seconds())
}

// RecordWarnings observes the count of warnings produced by a single job run.
func (m *JobMetrics) RecordWarnings(action, reason string, count int) {
	m.warningsHist.WithLabelValues(action, reason).Observe(float64(count))
}

// RecordErrors observes the count of resource errors produced by a single job run.
func (m *JobMetrics) RecordErrors(action string, count int) {
	m.errorsHist.WithLabelValues(action).Observe(float64(count))
}

// RecordFileOperation increments the file operations counter.
func (m *JobMetrics) RecordFileOperation(action, operation, reason string) {
	m.fileOperationsTotal.WithLabelValues(action, operation, reason).Inc()
}

// RecordResourceOperation increments the resource operations counter.
func (m *JobMetrics) RecordResourceOperation(action, operation, reason, group, kind string) {
	m.resourceOpsTotal.WithLabelValues(action, operation, reason, group, kind).Inc()
}

func recordConcurrentDriverMetric(registry prometheus.Registerer, numDrivers int) {
	concurrentDriver := prometheus.NewGaugeVec(
		prometheus.GaugeOpts{
			Name: "grafana_provisioning_jobs_concurrent_driver_num_drivers",
			Help: "Number of concurrent job drivers",
		},
		[]string{},
	)
	registry.MustRegister(concurrentDriver)
	concurrentDriver.WithLabelValues().Set(float64(numDrivers))
}

type SyncType int

const (
	SyncTypeUnknown SyncType = iota // to prevent zero value being valid
	SyncTypeFull
	SyncTypeIncremental
)

func (t SyncType) String() string {
	switch t {
	case SyncTypeFull:
		return "full"
	case SyncTypeIncremental:
		return "incremental"
	default:
		return "unknown"
	}
}

type FullSyncPhase int

const (
	FullSyncPhaseUnknown FullSyncPhase = iota // to prevent zero value being valid
	FullSyncPhaseCompare
	FullSyncPhaseFileDeletions
	FullSyncPhaseFolderDeletions
	FullSyncPhaseFolderCreations
	FullSyncPhaseFileCreations
)

func (p FullSyncPhase) String() string {
	switch p {
	case FullSyncPhaseCompare:
		return "compare"
	case FullSyncPhaseFileDeletions:
		return "file_deletions"
	case FullSyncPhaseFolderDeletions:
		return "folder_deletions"
	case FullSyncPhaseFolderCreations:
		return "folder_creations"
	case FullSyncPhaseFileCreations:
		return "file_creations"
	default:
		return "unknown"
	}
}

type IncrementalSyncPhase int

const (
	IncrementalSyncPhaseUnknown IncrementalSyncPhase = iota // to prevent zero value being valid
	IncrementalSyncPhaseCompare
	IncrementalSyncPhaseApply
	IncrementalSyncPhaseCleanup
)

func (p IncrementalSyncPhase) String() string {
	switch p {
	case IncrementalSyncPhaseCompare:
		return "compare"
	case IncrementalSyncPhaseApply:
		return "apply"
	case IncrementalSyncPhaseCleanup:
		return "cleanup"
	default:
		return "unknown"
	}
}
