package jobs

import (
	"context"
	"time"

	"go.opentelemetry.io/otel/attribute"

	"github.com/grafana/grafana-app-sdk/logging"
	"github.com/grafana/grafana/apps/provisioning/pkg/apifmt"
	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/infra/tracing"
)

// JobCleanupController handles cleanup of expired/abandoned jobs.
type JobCleanupController struct {
	store           Store
	historicJobs    HistoryWriter
	clock           func() time.Time
	expiry          time.Duration
	cleanupInterval time.Duration
}

// NewJobCleanupController creates a new job cleanup controller.
func NewJobCleanupController(
	store Store,
	historicJobs HistoryWriter,
	expiry time.Duration,
) *JobCleanupController {
	// Calculate cleanup interval based on expiry duration
	// Run cleanup every 3-4 expiry intervals to detect expired leases promptly but not too aggressively
	cleanupInterval := expiry * 3

	// Enforce minimum and maximum bounds
	if cleanupInterval < 30*time.Second {
		cleanupInterval = 30 * time.Second
	}
	if cleanupInterval > 5*time.Minute {
		cleanupInterval = 5 * time.Minute
	}

	return &JobCleanupController{
		store:           store,
		historicJobs:    historicJobs,
		clock:           time.Now,
		expiry:          expiry,
		cleanupInterval: cleanupInterval,
	}
}

// Run starts the cleanup loop that runs at an appropriate interval.
// This is a blocking function that runs until the context is canceled.
func (c *JobCleanupController) Run(ctx context.Context) error {
	logger := logging.FromContext(ctx).With("logger", "job-cleanup-controller")
	ctx = logging.Context(ctx, logger)

	// Set up provisioning identity to access jobs across all namespaces
	ctx, _, err := identity.WithProvisioningIdentity(ctx, "*")
	if err != nil {
		return apifmt.Errorf("failed to grant provisioning identity for cleanup: %w", err)
	}

	logger.Info("starting job cleanup controller", "cleanup_interval", c.cleanupInterval, "expiry", c.expiry)

	// Initial cleanup
	if err := c.Cleanup(ctx); err != nil {
		logger.Error("failed to clean up jobs at start", "error", err)
	}

	ticker := time.NewTicker(c.cleanupInterval)
	defer ticker.Stop()

	for {
		select {
		case <-ticker.C:
			if err := c.Cleanup(ctx); err != nil {
				logger.Error("failed to cleanup jobs", "error", err)
			}
		case <-ctx.Done():
			logger.Info("job cleanup controller stopping")
			return ctx.Err()
		}
	}
}

// Cleanup finds jobs with expired leases and marks them as failed.
// This should be called periodically to clean up jobs from crashed workers.
func (c *JobCleanupController) Cleanup(ctx context.Context) error {
	ctx, span := tracing.Start(ctx, "provisioning.jobs.cleanup")
	defer span.End()

	startTime := c.clock()
	logger := logging.FromContext(ctx)

	// Find jobs with expired leases
	expiredBefore := c.clock().Add(-c.expiry)

	// Process in batches of 100 to avoid overwhelming the system
	const batchSize = 100
	jobs, err := c.store.ListExpiredJobs(ctx, expiredBefore, batchSize)
	if err != nil {
		span.RecordError(err)
		return apifmt.Errorf("failed to list jobs with expired leases: %w", err)
	}

	// If no jobs found, cleanup is complete
	if len(jobs) == 0 {
		duration := c.clock().Sub(startTime)
		span.SetAttributes(
			attribute.Int("count", 0),
			attribute.Int64("duration_ms", duration.Milliseconds()),
		)
		return nil
	}

	logger.Info("cleaning up expired jobs", "count", len(jobs))

	for _, job := range jobs {
		if err := c.cleanUpExpiredJob(ctx, job); err != nil {
			// Log error but continue processing other jobs
			logger.Error("failed to clean up expired job", "error", err, "job", job.GetName(), "namespace", job.GetNamespace())
		}
	}

	duration := c.clock().Sub(startTime)
	logger.Info("cleanup complete", "duration", duration, "count", len(jobs))

	span.SetAttributes(
		attribute.Int("count", len(jobs)),
		attribute.Int64("duration_ms", duration.Milliseconds()),
	)

	return nil
}

// cleanUpExpiredJob marks a single expired job as failed and archives it.
func (c *JobCleanupController) cleanUpExpiredJob(ctx context.Context, job *provisioning.Job) error {
	ctx, span := tracing.Start(ctx, "provisioning.jobs.cleanup.complete_expired_job")
	defer span.End()

	// Mark job as failed due to lease expiry
	jobCopy := job.DeepCopy()
	jobCopy.Status.State = provisioning.JobStateError
	jobCopy.Status.Message = "Job failed due to lease expiry - worker may have crashed or lost connection"
	jobCopy.Status.Finished = c.clock().Unix()

	span.SetAttributes(
		attribute.String("job.name", jobCopy.GetName()),
		attribute.String("job.namespace", jobCopy.GetNamespace()),
		attribute.String("job.repository", jobCopy.Spec.Repository),
		attribute.String("job.action", string(jobCopy.Spec.Action)),
	)

	jobLogger := logging.FromContext(ctx).With("namespace", jobCopy.GetNamespace(), "job", jobCopy.GetName(), "action", jobCopy.Spec.Action)

	// Delete from active job store first
	if err := c.store.Complete(ctx, jobCopy); err != nil {
		span.RecordError(err)
		return apifmt.Errorf("failed to complete expired job: %w", err)
	}

	// Remove the claim label before archiving
	if jobCopy.Labels != nil {
		delete(jobCopy.Labels, LabelJobClaim)
	}

	// Write to history after deleting from active store (matching driver.go pattern)
	if err := c.historicJobs.WriteJob(ctx, jobCopy); err != nil {
		span.RecordError(err)
		jobLogger.Warn("failed to write expired job to history", "error", err)
		// Job was already deleted, so we can't recover from this
	}

	jobLogger.Debug("cleaned up expired job")
	return nil
}
