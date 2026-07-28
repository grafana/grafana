package jobs

import (
	"context"
	"errors"
	"strings"
	"sync"
	"time"

	"go.opentelemetry.io/otel/attribute"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	"k8s.io/apiserver/pkg/endpoints/request"

	"github.com/grafana/grafana-app-sdk/logging"
	"github.com/grafana/grafana/apps/provisioning/pkg/apis/apifmt"
	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	appcontroller "github.com/grafana/grafana/apps/provisioning/pkg/controller"
	appjobs "github.com/grafana/grafana/apps/provisioning/pkg/jobs"
	"github.com/grafana/grafana/apps/provisioning/pkg/repository"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/infra/tracing"
)

// Store is an abstraction for the storage API.
// This exists to allow for unit testing.
//
//go:generate mockery --name Store --structname MockStore --inpackage --filename store_mock.go --with-expecter
type Store interface {
	// Claim attempts to claim the job namespace/name, marks it as ours, and returns it.
	//
	// Returns ErrAlreadyClaimed if another worker holds the claim, and a NotFound
	// API error if the job no longer exists.
	//
	// If err is not nil, the job and rollback values are always nil.
	Claim(ctx context.Context, namespace, name string) (job *provisioning.Job, rollback func(), err error)

	// ListUnclaimedJobs lists jobs that no worker has claimed yet, up to limit (a single page).
	ListUnclaimedJobs(ctx context.Context, limit int) ([]*provisioning.Job, error)

	// Complete marks a job as completed and removes it from the active job store.
	// Callers are responsible for writing the job to history after calling this.
	Complete(ctx context.Context, job *provisioning.Job) error

	// Update saves the job back to the store.
	Update(ctx context.Context, job *provisioning.Job) (*provisioning.Job, error)

	// RenewLease renews the lease for a claimed job, extending its expiry time.
	// Returns an error if the lease cannot be renewed (e.g., job was completed or lease expired).
	RenewLease(ctx context.Context, job *provisioning.Job) error

	// Get retrieves a job by name for conflict resolution.
	Get(ctx context.Context, namespace, name string) (*provisioning.Job, error)

	// ListExpiredJobs lists jobs with expired leases (claim timestamp older than the given time).
	// Returns jobs in batches up to the specified limit.
	ListExpiredJobs(ctx context.Context, expiredBefore time.Time, limit int) ([]*provisioning.Job, error)
}

// errPostClaim marks failures that happened after the job was successfully
// claimed. By then the worker may already have executed the job (e.g. only
// Complete failed), and the deferred claim rollback returns the job to
// pending — so retrying the key from the queue would re-run work with side
// effects. The worker loop drops these keys instead and lets the backstop
// poll re-discover the job, preserving the pre-queue retry cadence.
var errPostClaim = errors.New("job failed after it was claimed")

// jobProcessor claims and drives a single job at a time to completion.
// Each worker goroutine of the ConcurrentJobDriver owns one jobProcessor:
// its per-job state (currentJob) must never be shared across goroutines.
type jobProcessor struct {
	// Timeout for processing a job. This must be less than a claim expiry.
	jobTimeout time.Duration

	// LeaseRenewalInterval is how often to renew job leases.
	leaseRenewalInterval time.Duration

	// Store is the job storage backend.
	store Store
	// RepoGetter lets us access repositories to pass to the worker.
	repoGetter RepoGetter

	// save info about finished jobs
	historicJobs HistoryWriter

	// Workers process the job.
	// Only the first worker who supports the job will process it; the rest are ignored.
	workers []Worker

	// metrics for recording job-level Prometheus metrics (warnings, operations, etc.)
	metrics *JobMetrics

	// Mutex to protect concurrent access to job processing
	mu sync.Mutex
	// currentJob is the job currently being processed
	currentJob *provisioning.Job
}

