package folderimpl

import (
	"context"

	"golang.org/x/sync/errgroup"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	"github.com/grafana/grafana/pkg/services/folder"
)

// deleteDashboards deletes each dashboard with its own request. When the
// folders.parallelDashboardDeleteConcurrency flag is above 1, up to that many requests are in flight at once.
func (s *Service) deleteDashboards(ctx context.Context, orgID int64, uids []string) error {
	concurrency := folder.ParallelDashboardDeleteConcurrency(ctx)
	if concurrency <= 1 {
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
	for range min(concurrency, len(uids)) {
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
