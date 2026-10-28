package folderimpl

import (
	"context"

	"golang.org/x/sync/errgroup"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

// deleteDashboards deletes each dashboard with its own request. When parallel deletes are
// enabled, up to the configured number of requests are in flight at once.
func (s *Service) deleteDashboards(ctx context.Context, orgID int64, uids []string) error {
	if s.cfg == nil || !s.cfg.FolderParallelDashboardDeleteEnabled {
		for _, uid := range uids {
			if err := s.dashboardK8sClient.Delete(ctx, uid, orgID, metav1.DeleteOptions{}); err != nil {
				return err
			}
		}
		return nil
	}
	// stop only prevents new deletes from starting. In-flight deletes keep the request context, so a
	// failing sibling cannot cut one short after storage removed the dashboard but before its
	// post-delete cleanup, such as permission removal, has run.
	stopCtx, stop := context.WithCancel(ctx)
	defer stop()

	jobs := make(chan string)
	var workers errgroup.Group
	// Settings reject non-positive values, but a hand-built Cfg can still carry one. Without a
	// worker, the unbuffered send below would block forever.
	for range min(max(s.cfg.FolderParallelDashboardDeleteConcurrency, 1), len(uids)) {
		workers.Go(func() error {
			for uid := range jobs {
				// A ready send can race the stop signal; do not start another delete afterwards.
				if stopCtx.Err() != nil {
					return nil
				}
				if err := s.dashboardK8sClient.Delete(ctx, uid, orgID, metav1.DeleteOptions{}); err != nil {
					stop()
					return err
				}
			}
			return nil
		})
	}

scheduling:
	for _, uid := range uids {
		select {
		case <-stopCtx.Done():
			break scheduling
		case jobs <- uid:
		}
	}
	close(jobs)
	// Like the sequential loop, stop at the first failure. Waiting for in-flight deletes keeps
	// public dashboard and folder cleanup from starting while children are still being deleted.
	if err := workers.Wait(); err != nil {
		return err
	}
	return ctx.Err()
}