func newJobProcessor(
	jobTimeout, leaseRenewalInterval time.Duration,
	store Store,
	repoGetter RepoGetter,
	historicJobs HistoryWriter,
	metrics *JobMetrics,
	workers ...Worker,
) *jobProcessor {
	return &jobProcessor{
		jobTimeout:           jobTimeout,
		leaseRenewalInterval: leaseRenewalInterval,
		store:                store,
		repoGetter:           repoGetter,
		historicJobs:         historicJobs,
		workers:              workers,
		metrics:              metrics,
	}
}

// processKey claims the job namespace/name and drives it to completion.
// Returns ErrAlreadyClaimed or a NotFound API error when the job is not ours
// to process; both mean the key can be dropped.
func (d *jobProcessor) processKey(ctx context.Context, namespace, name string) error {
	ctx, span := tracing.Start(ctx, "provisioning.jobs.claim_and_process_one_job")
	defer span.End()

	logger := logging.FromContext(ctx)

	// Claim the job to work on.
	claimedJob, rollback, err := d.store.Claim(ctx, namespace, name)
	if err != nil {
		if !errors.Is(err, ErrAlreadyClaimed) && !apierrors.IsNotFound(err) {
			span.RecordError(err)
		}
		return apifmt.Errorf("failed to claim job: %w", err)
	}
	// Ensure that the job is cleaned up if we fail to complete it.
	// The rollback function does not care about cancellations.
	defer rollback()

	logger = logger.With("job", claimedJob.GetName(), "namespace", namespace, "repository", claimedJob.Spec.Repository, "action", claimedJob.Spec.Action)
	ctx = logging.Context(ctx, logger)
	d.currentJob = claimedJob

	span.SetAttributes(
		attribute.String("job.name", claimedJob.GetName()),
		attribute.String("job.namespace", namespace),
		attribute.String("job.repository", claimedJob.Spec.Repository),
		attribute.String("job.action", string(claimedJob.Spec.Action)),
	)

	// Now that we have a job, we need to augment our namespace to grant ourselves permission to work on it.
	// Incidentally, this also limits our permissions to only the namespace of the job.
	ctx = request.WithNamespace(ctx, namespace)
	ctx, _, err = identity.WithProvisioningIdentity(ctx, namespace)
	if err != nil {
		return errors.Join(errPostClaim, apifmt.Errorf("failed to grant provisioning identity: %w", err))
	}

	jobctx, cancel := context.WithTimeout(ctx, d.jobTimeout)
	defer cancel() // Ensure resources are released when the function returns

	// Set up lease renewal goroutine
	leaseRenewalCtx, cancelLeaseRenewal := context.WithCancel(jobctx)
	leaseExpired := make(chan struct{})

	go d.leaseRenewalLoop(leaseRenewalCtx, logger, leaseExpired)
	defer cancelLeaseRenewal()

	recorder := newJobProgressRecorder(d.onProgress(), d.metrics, claimedJob.Spec.Action)
	recorder.SetMessage(ctx, "start job")

	// Process the job with lease loss detection
	err = d.processJobWithLeaseCheck(jobctx, recorder, leaseExpired)
	duration := time.Since(recorder.Started())

	// Check if parent context was cancelled (graceful shutdown)
	if ctx.Err() != nil {
		logger.Warn("context cancelled - job will retry", "duration", duration)
		// Don't complete the job - let it be retried by another worker
		d.mu.Lock()
		d.currentJob = nil
		d.mu.Unlock()
		return nil
	}

	// Capture job timeout (but not parent context cancellation)
	if jobctx.Err() != nil && err == nil && ctx.Err() == nil {
		err = jobctx.Err()
	}

	// Record job processing error on span
	if err != nil {
		span.RecordError(err)
	}

	// Complete the job
	d.mu.Lock()
	// recorder.Complete builds a fresh status, so carry the running progress-update
	// count forward and bump it for this final write -- otherwise the count
	// accumulated during processing would be lost on the historic job.
	progressUpdates := d.currentJob.Status.ProgressUpdates
	d.currentJob.Status = recorder.Complete(ctx, err)
	d.currentJob.Status.ProgressUpdates = progressUpdates + 1
	defer func() {
		d.currentJob = nil
		d.mu.Unlock()
	}()

	// Log completion keyed off the final job state so that per-file errors that
	// promoted the job to an error/warning state (without a top-level err) are
	// still visible. The per-file breakdown stays at Debug to avoid noise at Info.
	status := d.currentJob.Status
	logFields := []any{
		"duration", duration,
		"state", status.State,
		"errorCount", len(status.Errors),
		"warningCount", len(status.Warnings),
		"message", status.Message,
	}
	switch {
	case err != nil:
		logger.Error("job failed", append(logFields, "error", err)...)
	case status.State == provisioning.JobStateError:
		logger.Error("job completed with errors", logFields...)
	case status.State == provisioning.JobStateWarning:
		logger.Warn("job completed with warnings", logFields...)
	default:
		logger.Info("job complete", logFields...)
	}

	if len(status.Errors) > 0 || len(status.Warnings) > 0 {
		logger.Debug("job completion details",
			"errors", status.Errors,
			"warnings", status.Warnings,
			"reasons", recorder.ResultReasons(),
		)
	}

	// Save the finished job
	if err = d.historicJobs.WriteJob(ctx, d.currentJob.DeepCopy()); err != nil {
		logger.Warn("failed to write historic job", "error", err)
	} else {
		logger.Debug("historic job saved")
	}

	// Mark the job as completed.
	if err := d.store.Complete(ctx, d.currentJob); err != nil {
		span.RecordError(err)
		return errors.Join(errPostClaim, apifmt.Errorf("failed to complete job '%s' in '%s': %w", d.currentJob.GetName(), d.currentJob.GetNamespace(), err))
	}

	return nil
}

