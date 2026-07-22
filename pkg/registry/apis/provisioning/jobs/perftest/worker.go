// Package perftest implements a synthetic provisioning job type used purely for
// load and performance testing of the job queue, the concurrent job driver, and
// the watch/NATS notification path. It performs no real repository work.
package perftest

import (
	"context"
	"errors"
	"fmt"
	"time"

	"go.opentelemetry.io/otel/attribute"

	"github.com/grafana/grafana-app-sdk/logging"
	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/apps/provisioning/pkg/repository"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/jobs"
)

// defaultProgressUpdates is how many progress notifications a test job emits
// over its lifetime when spec.test.progressUpdates is not set.
const defaultProgressUpdates = 10

// Worker implements the synthetic "test" job type. It does no repository work:
// it sleeps for the configured duration, emits a handful of progress updates
// along the way, and then completes successfully. IsSupported returns false
// unless the provisioning.performance feature flag is enabled, so leaving the
// worker registered is a no-op in normal deployments (mirroring the export
// worker's runtime gating).
type Worker struct {
	enabled func(ctx context.Context) bool
}

// NewWorker creates a performance-testing worker. enabled is evaluated per job so
// the feature flag is honored dynamically; when it reports false (or is nil) the
// worker never claims a job.
func NewWorker(enabled func(ctx context.Context) bool) *Worker {
	return &Worker{enabled: enabled}
}

func (w *Worker) IsSupported(ctx context.Context, job provisioning.Job) bool {
	return job.Spec.Action == provisioning.JobActionTest && w.enabled != nil && w.enabled(ctx)
}

func (w *Worker) Process(ctx context.Context, _ repository.Repository, job provisioning.Job, progress jobs.JobProgressRecorder) (processErr error) {
	if job.Spec.Test == nil {
		return errors.New("missing test settings")
	}
	duration := job.Spec.Test.Duration.Duration
	if duration <= 0 {
		return errors.New("test duration must be positive")
	}
	progressUpdates := job.Spec.Test.ProgressUpdates
	if progressUpdates <= 0 {
		progressUpdates = defaultProgressUpdates
	}

	// The recorder coalesces updates emitted closer than NotifyThrottleInterval,
	// so cap the count to what the duration can actually persist — otherwise the
	// advertised total exceeds the events produced. Validation rejects explicit
	// over-requests; this also covers the default count on a short duration.
	if maxUpdates := int(duration / jobs.NotifyThrottleInterval); maxUpdates < progressUpdates {
		if maxUpdates < 1 {
			maxUpdates = 1
		}
		progressUpdates = maxUpdates
	}

	logger := logging.FromContext(ctx).With("duration", duration, "progressUpdates", progressUpdates)
	ctx = logging.Context(ctx, logger)
	ctx, span := tracing.Start(ctx, "provisioning.perftest.process")
	defer func() {
		if processErr != nil {
			_ = tracing.Error(span, processErr)
		}
		span.End()
	}()
	span.SetAttributes(attribute.String("perftest.duration", duration.String()))

	progress.SetTotal(ctx, progressUpdates)
	logger.Info("starting performance-test job")

	// Emit progress updates at even intervals so the job drives the
	// store.Update / watch-notification path the way a real job would, then
	// completes once the full duration has elapsed. A very short duration may
	// yield a non-positive interval, so clamp it to the whole duration.
	interval := duration / time.Duration(progressUpdates)
	if interval <= 0 {
		interval = duration
	}
	ticker := time.NewTicker(interval)
	defer ticker.Stop()

	deadline := time.NewTimer(duration)
	defer deadline.Stop()

	step := 0
	for {
		// Cancellation (job timeout, lease loss, or shutdown) is honored
		// promptly so the driver can hand the job to another worker.
		select {
		case <-ctx.Done():
			return ctx.Err()
		case <-deadline.C:
			progress.SetFinalMessage(ctx, fmt.Sprintf("performance-test job slept for %s", duration))
			logger.Info("performance-test job completed")
			return nil
		case <-ticker.C:
			step++
			progress.Record(ctx, jobs.NewResourceResult().
				WithAction(repository.FileActionCreated).
				WithName(fmt.Sprintf("perftest-%d", step)).
				Build())
			progress.SetMessage(ctx, fmt.Sprintf("performance-test job running (%d/%d)", step, progressUpdates))
		}
	}
}
