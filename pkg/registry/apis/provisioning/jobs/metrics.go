package jobs

import (
	"sync"
	"time"

	"github.com/prometheus/client_golang/prometheus"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/apps/provisioning/pkg/repository"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/utils"
	usinformer "github.com/grafana/grafana/pkg/storage/unified/informer"
)

type JobMetrics struct {
	registry       prometheus.Registerer
	processedTotal *prometheus.CounterVec
	durationHist   *prometheus.HistogramVec

	incrementalSyncPhaseDurationHist *prometheus.HistogramVec // phases of incremental sync
	fullSyncPhaseDurationHist        *prometheus.HistogramVec // phases of full sync
	syncDurationHist                 *prometheus.HistogramVec // total sync durations

	resourceOpsTotal *prometheus.CounterVec // per-resource outcome counter
	inFlight         *prometheus.GaugeVec   // jobs currently being processed, by driver + action
	busySeconds      *prometheus.CounterVec // job duration credited at completion, by driver + action
}

// claimTrigger records what enqueued the work-queue key that a worker is now
// processing. It aliases the shared unified-informer type so the driver's local
// vocabulary matches the metric's source label.
type claimTrigger = usinformer.ProcessTrigger

const (
	triggerLive    = usinformer.TriggerLive
	triggerRelist  = usinformer.TriggerRelist
	triggerInitial = usinformer.TriggerInitial
)

// resourceLabelJobs is the resource label value the driver emits on the
// processing metrics.
const resourceLabelJobs = "jobs"

type QueueMetrics struct {
	queueWaitTime *prometheus.HistogramVec

	// Claim metrics, per driver_id. These count per CAS (compare-and-swap) attempt on a
	// job, so contention is directly visible: a claim that loses several races before
	// winning records each loss.
	claimed         *prometheus.CounterVec // won a CAS race — this driver now owns the job
	claimConflicts  *prometheus.CounterVec // lost a CAS race — another worker updated the job first
	claimErrors     *prometheus.CounterVec // the claiming update failed with a non-conflict error (not identity/read)
	claimRoundsCont *prometheus.CounterVec // lost to another worker — job already claimed, or all CAS retries exhausted
}

// durationBucketUnknown is the resources_changed_bucket used when a job did not
// succeed: the resource count is partial and not meaningful, so failed durations are
// grouped here instead of a misleading count bucket.
const durationBucketUnknown = "unknown"

var (
	queueOnce    sync.Once
	queueMetrics QueueMetrics

	jobOnce    sync.Once
	jobMetrics JobMetrics
)

func RegisterQueueMetrics(registry prometheus.Registerer) QueueMetrics {
	queueOnce.Do(func() {
		queueWaitTime := prometheus.NewHistogramVec(
			prometheus.HistogramOpts{
				Name:    "grafana_provisioning_jobs_queue_wait_seconds",
				Help:    "Time jobs spend waiting in the queue before being claimed",
				Buckets: []float64{1.0, 5.0, 10.0, 30.0, 60.0, 120.0, 300.0},
			},
			[]string{"action"},
		)
		registry.MustRegister(queueWaitTime)

		claimed := prometheus.NewCounterVec(
			prometheus.CounterOpts{
				Name: "grafana_provisioning_jobs_claimed_total",
				Help: "Jobs successfully claimed (won the compare-and-swap race), by driver",
			},
			[]string{"driver_id"},
		)
		registry.MustRegister(claimed)

		claimConflicts := prometheus.NewCounterVec(
			prometheus.CounterOpts{
				Name: "grafana_provisioning_jobs_claim_conflicts_total",
				Help: "Claim attempts that lost the compare-and-swap race to another worker, by driver",
			},
			[]string{"driver_id"},
		)
		registry.MustRegister(claimConflicts)

		claimErrors := prometheus.NewCounterVec(
			prometheus.CounterOpts{
				Name: "grafana_provisioning_jobs_claim_errors_total",
				Help: "Claim attempts whose claiming update failed with a non-conflict error, by driver (identity/read failures are not counted)",
			},
			[]string{"driver_id"},
		)
		registry.MustRegister(claimErrors)

		claimRoundsCont := prometheus.NewCounterVec(
			prometheus.CounterOpts{
				Name: "grafana_provisioning_jobs_claim_rounds_contended_total",
				Help: "Claim attempts lost to another worker — the job was already claimed, or all CAS retries were exhausted, by driver",
			},
			[]string{"driver_id"},
		)
		registry.MustRegister(claimRoundsCont)

		queueMetrics = QueueMetrics{
			queueWaitTime:   queueWaitTime,
			claimed:         claimed,
			claimConflicts:  claimConflicts,
			claimErrors:     claimErrors,
			claimRoundsCont: claimRoundsCont,
		}
	})
	return queueMetrics
}