// leaseRenewalLoop continuously renews the lease for a job until the context is cancelled.
// If lease renewal fails persistently, it signals via the leaseExpired channel.
//
// Note: This function intentionally does NOT create a tracing span because it runs indefinitely
// for the lifetime of a job. Individual RenewLease calls already have their own spans.
func (d *jobProcessor) leaseRenewalLoop(ctx context.Context, logger logging.Logger, leaseExpired chan struct{}) {
	ticker := time.NewTicker(d.leaseRenewalInterval)
	defer ticker.Stop()

	logger.Debug("start lease renewal loop", "renewal_interval", d.leaseRenewalInterval)

	consecutiveFailures := 0
	maxFailures := 3 // Allow a few failures before giving up

	for {
		select {
		case <-ctx.Done():
			logger.Debug("lease renewal loop stopped")
			return
		case <-ticker.C:
			d.mu.Lock()
			if d.currentJob == nil {
				d.mu.Unlock()
				return
			}

			err := d.store.RenewLease(ctx, d.currentJob)
			d.mu.Unlock()

			if err != nil {
				consecutiveFailures++
				// Both cases below are terminal: continuing to run would mean two workers
				// process the same job. Abort immediately rather than retrying, which would
				// only stomp the new owner's claim.

				// Another worker now owns the claim (job reaped and re-claimed on the same name).
				if errors.Is(err, ErrLeaseLost) {
					logger.Error("lease taken over by another worker - aborting job", "error", err)
					close(leaseExpired)
					return
				}

				// The job no longer exists in the store (deleted or reaped before renewal).
				if apierrors.IsNotFound(err) || strings.Contains(err.Error(), "job no longer exists") {
					logger.Error("job no longer exists - aborting job", "error", err)
					close(leaseExpired)
					return
				}

				logger.Warn("failed to renew lease", "error", err, "consecutive_failures", consecutiveFailures)

				if consecutiveFailures >= maxFailures {
					logger.Error("too many consecutive lease renewal failures - job will be aborted",
						"consecutive_failures", consecutiveFailures, "max_failures", maxFailures)
					close(leaseExpired)
					return
				}
			} else {
				if consecutiveFailures > 0 {
					logger.Debug("lease renewal recovered", "previous_failures", consecutiveFailures)
				}
				consecutiveFailures = 0
			}
		}
	}
}

