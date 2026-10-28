package service

import (
	"context"
	"sync"

	"github.com/grafana/grafana/pkg/services/dashboards"
)

func (dr *DashboardServiceImpl) deleteInFoldersParallel(ctx context.Context, orgID int64, folderUIDs []string, dashes []*dashboards.Dashboard) error {
	jobs := make(chan *dashboards.Dashboard)
	var workers sync.WaitGroup
	// Settings reject non-positive values, but a hand-built Cfg can still carry one. Without a
	// worker, the unbuffered send below would block forever.
	for range min(max(dr.cfg.FolderParallelDashboardDeleteConcurrency, 1), len(dashes)) {
		workers.Go(func() {
			for dash := range jobs {
				// A ready send can race cancellation; do not start another delete afterwards.
				if ctx.Err() != nil {
					return
				}
				if err := dr.deleteDashboard(ctx, dash.ID, dash.UID, orgID, false); err != nil {
					// Keep the sequential path's best-effort behavior: one failure must not skip the rest.
					dr.log.Error("failed to delete dashboard inside folder", "dashboardUID", dash.UID, "folderUIDs", folderUIDs, "error", err)
				}
			}
		})
	}

scheduling:
	for _, dash := range dashes {
		select {
		case <-ctx.Done():
			break scheduling
		case jobs <- dash:
		}
	}
	close(jobs)
	workers.Wait()
	return ctx.Err()
}
