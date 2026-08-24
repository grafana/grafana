package annotation

import (
	"context"
	"time"

	"go.opentelemetry.io/otel/codes"
)

// startCleanup starts a background goroutine that periodically runs TTL and
// namespace-cap cleanup on the store. capEnforcer is nil when the store
// backend doesn't support namespace-cap enforcement (e.g. gRPC).
func (a *AppInstaller) startCleanup(parentCtx context.Context, lifecycleMgr LifecycleManager, retentionTTL time.Duration, capEnforcer NamespaceCapEnforcer, maxPerNamespace int64) {
	if retentionTTL <= 0 && maxPerNamespace <= 0 {
		a.logger.Info("Annotation cleanup disabled (no retention TTL or namespace cap configured)")
		return
	}

	if maxPerNamespace > 0 && capEnforcer == nil {
		a.logger.Warn("max_annotations_per_namespace is configured but the store backend does not support namespace-cap enforcement; ignoring", "max_annotations_per_namespace", maxPerNamespace)
		maxPerNamespace = 0
	}

	ctx, cancel := context.WithCancel(parentCtx)
	a.cleanupCancel = cancel

	a.cleanupWg.Add(1)
	go func() {
		defer a.cleanupWg.Done()

		ticker := time.NewTicker(cleanupInterval)
		defer ticker.Stop()

		a.logger.Info("Starting annotation cleanup loop", "interval", cleanupInterval, "retention", retentionTTL, "max_annotations_per_namespace", maxPerNamespace)

		// Run immediately on startup
		a.runCleanup(ctx, lifecycleMgr, retentionTTL, capEnforcer, maxPerNamespace)

		for {
			select {
			case <-ticker.C:
				a.runCleanup(ctx, lifecycleMgr, retentionTTL, capEnforcer, maxPerNamespace)
			case <-ctx.Done():
				a.logger.Info("Stopping annotation cleanup loop")
				return
			}
		}
	}()
}

// runCleanup executes the TTL and namespace-cap cleanup operations, each
// under its own timeout, so a slow/failing one doesn't block the other.
func (a *AppInstaller) runCleanup(ctx context.Context, lifecycleMgr LifecycleManager, retentionTTL time.Duration, capEnforcer NamespaceCapEnforcer, maxPerNamespace int64) {
	if retentionTTL > 0 {
		a.runTTLCleanup(ctx, lifecycleMgr, retentionTTL)
	}
	if maxPerNamespace > 0 {
		a.runNamespaceCapCleanup(ctx, capEnforcer, maxPerNamespace)
	}
}

func (a *AppInstaller) runTTLCleanup(ctx context.Context, lifecycleMgr LifecycleManager, retentionTTL time.Duration) {
	// Set a 5-minute timeout for the cleanup
	ctx, cancel := context.WithTimeout(ctx, 5*time.Minute)
	defer cancel()

	ctx, span := tracer.Start(ctx, "annotation.cleanup")
	defer span.End()

	before := time.Now().UTC().Add(-retentionTTL)
	start := time.Now()
	deleted, err := lifecycleMgr.Cleanup(ctx, before)
	dur := time.Since(start)

	if err != nil {
		span.RecordError(err)
		span.SetStatus(codes.Error, err.Error())
		a.metrics.CleanupRuns.WithLabelValues("failure").Inc()
		a.logger.Error("Annotation TTL cleanup failed", "error", err, "duration", dur)
		return
	}

	a.metrics.CleanupRuns.WithLabelValues("success").Inc()
	a.metrics.CleanupDuration.Observe(dur.Seconds())
	a.metrics.CleanupRowsDeleted.Add(float64(deleted))
	a.logger.Info("Annotation TTL cleanup completed", "rows_deleted", deleted, "duration", dur)
}

func (a *AppInstaller) runNamespaceCapCleanup(ctx context.Context, capEnforcer NamespaceCapEnforcer, maxPerNamespace int64) {
	// Set a 5-minute timeout for the cleanup
	ctx, cancel := context.WithTimeout(ctx, 5*time.Minute)
	defer cancel()

	ctx, span := tracer.Start(ctx, "annotation.namespace_cap_cleanup")
	defer span.End()

	start := time.Now()
	deleted, err := capEnforcer.EnforceNamespaceCap(ctx, maxPerNamespace)
	dur := time.Since(start)

	if err != nil {
		span.RecordError(err)
		span.SetStatus(codes.Error, err.Error())
		a.metrics.NamespaceCapRuns.WithLabelValues("failure").Inc()
		a.logger.Error("Annotation namespace-cap cleanup failed", "error", err, "duration", dur)
		return
	}

	a.metrics.NamespaceCapRuns.WithLabelValues("success").Inc()
	a.metrics.NamespaceCapDuration.Observe(dur.Seconds())
	a.metrics.NamespaceCapRowsDeleted.Add(float64(deleted))
	a.logger.Info("Annotation namespace-cap cleanup completed", "rows_deleted", deleted, "duration", dur)
}
