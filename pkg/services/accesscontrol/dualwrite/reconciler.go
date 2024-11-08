package dualwrite

import (
	"context"
	"time"

	"go.opentelemetry.io/otel"

	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/serverlock"
	"github.com/grafana/grafana/pkg/services/authz/zanzana"
)

var tracer = otel.Tracer("github.com/grafana/grafana/pkg/accesscontrol/reconciler")

// ZanzanaReconciler is a component to reconcile RBAC permissions to zanzana.
// We should rewrite the migration after we have "migrated" all possible actions
// into our schema.
type ZanzanaReconciler struct {
	lock   *serverlock.ServerLockService
	log    log.Logger
	client zanzana.Client
	// reconcilers are migrations that tries to reconcile the state of grafana db to zanzana store.
	// These are run periodically to try to maintain a consistent state.
	reconcilers []resourceReconciler
}

func NewZanzanaReconciler(client zanzana.Client, store db.DB, lock *serverlock.ServerLockService) *ZanzanaReconciler {
	return &ZanzanaReconciler{
		client: client,
		lock:   lock,
		log:    log.New("zanzana.reconciler"),
		reconcilers: []resourceReconciler{
			newResourceReconciler(
				"team memberships",
				teamMembershipCollector(store),
				zanzanaCollector([]string{zanzana.RelationTeamMember, zanzana.RelationTeamAdmin}),
				client,
			),
			newResourceReconciler(
				"folder tree",
				folderTreeCollector(store),
				zanzanaCollector([]string{zanzana.RelationParent}),
				client,
			),
			newResourceReconciler(
				"managed folder permissions",
				managedPermissionsCollector(store, zanzana.KindFolders),
				zanzanaCollector(zanzana.FolderRelations),
				client,
			),
			newResourceReconciler(
				"managed dashboard permissions",
				managedPermissionsCollector(store, zanzana.KindDashboards),
				zanzanaCollector(zanzana.ResourceRelations),
				client,
			),
		},
	}
}

// Sync runs all collectors and tries to write all collected tuples.
// It will skip over any "sync group" that has already been written.
func (r *ZanzanaReconciler) Sync(ctx context.Context) error {
	r.log.Info("Starting zanzana permissions sync")
	ctx, span := tracer.Start(ctx, "accesscontrol.migrator.Sync")
	defer span.End()

	r.reconcile(ctx)

	return nil
}

// Reconcile schedules as job that will run and reconcile resources between
// legacy access control and zanzana.
func (r *ZanzanaReconciler) Reconcile(ctx context.Context) error {
	// FIXME: try to reconcile at start whenever we have moved all syncs to reconcilers
	// r.reconcile(ctx)

	// FIXME:
	// 1. We should be a bit graceful about reconciliations so we are not hammering dbs
	// 2. We should be able to configure reconciliation interval
	ticker := time.NewTicker(1 * time.Hour)
	for {
		select {
		case <-ticker.C:
			r.reconcile(ctx)
		case <-ctx.Done():
			return ctx.Err()
		}
	}
}

func (r *ZanzanaReconciler) reconcile(ctx context.Context) {
	run := func(ctx context.Context) {
		now := time.Now()
		for _, reconciler := range r.reconcilers {
			if err := reconciler.reconcile(ctx); err != nil {
				r.log.Warn("Failed to perform reconciliation for resource", "err", err)
			}
		}
		r.log.Debug("Finished reconciliation", "elapsed", time.Since(now))
	}

	if r.lock == nil {
		run(ctx)
		return
	}

	// We ignore the error for now
	_ = r.lock.LockExecuteAndRelease(ctx, "zanzana-reconciliation", 10*time.Hour, func(ctx context.Context) {
		run(ctx)
	})
}
