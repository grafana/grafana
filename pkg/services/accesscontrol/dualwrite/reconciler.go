package dualwrite

import (
	"context"
	"fmt"
	"strconv"
	"time"

	"github.com/grafana/authlib/claims"
	"go.opentelemetry.io/otel"

	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/serverlock"
	"github.com/grafana/grafana/pkg/services/authz/zanzana"
	"github.com/grafana/grafana/pkg/services/folder"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/setting"
)

var tracer = otel.Tracer("github.com/grafana/grafana/pkg/accesscontrol/migrator")

// ZanzanaReconciler is a component to reconcile RBAC permissions to zanzana.
// We should rewrite the migration after we have "migrated" all possible actions
// into our schema.
type ZanzanaReconciler struct {
	cfg *setting.Cfg
	log log.Logger

	store  db.DB
	client zanzana.Client
	lock   *serverlock.ServerLockService
	// reconcilers are migrations that tries to reconcile the state of grafana db to zanzana store.
	// These are run periodically to try to maintain a consistent state.
	reconcilers []resourceReconciler
	// globalReconcilers are reconcilers that should only run for cluster namespace
	globalReconcilers []resourceReconciler
}

func NewZanzanaReconciler(cfg *setting.Cfg, client zanzana.Client, store db.DB, lock *serverlock.ServerLockService, folderService folder.Service) *ZanzanaReconciler {
	zanzanaReconciler := &ZanzanaReconciler{
		cfg:    cfg,
		log:    log.New("zanzana.reconciler"),
		client: client,
		lock:   lock,
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
				folderTreeCollector(folderService),
				zanzanaCollector([]string{zanzana.RelationParent}),
				client,
			),
			newResourceReconciler(
				"managed folder permissions",
				managedPermissionsCollector(store, zanzana.KindFolders),
				zanzanaCollector(zanzana.RelationsFolder),
				client,
			),
			newResourceReconciler(
				"managed dashboard permissions",
				managedPermissionsCollector(store, zanzana.KindDashboards),
				zanzanaCollector(zanzana.RelationsResouce),
				client,
			),
			newResourceReconciler(
				"role permissions",
				rolePermissionsCollector(store),
				zanzanaCollector(zanzana.RelationsFolder),
				client,
			),
			newResourceReconciler(
				"basic role bindings",
				basicRoleBindingsCollector(store),
				zanzanaCollector([]string{zanzana.RelationAssignee}),
				client,
			),
			newResourceReconciler(
				"team role bindings",
				teamRoleBindingsCollector(store),
				zanzanaCollector([]string{zanzana.RelationAssignee}),
				client,
			),
			newResourceReconciler(
				"user role bindings",
				userRoleBindingsCollector(store),
				zanzanaCollector([]string{zanzana.RelationAssignee}),
				client,
			),
		},
		globalReconcilers: []resourceReconciler{
			newResourceReconciler(
				"fixed role pemissions",
				fixedRolePermissionsCollector(store),
				zanzanaCollector(zanzana.RelationsFolder),
				client,
			),
		},
	}

	if cfg.Anonymous.Enabled {
		zanzanaReconciler.reconcilers = append(zanzanaReconciler.reconcilers,
			newResourceReconciler(
				"anonymous role binding",
				anonymousRoleBindingsCollector(cfg, store),
				zanzanaCollector([]string{zanzana.RelationAssignee}),
				client,
			),
		)
	}

	return zanzanaReconciler
}

// Reconcile schedules as job that will run and reconcile resources between
// legacy access control and zanzana.
func (r *ZanzanaReconciler) Reconcile(ctx context.Context) error {
	r.reconcile(ctx)

	// FIXME:
	// We should be a bit graceful about reconciliations so we are not hammering dbs
	ticker := time.NewTicker(r.cfg.RBAC.ZanzanaReconciliationInterval)
	for {
		select {
		case <-ticker.C:
			r.reconcile(ctx)
		case <-ctx.Done():
			return ctx.Err()
		}
	}
}

// ReconcileSync runs reconciliation and returns. Useful for tests to perform
// reconciliation in a synchronous way.
func (r *ZanzanaReconciler) ReconcileSync(ctx context.Context) error {
	r.reconcile(ctx)
	return nil
}

func (r *ZanzanaReconciler) reconcile(ctx context.Context) {
	runGlobal := func(ctx context.Context) {
		for _, reconciler := range r.globalReconcilers {
			r.log.Debug("Performing zanzana reconciliation", "reconciler", reconciler.name)
			if err := reconciler.reconcile(ctx, zanzana.ClusterNamespace); err != nil {
				r.log.Warn("Failed to perform reconciliation for resource", "err", err)
			}
		}
	}

	run := func(ctx context.Context, namespace string) {
		now := time.Now()
		r.log.Debug("Started reconciliation")

		for _, reconciler := range r.reconcilers {
			r.log.Debug("Performing zanzana reconciliation", "reconciler", reconciler.name)
			if err := reconciler.reconcile(ctx, namespace); err != nil {
				r.log.Warn("Failed to perform reconciliation for resource", "err", err)
			}
		}
		r.log.Debug("Finished reconciliation", "elapsed", time.Since(now))
	}

	var namespaces []string
	if r.cfg.StackID != "" {
		id, err := strconv.ParseInt(r.cfg.StackID, 10, 64)
		if err != nil {
			r.log.Error("cannot perform reconciliation, malformed stack id", "id", r.cfg.StackID, "err", err)
			return
		}

		namespaces = []string{claims.CloudNamespaceFormatter(id)}
	} else {
		ids, err := r.getOrgs(ctx)
		if err != nil {
			r.log.Error("cannot perform reconciliation, failed to fetch orgs", "err", err)
			return
		}

		for _, id := range ids {
			namespaces = append(namespaces, claims.OrgNamespaceFormatter(id))
		}
	}

	if r.lock == nil {
		runGlobal(ctx)
		for _, ns := range namespaces {
			run(ctx, ns)
		}
		return
	}

	// We ignore the error for now
	err := r.lock.LockExecuteAndRelease(ctx, "zanzana-reconciliation", 10*time.Hour, func(ctx context.Context) {
		runGlobal(ctx)
		for _, ns := range namespaces {
			run(ctx, ns)
		}
	})
	if err != nil {
		r.log.Error("Error performing zanzana reconciliation", "error", err)
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

func getOrgByName(ctx context.Context, store db.DB, name string) (*org.Org, error) {
	var orga org.Org
	err := store.WithDbSession(ctx, func(dbSession *db.Session) error {
		exists, err := dbSession.Where("name=?", name).Get(&orga)
		if err != nil {
			return err
		}
		if !exists {
			return fmt.Errorf("org does not exist: %s", name)
		}
		return nil
	})

	if err != nil {
		return nil, err
	}
	return &orga, nil
}
