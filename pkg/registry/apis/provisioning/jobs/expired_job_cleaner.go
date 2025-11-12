package jobs

import (
	"context"
	"time"

	"github.com/grafana/grafana-app-sdk/logging"
	"github.com/grafana/grafana/apps/provisioning/pkg/apifmt"
	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
)

// JobLister provides methods to list jobs for cleanup purposes.
//
//go:generate mockery --name JobLister --structname MockJobLister --inpackage --filename job_lister_mock.go --with-expecter
type JobLister interface {
	// ListExpiredJobs lists jobs with expired leases (claim timestamp older than the given time).
	// Returns jobs in batches up to the specified limit.
	ListExpiredJobs(ctx context.Context, expiredBefore time.Time, limit int) ([]*provisioning.Job, error)
}

// JobCleaner handles cleanup of expired/abandoned jobs.
//
//go:generate mockery --name JobCleaner --structname MockJobCleaner --inpackage --filename job_cleaner_mock.go --with-expecter
type JobCleaner interface {
	// Cleanup finds jobs with expired leases and marks them as failed.
	// This should be called periodically to clean up jobs from crashed workers.
	Cleanup(ctx context.Context) error

	// Run starts a cleanup loop that runs at the specified interval.
	// This is a blocking function that runs until the context is canceled.
	Run(ctx context.Context, cleanupInterval time.Duration) error
}

// ExpiredJobCleaner handles cleanup of expired/abandoned jobs.
type ExpiredJobCleaner struct {
	lister JobLister
	store  Store
	clock  func() time.Time
	expiry time.Duration
}

// Ensure ExpiredJobCleaner implements JobCleaner
var _ JobCleaner = (*ExpiredJobCleaner)(nil)

// NewExpiredJobCleaner creates a new expired job cleaner.
func NewExpiredJobCleaner(lister JobLister, store Store, expiry time.Duration) *ExpiredJobCleaner {
	return &ExpiredJobCleaner{
		lister: lister,
		store:  store,
		clock:  time.Now,
		expiry: expiry,
	}
}

// Cleanup finds jobs with expired leases and marks them as failed.
// This should be called periodically to clean up jobs from crashed workers.
func (c *ExpiredJobCleaner) Cleanup(ctx context.Context) error {
	logger := logging.FromContext(ctx)

	// Find jobs with expired leases
	expiredBefore := c.clock().Add(-c.expiry)

	// Process in batches of 100 to avoid overwhelming the system
	const batchSize = 100
	jobs, err := c.lister.ListExpiredJobs(ctx, expiredBefore, batchSize)
	if err != nil {
		return apifmt.Errorf("failed to list jobs with expired leases: %w", err)
	}

	// If no jobs found, cleanup is complete
	if len(jobs) == 0 {
		return nil
	}

	logger.Info("cleaning up expired jobs", "count", len(jobs))

	for _, job := range jobs {
		// Mark job as failed due to lease expiry
		job := job.DeepCopy()
		job.Status.State = provisioning.JobStateError
		job.Status.Message = "Job failed due to lease expiry - worker may have crashed or lost connection"
		job.Status.Finished = c.clock().Unix()

		// Set namespace context for the completion
		ctx, _, err = identity.WithProvisioningIdentity(ctx, job.GetNamespace())
		if err != nil {
			return apifmt.Errorf("failed to get provisioning identity for '%s': %w", job.GetNamespace(), err)
		}

		jobLogger := logger.With("namespace", job.GetNamespace(), "job", job.GetName())

		// Complete will handle writing to history and deleting from active queue
		if err := c.store.Complete(ctx, job); err != nil {
			if apierrors.IsNotFound(err) {
				// Job was already completed/deleted by another process
				jobLogger.Debug("job already deleted during cleanup")
				continue
			}
			return apifmt.Errorf("failed to complete expired job '%s' in '%s': %w", job.GetName(), job.GetNamespace(), err)
		}
		jobLogger.Debug("cleaned up expired job")
	}

	return nil
}

// Run starts a cleanup loop that runs at the specified interval.
// This is a blocking function that runs until the context is canceled.
func (c *ExpiredJobCleaner) Run(ctx context.Context, cleanupInterval time.Duration) error {
	logger := logging.FromContext(ctx).With("logger", "job-cleaner")
	logger.Info("starting job cleaner", "cleanup_interval", cleanupInterval, "expiry", c.expiry)

	// Initial cleanup
	if err := c.Cleanup(ctx); err != nil {
		logger.Error("failed to clean up old jobs at start", "error", err)
	}

	ticker := time.NewTicker(cleanupInterval)
	defer ticker.Stop()

	for {
		select {
		case <-ticker.C:
			if err := c.Cleanup(ctx); err != nil {
				logger.Error("failed to cleanup jobs", "error", err)
			}
		case <-ctx.Done():
			logger.Debug("job cleaner stopping")
			return ctx.Err()
		}
	}
}
