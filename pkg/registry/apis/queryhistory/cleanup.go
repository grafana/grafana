package queryhistory

import (
	"context"
	"log/slog"
	"time"
)

const defaultCleanupInterval = 1 * time.Hour

type CleanupJob struct {
	logger   *slog.Logger
	interval time.Duration
	// TODO: add client to list and delete QueryHistory resources
}

func isExpired(expiresAtUnix int64) bool {
	if expiresAtUnix == 0 {
		return false
	}
	return time.Now().Unix() > expiresAtUnix
}

// Run is called periodically by the PostStartHook goroutine.
func (c *CleanupJob) Run(ctx context.Context) {
	interval := c.interval
	if interval == 0 {
		interval = defaultCleanupInterval
	}
	ticker := time.NewTicker(interval)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			c.cleanup(ctx)
		}
	}
}

func (c *CleanupJob) cleanup(ctx context.Context) {
	c.logger.Info("running query history TTL cleanup")

	// 1. List all QueryHistory resources that have the grafana.app/expires-at label
	//    Use label selector: grafana.app/expires-at exists
	//
	// 2. For each resource, parse the label value as unix timestamp
	//    If isExpired(timestamp): delete the resource
	//
	// 3. Log count of deleted resources

	c.logger.Info("query history TTL cleanup complete")
}
