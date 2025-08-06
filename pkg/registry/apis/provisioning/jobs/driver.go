package jobs

import (
	"context"
	"errors"
	"strings"
	"time"

	apierrors "k8s.io/apimachinery/pkg/api/errors"
	"k8s.io/apiserver/pkg/endpoints/request"

	"github.com/grafana/grafana-app-sdk/logging"
	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
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

	// RenewLease renews the lease for a claimed job, extending its expiry time.
	// Returns an error if the lease cannot be renewed (e.g., job was completed or lease expired).
	RenewLease(ctx context.Context, job *provisioning.Job) error
}

var _ Store = (*persistentStore)(nil)

// jobDriver drives jobs to completion and manages the job queue.
// There may be multiple jobDrivers running in parallel.
// The jobDriver processes jobs but does not handle cleanup - that's handled by ConcurrentJobDriver.
type jobDriver struct {
	// Timeout for processing a job. This must be less than a claim expiry.
	jobTimeout time.Duration

	// JobInterval is the time between job ticks. This should be relatively low.
	jobInterval time.Duration

	// LeaseRenewalInterval is how often to renew job leases.
	leaseRenewalInterval time.Duration

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
	jobTimeout, jobInterval, leaseRenewalInterval time.Duration,
	store Store,
	repoGetter RepoGetter,
	historicJobs History,
	workers ...Worker,
) (*jobDriver, error) {
	return &jobDriver{
		jobTimeout:           jobTimeout,
		jobInterval:          jobInterval,
		leaseRenewalInterval: leaseRenewalInterval,
		store:                store,
		repoGetter:           repoGetter,
		historicJobs:         historicJobs,
		workers:              workers,
	}, nil
}

// Run drives jobs to completion. This is a blocking function.
// It will run until the context is canceled or an error occurs.
// This is a thread-safe function; it may be called from multiple goroutines.
func (d *jobDriver) Run(ctx context.Context) error {
	jobTicker := time.NewTicker(d.jobInterval)
	defer jobTicker.Stop()

	logger := logging.FromContext(ctx).With("logger", "job-driver")
	ctx = logging.Context(ctx, logger)
	ctx, _, err := identity.WithProvisioningIdentity(ctx, "*") // "*" grants us access to all namespaces.
	if err != nil {
		return apifmt.Errorf("failed to grant provisioning identity: %w", err)
	}

	// Drive without waiting on startup.
	d.processJobsUntilDoneOrError(ctx)

	for {
		select {
		case <-ctx.Done():
			return ctx.Err()
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

	// Set up lease renewal goroutine
	leaseRenewalCtx, cancelLeaseRenewal := context.WithCancel(jobctx)
	leaseExpired := make(chan struct{})
	
	go d.leaseRenewalLoop(leaseRenewalCtx, job, logger, leaseExpired)
	defer cancelLeaseRenewal()

	recorder := newJobProgressRecorder(d.onProgress(job))

	// Process the job with lease loss detection
	start := time.Now()
	job.Status.Started = start.UnixMilli()
	err = d.processJobWithLeaseCheck(jobctx, job, recorder, leaseExpired)
	end := time.Now()
	logger.Debug("job processed", "duration", end.Sub(start), "error", err)

	// Capture job timeout
	if jobctx.Err() != nil && err == nil {
		err = jobctx.Err()
	}

	job.Status = recorder.Complete(ctx, err)

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

// leaseRenewalLoop continuously renews the lease for a job until the context is cancelled.
// If lease renewal fails persistently, it signals via the leaseExpired channel.
func (d *jobDriver) leaseRenewalLoop(ctx context.Context, job *provisioning.Job, logger logging.Logger, leaseExpired chan struct{}) {
	ticker := time.NewTicker(d.leaseRenewalInterval)
	defer ticker.Stop()

	logger.Debug("starting lease renewal loop", "renewal_interval", d.leaseRenewalInterval)

	consecutiveFailures := 0
	maxFailures := 3 // Allow a few failures before giving up

	for {
		select {
		case <-ctx.Done():
			logger.Debug("lease renewal loop stopping")
			return
		case <-ticker.C:
			err := d.store.RenewLease(ctx, job)
			if err != nil {
				consecutiveFailures++
				if apierrors.IsNotFound(err) || 
				   strings.Contains(err.Error(), "job no longer exists") {
					logger.Error("job no longer exists - lease expired", "error", err)
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
				logger.Debug("lease renewed successfully")
			}
		}
	}
}

// processJobWithLeaseCheck processes a job but aborts if the lease expires.
func (d *jobDriver) processJobWithLeaseCheck(ctx context.Context, job *provisioning.Job, recorder JobProgressRecorder, leaseExpired <-chan struct{}) error {
	// Run the job processing in a goroutine so we can monitor lease expiry
	resultChan := make(chan error, 1)
	go func() {
		resultChan <- d.processJob(ctx, job, recorder)
	}()

	select {
	case err := <-resultChan:
		return err
	case <-leaseExpired:
		return apifmt.Errorf("job aborted due to lease expiry")
	case <-ctx.Done():
		return ctx.Err()
	}
}

func (d *jobDriver) processJob(ctx context.Context, job *provisioning.Job, recorder JobProgressRecorder) error {
	for _, worker := range d.workers {
		if !worker.IsSupported(ctx, *job) {
			continue
		}

		repo, err := d.repoGetter.GetRepository(ctx, job.Spec.Repository)
		if err != nil {
			return apifmt.Errorf("failed to get repository '%s': %w", job.Spec.Repository, err)
		}

		return worker.Process(ctx, repo, *job, recorder)
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