// processJobWithLeaseCheck processes a job but aborts if the lease expires or context is cancelled.
func (d *jobProcessor) processJobWithLeaseCheck(ctx context.Context, recorder JobProgressRecorder, leaseExpired <-chan struct{}) error {
	// Derive a cancellable context for the worker so that losing the lease actively
	// stops the in-flight work, rather than leaving the goroutine running until the
	// caller's deferred cancel fires much later. Otherwise two pods could execute the
	// same job concurrently once another worker takes over the reaped claim.
	workerCtx, cancelWorker := context.WithCancel(ctx)
	defer cancelWorker()

	// Run the job processing in a goroutine so we can monitor lease expiry
	resultChan := make(chan error, 1)
	go func() {
		resultChan <- d.processJob(workerCtx, recorder)
	}()

	select {
	case err := <-resultChan:
		return err
	case <-leaseExpired:
		// Another worker now owns the job. Cancel our worker and wait for it to
		// return so we don't keep running (and later complete) a job we no longer own.
		// Also observe ctx.Done() so a worker that ignores cancellation can't pin this
		// goroutine forever: on job timeout or shutdown we stop waiting and let the
		// caller run its cleanup.
		cancelWorker()
		select {
		case <-resultChan:
		case <-ctx.Done():
		}
		return apifmt.Errorf("job aborted due to lease expiry")
	case <-ctx.Done():
		// Return context error directly - caller will determine if this is due to graceful shutdown
		// or job timeout based on which context was cancelled
		return ctx.Err()
	}
}

// withJobAuthorSignature carries the job's recorded author into ctx as the git
// commit signature. The author annotations are set at creation time by the job
// admission mutator, which is where the user-attribution feature flag is
// enforced; the driver simply applies whatever was recorded on the job. An
// email is required: webhook attribution carries none, so webhook-created jobs
// keep the default Grafana commit identity.
func withJobAuthorSignature(ctx context.Context, job *provisioning.Job) context.Context {
	name := job.Annotations[appjobs.AnnoAuthor]
	email := job.Annotations[appjobs.AnnoAuthorEmail]
	if email == "" {
		return ctx
	}
	return repository.WithAuthorSignature(ctx, repository.CommitSignature{Name: name, Email: email})
}

