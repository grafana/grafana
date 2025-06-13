package jobs

import (
	"context"
	"errors"
	"fmt"
	"time"

	"k8s.io/apiserver/pkg/endpoints/request"

	"github.com/grafana/grafana-app-sdk/logging"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	provisioning "github.com/grafana/grafana/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/apifmt"
)

// Store is an abstraction for the storage API.
// This exists to allow for unit testing.
//
//go:generate mockery --name Store --structname MockStore --inpackage --filename store_mock.go --with-expecter
type Store interface {
	// Claim takes a job from storage, marks it as ours, and returns it.
	//
	// Any job which has not been claimed by another worker is fair game.
	//
	// If err is not nil, the job and rollback values are always nil.
	// The err may be ErrNoJobs if there are no jobs to claim.
	Claim(ctx context.Context) (job *provisioning.Job, rollback func(), err error)

	// Complete marks a job as completed and moves it to the historic job store.
	// When in the historic store, there is no more claim on the job.
	Complete(ctx context.Context, job *provisioning.Job) error

	// Cleanup should be called periodically to clean up abandoned jobs.
	// An abandoned job is one that has been claimed by a worker, but the worker has not updated the job in a while.
	Cleanup(ctx context.Context) error

	// InsertNotifications returns a channel that will have a value sent to it when a new job is inserted.
	// This is used to wake up the job driver when a new job is inserted.
	InsertNotifications() chan struct{}

	// Update saves the job back to the store.
	Update(ctx context.Context, job *provisioning.Job) (*provisioning.Job, error)
}

var _ Store = (*persistentStore)(nil)

// jobDriver drives jobs to completion and manages the job queue.
// There may be multiple jobDrivers running in parallel.
// The jobDriver deals with cleaning up upon death and ensuring that jobs remain claimable.
type jobDriver struct {
	// Timeout for processing a job. This must be less than a claim expiry.
	jobTimeout time.Duration

	// CleanupInterval is the time between cleanup runs.
	cleanupInterval time.Duration

	// JobInterval is the time between job ticks. This should be relatively low.
	jobInterval time.Duration

	// Store is the job storage backend.
	store Store
	// RepoGetter lets us access repositories to pass to the worker.
	repoGetter RepoGetter

	// save info about finished jobs
	historicJobs History

	// Workers process the job.
	// Only the first worker who supports the job will process it; the rest are ignored.
	workers []Worker
}

func NewJobDriver(
	jobTimeout, cleanupInterval, jobInterval time.Duration,
	store Store,
	repoGetter RepoGetter,
	historicJobs History,
	workers ...Worker,
) (*jobDriver, error) {
	if cleanupInterval < jobTimeout {
		return nil, fmt.Errorf("the cleanup interval must be larger than the jobTimeout (cleanup:%s < job:%s)",
			cleanupInterval.String(), jobTimeout.String())
	}
	return &jobDriver{
		jobTimeout:      jobTimeout,
		cleanupInterval: cleanupInterval,
		jobInterval:     jobInterval,
		store:           store,
		repoGetter:      repoGetter,
		historicJobs:    historicJobs,
		workers:         workers,
	}, nil
}

// Run drives jobs to completion. This is a blocking function.
// It will run until the context is canceled.
// This is a thread-safe function; it may be called from multiple goroutines.
func (d *jobDriver) Run(ctx context.Context) {
	cleanupTicker := time.NewTicker(d.cleanupInterval)
	defer cleanupTicker.Stop()

	jobTicker := time.NewTicker(d.jobInterval)
	defer jobTicker.Stop()

	logger := logging.FromContext(ctx).With("logger", "job-driver")
	ctx = logging.Context(ctx, logger)
	ctx, _, err := identity.WithProvisioningIdentity(ctx, "*") // "*" grants us access to all namespaces.
	if err != nil {
		logger.Error("failed to grant provisioning identity; this will panic!", "error", err)
		panic("unreachable?: failed to grant provisioning identity: " + err.Error())
	}

	// Remove old jobs
	if err = d.store.Cleanup(ctx); err != nil {
		logger.Error("failed to clean up old jobs at start", "error", err)
	}

	// Drive without waiting on startup.
	d.processJobsUntilDoneOrError(ctx)

	for {
		select {
		case <-cleanupTicker.C:
			if err := d.store.Cleanup(ctx); err != nil {
				logger.Error("failed to cleanup jobs", "error", err)
			}

		// These events do not queue if the worker is already running
		case <-jobTicker.C:
			d.processJobsUntilDoneOrError(ctx)
		case <-d.store.InsertNotifications():
			d.processJobsUntilDoneOrError(ctx)
		}
	}
}