func (m *QueueMetrics) RecordWaitTime(action string, waitSeconds float64) {
	m.queueWaitTime.WithLabelValues(action).Observe(waitSeconds)
}

// The claim-metric recorders are all safe to call on a zero-value QueueMetrics (nil
// collectors) so stores built in tests without registered metrics do not panic.

// RecordClaimWon records a successful claim (won the CAS race) by driverID.
func (m *QueueMetrics) RecordClaimWon(driverID string) {
	if m.claimed == nil {
		return
	}
	m.claimed.WithLabelValues(driverID).Inc()
}

// RecordClaimConflict records a claim that lost the CAS race to another worker.
func (m *QueueMetrics) RecordClaimConflict(driverID string) {
	if m.claimConflicts == nil {
		return
	}
	m.claimConflicts.WithLabelValues(driverID).Inc()
}

// RecordClaimError records a claim that failed (list, identity, or non-conflict update).
func (m *QueueMetrics) RecordClaimError(driverID string) {
	if m.claimErrors == nil {
		return
	}
	m.claimErrors.WithLabelValues(driverID).Inc()
}

// RecordClaimRoundContended records a claim round that listed candidates but won none.
func (m *QueueMetrics) RecordClaimRoundContended(driverID string) {
	if m.claimRoundsCont == nil {
		return
	}
	m.claimRoundsCont.WithLabelValues(driverID).Inc()
}

func RegisterJobMetrics(registry prometheus.Registerer) JobMetrics {
	jobOnce.Do(func() {
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
			[]string{"action", "resources_changed_bucket", "outcome"},
		)
		registry.MustRegister(durationHist)

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

		resourceOpsTotal := prometheus.NewCounterVec(
			prometheus.CounterOpts{
				Name: "grafana_provisioning_jobs_resource_operations_total",
				Help: "Total resource operations performed during provisioning job runs",
			},
			[]string{"action", "operation", "outcome", "reason", "group", "kind"},
		)
		registry.MustRegister(resourceOpsTotal)

		inFlight := prometheus.NewGaugeVec(
			prometheus.GaugeOpts{
				Name: "grafana_provisioning_jobs_in_flight",
				Help: "Number of jobs currently being processed (a busy worker slot), by driver and action",
			},
			[]string{"driver_id", "action"},
		)
		registry.MustRegister(inFlight)

		busySeconds := prometheus.NewCounterVec(
			prometheus.CounterOpts{
				Name: "grafana_provisioning_jobs_busy_seconds_total",
				Help: "Total seconds workers spent processing jobs, credited at completion, by driver and action",
			},
			[]string{"driver_id", "action"},
		)
		registry.MustRegister(busySeconds)

		jobMetrics = JobMetrics{
			registry:                         registry,
			processedTotal:                   processedTotal,
			durationHist:                     durationHist,
			incrementalSyncPhaseDurationHist: incrementalSyncPhaseDurationHist,
			fullSyncPhaseDurationHist:        fullSyncPhaseDurationHist,
			syncDurationHist:                 syncDurationHist,
			resourceOpsTotal:                 resourceOpsTotal,
			inFlight:                         inFlight,
			busySeconds:                      busySeconds,
		}
	})
	return jobMetrics
}

