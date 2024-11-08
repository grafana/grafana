package dualwrite

import (
	"context"
	"time"

	"github.com/grafana/authlib/claims"
	openfgav1 "github.com/openfga/api/proto/openfga/v1"
	"go.opentelemetry.io/otel"

	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/serverlock"
	"github.com/grafana/grafana/pkg/services/authz/zanzana"
)

var tracer = otel.Tracer("github.com/grafana/grafana/pkg/accesscontrol/migrator")

// A TupleCollector is responsible to build and store [openfgav1.TupleKey] into provided tuple map.
// They key used should be a unique group key for the collector so we can skip over an already synced group.
type TupleCollector func(ctx context.Context, namespace string, tuples map[string][]*openfgav1.TupleKey) error

// ZanzanaReconciler is a component to reconcile RBAC permissions to zanzana.
// We should rewrite the migration after we have "migrated" all possible actions
// into our schema.
type ZanzanaReconciler struct {
	lock   *serverlock.ServerLockService
	log    log.Logger
	store  db.DB
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
		store:  store,
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
	run := func(ctx context.Context, namespace string) {
		now := time.Now()
		for _, reconciler := range r.reconcilers {
			if err := reconciler.reconcile(ctx, namespace); err != nil {
				r.log.Warn("Failed to perform reconciliation for resource", "err", err)
			}
		}
		r.log.Debug("Finished reconciliation", "elapsed", time.Since(now))
	}

	orgIds, err := r.getOrgs(ctx)
	if err != nil {
		return
	}

	for _, orgId := range orgIds {
		ns := claims.OrgNamespaceFormatter(orgId)

		if r.lock == nil {
			run(ctx, ns)
			return
		}

		// We ignore the error for now
		_ = r.lock.LockExecuteAndRelease(ctx, "zanzana-reconciliation", 10*time.Hour, func(ctx context.Context) {
			run(ctx, ns)
		})
	}
}

func (r *ZanzanaReconciler) getOrgs(ctx context.Context) ([]int64, error) {
	orgs := make([]int64, 0)
	err := r.store.WithDbSession(ctx, func(sess *db.Session) error {
		q := "SELECT id FROM org"
		if err := sess.SQL(q).Find(&orgs); err != nil {
			return err
		}
		return nil
	})
	if err != nil {
		return nil, err
	}
	return orgs, nil
}
