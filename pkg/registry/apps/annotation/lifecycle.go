package annotation

import (
	"context"
	"time"

	"go.opentelemetry.io/otel/codes"
)

// startCleanup starts a background goroutine that periodically runs cleanup on the store
func (a *AppInstaller) startCleanup(parentCtx context.Context, lifecycleMgr LifecycleManager, retentionTTL time.Duration) {
	ctx, cancel := context.WithCancel(parentCtx)
	a.cleanupCancel = cancel

	a.cleanupWg.Add(1)
	go func() {
		defer a.cleanupWg.Done()

		ticker := time.NewTicker(cleanupInterval)
		defer ticker.Stop()

		a.logger.Info("Starting annotation cleanup loop", "interval", cleanupInterval, "retention", retentionTTL)

		// Run immediately on startup
		a.runCleanup(ctx, lifecycleMgr)

		for {
			select {
			case <-ticker.C:
				a.runCleanup(ctx, lifecycleMgr)
			case <-ctx.Done():
				a.logger.Info("Stopping annotation cleanup loop")
				return
			}
		}
	}()
}

// runCleanup executes the cleanup operation with a timeout
func (a *AppInstaller) runCleanup(ctx context.Context, lifecycleMgr LifecycleManager) {
	// Set a 5-minute timeout for the cleanup
	ctx, cancel := context.WithTimeout(ctx, 5*time.Minute)
	defer cancel()

	ctx, span := a.tracer.Start(ctx, "annotation.cleanup")
	defer span.End()

	start := time.Now()
	deleted, err := lifecycleMgr.Cleanup(ctx)
	dur := time.Since(start)

	if err != nil {
		span.RecordError(err)
		span.SetStatus(codes.Error, err.Error())
		a.metrics.CleanupRuns.WithLabelValues("failure").Inc()
		a.logger.Error("Annotation cleanup failed", "error", err, "duration", dur)
		return
	}

	a.metrics.CleanupRuns.WithLabelValues("success").Inc()
	a.metrics.CleanupDuration.Observe(dur.Seconds())
	a.metrics.CleanupRowsDeleted.Add(float64(deleted))
	a.logger.Info("Annotation cleanup completed", "rows_deleted", deleted, "duration", dur)
}