// IncInFlight marks a worker slot busy: driverID started processing a job of action.
// Nil-safe so drivers built in tests without registered metrics do not panic.
func (m *JobMetrics) IncInFlight(driverID, action string) {
	if m == nil || m.inFlight == nil {
		return
	}
	m.inFlight.WithLabelValues(driverID, action).Inc()
}

// DecInFlight marks a worker slot free again once the job is done (any outcome).
func (m *JobMetrics) DecInFlight(driverID, action string) {
	if m == nil || m.inFlight == nil {
		return
	}
	m.inFlight.WithLabelValues(driverID, action).Dec()
}

// RecordBusySeconds credits the time a worker slot spent on a job, at completion.
// Unlike the in_flight gauge (sampled at scrape time, so it aliases on bursts of
// short jobs), this counter gives scrape-robust time-averaged utilization. Nil-safe.
func (m *JobMetrics) RecordBusySeconds(driverID, action string, seconds float64) {
	if m == nil || m.busySeconds == nil {
		return
	}
	m.busySeconds.WithLabelValues(driverID, action).Add(seconds)
}

func (m *JobMetrics) RecordJob(jobAction string, outcome string, resourceCountChanged int, duration float64) {
	m.processedTotal.WithLabelValues(jobAction, outcome).Inc()

	// Record duration for every outcome so slow-but-failing jobs are visible (a job
	// that runs to the timeout then errors is exactly what we want to catch). Only a
	// failed job's resource count is unreliable (partial work), so bucket errors under
	// a sentinel; success and warning keep their size bucket.
	bucket := utils.GetResourceCountBucket(resourceCountChanged)
	if outcome == utils.ErrorOutcome {
		bucket = durationBucketUnknown
	}
	m.durationHist.WithLabelValues(jobAction, bucket, outcome).Observe(duration)
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

// RecordResourceOperation derives outcome, operation, and reason from the
// result and increments the resource operations counter.
func (m *JobMetrics) RecordResourceOperation(action provisioning.JobAction, result JobResourceResult) {
	var outcome ResourceOutcome
	reason := result.Reason()

	switch {
	case result.Error() != nil:
		outcome = OutcomeError
	case result.Warning() != nil:
		outcome = OutcomeWarning
		reason = result.WarningReason()
	default:
		outcome = OutcomeSuccess
	}

	m.resourceOpsTotal.WithLabelValues(string(action), string(fileActionToOperation(result.Action())), string(outcome), reason, result.Group(), result.Kind()).Inc()
}

func fileActionToOperation(action repository.FileAction) ResourceOperation {
	switch action {
	case repository.FileActionCreated:
		return OperationCreated
	case repository.FileActionUpdated:
		return OperationUpdated
	case repository.FileActionDeleted:
		return OperationDeleted
	case repository.FileActionRenamed:
		return OperationRenamed
	case repository.FileActionIgnored:
		return OperationIgnored
	default:
		return ResourceOperation(action)
	}
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
	FullSyncPhaseFileRenames
	FullSyncPhaseFileDeletions
	FullSyncPhaseFolderDeletions
	FullSyncPhaseFolderCreations
	FullSyncPhaseFileCreations
	FullSyncPhaseOldFolderCleanup
)

func (p FullSyncPhase) String() string {
	switch p {
	case FullSyncPhaseCompare:
		return "compare"
	case FullSyncPhaseFileRenames:
		return "file_renames"
	case FullSyncPhaseFileDeletions:
		return "file_deletions"
	case FullSyncPhaseFolderDeletions:
		return "folder_deletions"
	case FullSyncPhaseFolderCreations:
		return "folder_creations"
	case FullSyncPhaseFileCreations:
		return "file_creations"
	case FullSyncPhaseOldFolderCleanup:
		return "old_folder_cleanup"
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