func (d *jobProcessor) processJob(ctx context.Context, recorder JobProgressRecorder) error {
	ctx, span := tracing.Start(ctx, "provisioning.jobs.process_job")
	defer span.End()

	logger := logging.FromContext(ctx)
	d.mu.Lock()
	if d.currentJob == nil {
		d.mu.Unlock()
		return nil
	}

	// Here it's safe to copy as only job spec is used for processing
	job := d.currentJob.DeepCopy()
	repoName := d.currentJob.Spec.Repository
	namespace := d.currentJob.Namespace
	d.mu.Unlock()

	span.SetAttributes(
		attribute.String("job.repository", repoName),
		attribute.String("job.action", string(job.Spec.Action)),
	)

	ctx = withJobAuthorSignature(ctx, job)

	for _, worker := range d.workers {
		if !worker.IsSupported(ctx, *job) {
			continue
		}

		repo, err := d.repoGetter.GetRepository(ctx, namespace, repoName)
		if err != nil {
			if apierrors.IsNotFound(err) && IsOrphanCleanupAction(job.Spec.Action) {
				logger.Info("repository not found -- expected for orphan cleanup job")
				return worker.Process(ctx, nil, *job, recorder)
			}
			span.RecordError(err)
			return apifmt.Errorf("failed to get repository '%s': %w", repoName, err)
		}

		r := repo.Config()
		connName := r.ConnectionName()
		logger = logger.With("connection", connName, "repositoryType", r.Spec.Type)
		ctx = logging.Context(ctx, logger)
		span.SetAttributes(
			attribute.String("job.connection", connName),
			attribute.String("repository.type", string(r.Spec.Type)),
		)

		if r.DeletionTimestamp != nil && !r.DeletionTimestamp.IsZero() {
			if IsOrphanCleanupAction(job.Spec.Action) {
				logger.Info("repository marked for deletion -- proceeding with cleanup job")
				return worker.Process(ctx, repo, *job, recorder)
			}
			logger.Info("repository marked for deletion - skip job",
				"deletionTimestamp", r.DeletionTimestamp,
			)
			return nil
		}

		if IsOrphanCleanupAction(job.Spec.Action) {
			logger.Info("repository was recreated since cleanup job was queued -- aborting",
				"repository", repoName,
			)
			return apifmt.Errorf("repository '%s' exists and is healthy; orphan cleanup is no longer needed", repoName)
		}

		if appcontroller.IsPendingDelete(r.Labels) {
			logger.Info("repository namespace is pending deletion - skip job")
			recorder.Record(ctx, NewPathOnlyResult(repoName).WithWarning(errors.New("repository namespace is pending deletion - job skipped")).Build())
			return nil
		}

		err = worker.Process(ctx, repo, *job, recorder)
		if err != nil {
			span.RecordError(err)
		}
		return err
	}

	err := apifmt.Errorf("no workers were registered to handle the job")
	span.RecordError(err)
	return err
}

func (d *jobProcessor) onProgress() ProgressFn {
	return func(ctx context.Context, status provisioning.JobStatus) error {
		ctx, span := tracing.Start(ctx, "provisioning.jobs.update_progress")
		defer span.End()

		logging.FromContext(ctx).Debug("job progress", "status", status)

		const maxRetries = 3
		for attempt := 0; attempt < maxRetries; attempt++ {
			d.mu.Lock()
			if d.currentJob == nil {
				d.mu.Unlock()
				return nil
			}

			// Use the current job for the first attempt; on retry attempts, fetch fresh data from the store to resolve conflicts
			if attempt > 0 {
				// Fetch the latest version to resolve conflicts
				latest, err := d.store.Get(ctx, d.currentJob.GetNamespace(), d.currentJob.GetName())
				if err != nil {
					d.mu.Unlock()
					if apierrors.IsNotFound(err) {
						// Job was completed/deleted, nothing to update
						return nil
					}
					return apifmt.Errorf("failed to fetch job for progress update: %w", err)
				}

				*d.currentJob = *latest
			}

			// Build the candidate on a copy so a failed write never mutates our
			// in-memory job: the recorder ignores progress errors and keeps going,
			// so leaving an increment behind would count writes that never persisted.
			// The incoming status replaces the whole status object, so carry the
			// progress-update count forward and bump it for this write.
			candidate := d.currentJob.DeepCopy()
			candidate.Status = status
			candidate.Status.ProgressUpdates = d.currentJob.Status.ProgressUpdates + 1
			updated, err := d.store.Update(ctx, candidate)
			if err != nil {
				if apierrors.IsConflict(err) && attempt < maxRetries-1 {
					d.mu.Unlock()
					logging.FromContext(ctx).Debug("progress update conflict, retrying", "attempt", attempt+1)
					continue
				}
				d.mu.Unlock()
				return apifmt.Errorf("failed to update job progress: %w", err)
			}

			// Update succeeded, commit the persisted state to our local copy.
			*d.currentJob = *updated
			d.mu.Unlock()

			span.SetAttributes(
				attribute.String("job.state", string(status.State)),
				attribute.Int("attempt", attempt+1),
			)
			return nil
		}

		err := apifmt.Errorf("failed to update job progress after %d attempts", maxRetries)
		span.RecordError(err)
		return err
	}
}
