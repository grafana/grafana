package annotation

import (
	"context"
	"time"
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
	cleanupCtx, cancel := context.WithTimeout(ctx, 5*time.Minute)
	defer cancel()

	start := time.Now()
	deleted, err := lifecycleMgr.Cleanup(cleanupCtx)
	if err != nil {
		a.logger.Error("Annotation cleanup failed", "error", err, "duration", time.Since(start))
	} else if deleted > 0 {
		a.logger.Info("Annotation cleanup completed", "rows_deleted", deleted, "duration", time.Since(start))
	}
}