// This will keep processing jobs until there are none left (or we hit an error)
func (d *jobDriver) processJobsUntilDoneOrError(ctx context.Context) {
	for {
		err := d.claimAndProcessOneJob(ctx)
		if err != nil {
			if !errors.Is(err, ErrNoJobs) {
				logging.FromContext(ctx).Error("failed to drive jobs", "error", err)
			}
			return
		}
	}
}

func (d *jobDriver) claimAndProcessOneJob(ctx context.Context) error {
	logger := logging.FromContext(ctx)

	// Claim a job to work on.
	job, rollback, err := d.store.Claim(ctx)
	if err != nil {
		return apifmt.Errorf("failed to claim job: %w", err)
	}
	// Ensure that the job is cleaned up if we fail to complete it.
	// The rollback function does not care about cancellations.
	defer rollback()

	logger = logger.With("job", job.GetName(), "namespace", job.GetNamespace())
	ctx = logging.Context(ctx, logger)
	logger.Debug("claimed a job")

	// Now that we have a job, we need to augment our namespace to grant ourselves permission to work on it.
	// Incidentally, this also limits our permissions to only the namespace of the job.
	ctx = request.WithNamespace(ctx, job.GetNamespace())
	ctx, _, err = identity.WithProvisioningIdentity(ctx, job.GetNamespace())
	if err != nil {
		return apifmt.Errorf("failed to grant provisioning identity: %w", err)
	}

	jobctx, cancel := context.WithTimeout(ctx, d.jobTimeout)
	defer cancel() // Ensure resources are released when the function returns

	// Process the job.
	start := time.Now()
	job.Status.Started = start.UnixMilli()
	err = d.processJob(jobctx, job) // NOTE: We pass in a pointer here such that the job status can be kept in Complete without re-fetching.
	end := time.Now()
	logger.Debug("job processed", "duration", end.Sub(start), "error", err)

	// Capture job timeout
	if jobctx.Err() != nil && err == nil {
		err = jobctx.Err()
	}

	// Mark the job as failed and remove from queue
	if err != nil {
		job.Status.State = provisioning.JobStateError
		job.Status.Errors = append(job.Status.Errors, err.Error())
	}

	job.Status.Progress = 0 // clear progressbar
	job.Status.Finished = end.UnixMilli()
	if !job.Status.State.Finished() {
		job.Status.State = provisioning.JobStateSuccess // no error
	}

	// Save the finished job
	err = d.historicJobs.WriteJob(ctx, job.DeepCopy())
	if err != nil {
		// We're not going to return this as it is not critical. Not ideal, but not critical.
		logger.Warn("failed to create historic job", "historic_job", *job, "error", err)
	} else {
		logger.Debug("created historic job", "historic_job", *job)
	}

	// Mark the job as completed.
	if err := d.store.Complete(ctx, job); err != nil {
		return apifmt.Errorf("failed to complete job '%s' in '%s': %w", job.GetName(), job.GetNamespace(), err)
	}
	logger.Debug("job completed")

	return nil
}

func (d *jobDriver) processJob(ctx context.Context, job *provisioning.Job) error {
	for _, worker := range d.workers {
		if !worker.IsSupported(ctx, *job) {
			continue
		}

		repo, err := d.repoGetter.GetRepository(ctx, job.Spec.Repository)
		if err != nil {
			return apifmt.Errorf("failed to get repository '%s': %w", job.Spec.Repository, err)
		}

		recorder := newJobProgressRecorder(d.onProgress(job))

		err = worker.Process(ctx, repo, *job, recorder)
		if err != nil {
			return apifmt.Errorf("worker failed to process job: %w", err)
		}

		job.Status = recorder.Complete(ctx, err)

		return nil
	}

	return apifmt.Errorf("no workers were registered to handle the job")
}

func (d *jobDriver) onProgress(job *provisioning.Job) ProgressFn {
	return func(ctx context.Context, status provisioning.JobStatus) error {
		logging.FromContext(ctx).Debug("job progress", "status", status)
		job.Status = status

		updated, err := d.store.Update(ctx, job)
		if err != nil {
			return apifmt.Errorf("failed to update job: %w", err)
		}

		*job = *updated
		return nil
	}
}
