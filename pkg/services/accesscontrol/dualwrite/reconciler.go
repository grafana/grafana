package dualwrite

import (
	"context"
	"fmt"
	"slices"
	"strconv"
	"strings"
	"time"

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
type TupleCollector func(ctx context.Context, tuples map[string][]*openfgav1.TupleKey) error

// ZanzanaReconciler is a component to reconcile RBAC permissions to zanzana.
// We should rewrite the migration after we have "migrated" all possible actions
// into our schema.
type ZanzanaReconciler struct {
	lock   *serverlock.ServerLockService
	log    log.Logger
	client zanzana.Client
	// collectors are one time best effort migrations that gives up on first conflict.
	// These are deprecated and everything should move be resourceReconcilers that are periodically synced
	// between grafana db and zanzana store.
	collectors []TupleCollector
	// reconcilers are migrations that tries to reconcile the state of grafana db to zanzana store.
	// These are run periodically to try to maintain a consistent state.
	reconcilers []resourceReconciler
}

func NewZanzanaReconciler(client zanzana.Client, store db.DB, lock *serverlock.ServerLockService, collectors ...TupleCollector) *ZanzanaReconciler {
	// Append shared collectors that is used by both enterprise and oss
	collectors = append(
		collectors,
		managedPermissionsCollector(store),
		folderTreeCollector(store),
		basicRolesCollector(store),
		customRolesCollector(store),
		basicRoleAssignemtCollector(store),
		userRoleAssignemtCollector(store),
		teamRoleAssignemtCollector(store),
		fixedRoleTuplesCollector(store),
	)

	return &ZanzanaReconciler{
		client:     client,
		lock:       lock,
		log:        log.New("zanzana.reconciler"),
		collectors: collectors,
		reconcilers: []resourceReconciler{
			newResourceReconciler(
				"team memberships",
				teamMembershipCollector(store),
				zanzanaCollector(client, []string{zanzana.RelationTeamMember, zanzana.RelationTeamAdmin}),
				client,
			),
			newResourceReconciler(
				"folder tree",
				folderTreeCollector2(store),
				zanzanaCollector(client, []string{zanzana.RelationParent}),
				client,
			),
			newResourceReconciler(
				"managed folder permissions",
				managedPermissionsCollector2(store, zanzana.KindFolders),
				zanzanaCollector(client, zanzana.Folder2Relations),
				client,
			),
			newResourceReconciler(
				"managed dashboard permissions",
				managedPermissionsCollector2(store, zanzana.KindDashboards),
				zanzanaCollector(client, zanzana.ResourceRelations),
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

	tuplesMap := make(map[string][]*openfgav1.TupleKey)

	for _, c := range r.collectors {
		if err := c(ctx, tuplesMap); err != nil {
			return fmt.Errorf("failed to collect permissions: %w", err)
		}
	}

	for key, tuples := range tuplesMap {
		if err := batch(tuples, 100, func(items []*openfgav1.TupleKey) error {
			return r.client.Write(ctx, &openfgav1.WriteRequest{
				Writes: &openfgav1.WriteRequestWrites{
					TupleKeys: items,
				},
			})
		}); err != nil {
			if strings.Contains(err.Error(), "cannot write a tuple which already exists") {
				r.log.Debug("Skipping already synced permissions", "sync_key", key)
				continue
			}
			return err
		}
	}

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

// managedPermissionsCollector collects managed permissions into provided tuple map.
// It will only store actions that are supported by our schema. Managed permissions can
// be directly mapped to user/team/role without having to write an intermediate role.
func managedPermissionsCollector(store db.DB) TupleCollector {
	return func(ctx context.Context, tuples map[string][]*openfgav1.TupleKey) error {
		const collectorID = "managed"
		query := `
			SELECT u.uid as user_uid, t.uid as team_uid, p.action, p.kind, p.identifier, r.org_id
			FROM permission p
			INNER JOIN role r ON p.role_id = r.id
			LEFT JOIN user_role ur ON r.id = ur.role_id
			LEFT JOIN ` + store.GetDialect().Quote("user") + ` u ON u.id = ur.user_id
			LEFT JOIN team_role tr ON r.id = tr.role_id
			LEFT JOIN team t ON tr.team_id = t.id
			LEFT JOIN builtin_role br ON r.id  = br.role_id
			WHERE r.name LIKE 'managed:%'
		`
		type Permission struct {
			RoleName   string `xorm:"role_name"`
			OrgID      int64  `xorm:"org_id"`
			Action     string `xorm:"action"`
			Kind       string
			Identifier string
			UserUID    string `xorm:"user_uid"`
			TeamUID    string `xorm:"team_uid"`
		}

		var permissions []Permission
		err := store.WithDbSession(ctx, func(sess *db.Session) error {
			return sess.SQL(query).Find(&permissions)
		})

		if err != nil {
			return err
		}

		for _, p := range permissions {
			var subject string
			if len(p.UserUID) > 0 {
				subject = zanzana.NewTupleEntry(zanzana.TypeUser, p.UserUID, "")
			} else if len(p.TeamUID) > 0 {
				subject = zanzana.NewTupleEntry(zanzana.TypeTeam, p.TeamUID, "member")
			} else {
				// FIXME(kalleep): Unsuported role binding (org role). We need to have basic roles in place
				continue
			}

			tuple, ok := zanzana.TranslateToTuple(subject, p.Action, p.Kind, p.Identifier, p.OrgID)
			if !ok {
				continue
			}

			// our "sync key" is a combination of collectorID and action so we can run this
			// sync new data when more actions are supported
			key := fmt.Sprintf("%s-%s", collectorID, p.Action)
			tuples[key] = append(tuples[key], tuple)
		}

		return nil
	}
}

// folderTreeCollector collects folder tree structure and writes it as relation tuples
func folderTreeCollector(store db.DB) TupleCollector {
	return func(ctx context.Context, tuples map[string][]*openfgav1.TupleKey) error {
		ctx, span := tracer.Start(ctx, "accesscontrol.migrator.folderTreeCollector")
		defer span.End()

		const collectorID = "folder"
		const query = `
			SELECT uid, parent_uid, org_id FROM folder
		`
		type folder struct {
			OrgID     int64  `xorm:"org_id"`
			FolderUID string `xorm:"uid"`
			ParentUID string `xorm:"parent_uid"`
		}

		var folders []folder
		err := store.WithDbSession(ctx, func(sess *db.Session) error {
			return sess.SQL(query).Find(&folders)
		})

		if err != nil {
			return err
		}

		for _, f := range folders {
			var tuple *openfgav1.TupleKey
			if f.ParentUID != "" {
				tuple = &openfgav1.TupleKey{
					Object:   zanzana.NewScopedTupleEntry(zanzana.TypeFolder, f.FolderUID, "", strconv.FormatInt(f.OrgID, 10)),
					Relation: zanzana.RelationParent,
					User:     zanzana.NewScopedTupleEntry(zanzana.TypeFolder, f.ParentUID, "", strconv.FormatInt(f.OrgID, 10)),
				}
			} else {
				// Map root folders to org
				tuple = &openfgav1.TupleKey{
					Object:   zanzana.NewScopedTupleEntry(zanzana.TypeFolder, f.FolderUID, "", strconv.FormatInt(f.OrgID, 10)),
					Relation: zanzana.RelationOrg,
					User:     zanzana.NewTupleEntry(zanzana.TypeOrg, strconv.FormatInt(f.OrgID, 10), ""),
				}
			}
			tuples[collectorID] = append(tuples[collectorID], tuple)
		}

		return nil
	}
}

// basicRolesCollector migrates basic roles to OpenFGA tuples
func basicRolesCollector(store db.DB) TupleCollector {
	return func(ctx context.Context, tuples map[string][]*openfgav1.TupleKey) error {
		const collectorID = "basic_role"
		const query = `
			SELECT r.name, r.uid as role_uid, p.action, p.kind, p.identifier, r.org_id
			FROM permission p
			INNER JOIN role r ON p.role_id = r.id
			LEFT JOIN builtin_role br ON r.id  = br.role_id
			WHERE r.name LIKE 'basic:%'
		`
		type Permission struct {
			RoleName   string `xorm:"role_name"`
			OrgID      int64  `xorm:"org_id"`
			Action     string `xorm:"action"`
			Kind       string
			Identifier string
			RoleUID    string `xorm:"role_uid"`
		}

		var permissions []Permission
		err := store.WithDbSession(ctx, func(sess *db.Session) error {
			return sess.SQL(query).Find(&permissions)
		})
		if err != nil {
			return err
		}

		for _, p := range permissions {
			type Org struct {
				Id   int64
				Name string
			}
			var orgs []Org
			orgsQuery := "SELECT id, name FROM org"
			err := store.WithDbSession(ctx, func(sess *db.Session) error {
				return sess.SQL(orgsQuery).Find(&orgs)
			})
			if err != nil {
				return err
			}

			// Populate basic roles permissions for every org
			for _, org := range orgs {
				var subject string
				if p.RoleUID != "" {
					subject = zanzana.NewScopedTupleEntry(zanzana.TypeRole, p.RoleUID, "assignee", strconv.FormatInt(org.Id, 10))
				} else {
					continue
				}

				var tuple *openfgav1.TupleKey
				ok := false
				if p.Identifier == "" || p.Identifier == "*" {
					tuple, ok = zanzana.TranslateToOrgTuple(subject, p.Action, org.Id)
				} else {
					tuple, ok = zanzana.TranslateToTuple(subject, p.Action, p.Kind, p.Identifier, org.Id)
				}
				if !ok {
					continue
				}

				key := fmt.Sprintf("%s-%s", collectorID, p.Action)
				if !slices.ContainsFunc(tuples[key], func(e *openfgav1.TupleKey) bool {
					// skip duplicated tuples
					return e.Object == tuple.Object && e.Relation == tuple.Relation && e.User == tuple.User
				}) {
					tuples[key] = append(tuples[key], tuple)
				}
			}
		}

		return nil
	}
}

// customRolesCollector migrates custom roles to OpenFGA tuples
func customRolesCollector(store db.DB) TupleCollector {
	return func(ctx context.Context, tuples map[string][]*openfgav1.TupleKey) error {
		const collectorID = "custom_role"
		const query = `
			SELECT r.name, r.uid as role_uid, p.action, p.kind, p.identifier, r.org_id
			FROM permission p
			INNER JOIN role r ON p.role_id = r.id
			LEFT JOIN builtin_role br ON r.id  = br.role_id
			WHERE r.name NOT LIKE 'basic:%'
			AND r.name NOT LIKE 'fixed:%'
			AND r.name NOT LIKE 'managed:%'
		`
		type Permission struct {
			RoleName   string `xorm:"role_name"`
			OrgID      int64  `xorm:"org_id"`
			Action     string `xorm:"action"`
			Kind       string
			Identifier string
			RoleUID    string `xorm:"role_uid"`
		}

		var permissions []Permission
		err := store.WithDbSession(ctx, func(sess *db.Session) error {
			return sess.SQL(query).Find(&permissions)
		})
		if err != nil {
			return err
		}

		for _, p := range permissions {
			var subject string
			if p.RoleUID != "" {
				subject = zanzana.NewScopedTupleEntry(zanzana.TypeRole, p.RoleUID, "assignee", strconv.FormatInt(p.OrgID, 10))
			} else {
				continue
			}

			var tuple *openfgav1.TupleKey
			ok := false
			if p.Identifier == "" || p.Identifier == "*" {
				tuple, ok = zanzana.TranslateToOrgTuple(subject, p.Action, p.OrgID)
			} else {
				tuple, ok = zanzana.TranslateToTuple(subject, p.Action, p.Kind, p.Identifier, p.OrgID)
			}
			if !ok {
				continue
			}

			key := fmt.Sprintf("%s-%s", collectorID, p.Action)
			if !slices.ContainsFunc(tuples[key], func(e *openfgav1.TupleKey) bool {
				// skip duplicated tuples
				return e.Object == tuple.Object && e.Relation == tuple.Relation && e.User == tuple.User
			}) {
				tuples[key] = append(tuples[key], tuple)
			}
		}

		return nil
	}
}

func basicRoleAssignemtCollector(store db.DB) TupleCollector {
	return func(ctx context.Context, tuples map[string][]*openfgav1.TupleKey) error {
		const collectorID = "basic_role_assignment"
		query := `
			SELECT ou.org_id, u.uid as user_uid, ou.role as org_role, u.is_admin
			FROM org_user ou
			LEFT JOIN ` + store.GetDialect().Quote("user") + ` u ON u.id = ou.user_id
		`
		type Assignment struct {
			OrgID   int64  `xorm:"org_id"`
			UserUID string `xorm:"user_uid"`
			OrgRole string `xorm:"org_role"`
			IsAdmin bool   `xorm:"is_admin"`
		}

		var assignments []Assignment
		err := store.WithDbSession(ctx, func(sess *db.Session) error {
			return sess.SQL(query).Find(&assignments)
		})

		if err != nil {
			return err
		}

		for _, a := range assignments {
			var subject string
			if a.UserUID != "" && a.OrgRole != "" {
				subject = zanzana.NewTupleEntry(zanzana.TypeUser, a.UserUID, "")
			} else {
				continue
			}

			roleUID := zanzana.TranslateBasicRole(a.OrgRole)

			tuple := &openfgav1.TupleKey{
				User:     subject,
				Relation: zanzana.RelationAssignee,
				Object:   zanzana.NewScopedTupleEntry(zanzana.TypeRole, roleUID, "", strconv.FormatInt(a.OrgID, 10)),
			}

			key := fmt.Sprintf("%s-%s", collectorID, zanzana.RelationAssignee)
			tuples[key] = append(tuples[key], tuple)
		}

		return nil
	}
}

func userRoleAssignemtCollector(store db.DB) TupleCollector {
	return func(ctx context.Context, tuples map[string][]*openfgav1.TupleKey) error {
		const collectorID = "user_role_assignment"
		query := `
			SELECT ur.org_id, u.uid AS user_uid, r.uid AS role_uid, r.name AS role_name
			FROM user_role ur
			LEFT JOIN role r ON r.id = ur.role_id
			LEFT JOIN ` + store.GetDialect().Quote("user") + ` u ON u.id = ur.user_id
			WHERE r.name NOT LIKE 'managed:%'
		`

		type Assignment struct {
			OrgID    int64  `xorm:"org_id"`
			UserUID  string `xorm:"user_uid"`
			RoleUID  string `xorm:"role_uid"`
			RoleName string `xorm:"role_name"`
		}

		var assignments []Assignment
		err := store.WithDbSession(ctx, func(sess *db.Session) error {
			return sess.SQL(query).Find(&assignments)
		})
		if err != nil {
			return err
		}

		for _, a := range assignments {
			if a.UserUID == "" || a.RoleUID == "" {
				continue
			}

			subject := zanzana.NewTupleEntry(zanzana.TypeUser, a.UserUID, "")
			if strings.HasPrefix(a.RoleUID, "fixed_") {
				// Fixed roles are defined in shema, so they are relations itself. Assignment should look like:
				// user:<uid> fixed_folders_reader org:1
				relation := zanzana.TranslateFixedRole(a.RoleName)
				tuple := &openfgav1.TupleKey{
					User:     subject,
					Relation: relation,
					Object:   zanzana.NewTupleEntry(zanzana.TypeOrg, strconv.FormatInt(a.OrgID, 10), ""),
				}
				key := fmt.Sprintf("%s-%s", collectorID, relation)
				tuples[key] = append(tuples[key], tuple)
			} else {
				tuple := &openfgav1.TupleKey{
					User:     subject,
					Relation: zanzana.RelationAssignee,
					Object:   zanzana.NewScopedTupleEntry(zanzana.TypeRole, a.RoleUID, "", strconv.FormatInt(a.OrgID, 10)),
				}

				key := fmt.Sprintf("%s-%s", collectorID, zanzana.RelationAssignee)
				tuples[key] = append(tuples[key], tuple)
			}
		}

		return nil
	}
}

func teamRoleAssignemtCollector(store db.DB) TupleCollector {
	return func(ctx context.Context, tuples map[string][]*openfgav1.TupleKey) error {
		const collectorID = "team_role_assignment"
		const query = `
			SELECT tr.org_id, t.uid AS team_uid, r.uid AS role_uid, r.name AS role_name
			FROM team_role tr
			LEFT JOIN role r ON r.id = tr.role_id
			LEFT JOIN team t ON t.id = tr.team_id
			WHERE r.name NOT LIKE 'managed:%'
		`

		type Assignment struct {
			OrgID    int64  `xorm:"org_id"`
			TeamUID  string `xorm:"team_uid"`
			RoleUID  string `xorm:"role_uid"`
			RoleName string `xorm:"role_name"`
		}

		var assignments []Assignment
		err := store.WithDbSession(ctx, func(sess *db.Session) error {
			return sess.SQL(query).Find(&assignments)
		})
		if err != nil {
			return err
		}

		for _, a := range assignments {
			if a.TeamUID == "" || a.RoleUID == "" {
				continue
			}

			subject := zanzana.NewTupleEntry(zanzana.TypeTeam, a.TeamUID, "member")
			if strings.HasPrefix(a.RoleUID, "fixed_") {
				// Fixed roles are defined in shema, so they are relations itself. Assignment should look like:
				// team:<uid> fixed_folders_reader org:1
				relation := zanzana.TranslateFixedRole(a.RoleName)
				tuple := &openfgav1.TupleKey{
					User:     subject,
					Relation: relation,
					Object:   zanzana.NewTupleEntry(zanzana.TypeOrg, strconv.FormatInt(a.OrgID, 10), ""),
				}
				key := fmt.Sprintf("%s-%s", collectorID, relation)
				tuples[key] = append(tuples[key], tuple)
			} else {
				tuple := &openfgav1.TupleKey{
					User:     subject,
					Relation: zanzana.RelationAssignee,
					Object:   zanzana.NewScopedTupleEntry(zanzana.TypeRole, a.RoleUID, "", strconv.FormatInt(a.OrgID, 10)),
				}

				key := fmt.Sprintf("%s-%s", collectorID, zanzana.RelationAssignee)
				tuples[key] = append(tuples[key], tuple)
			}
		}

		return nil
	}
}

// fixedRoleTuplesCollector migrates fixed roles permissions that cannot be described in schema.
// Those are permissions like general folder read and create that have specific resource id.
func fixedRoleTuplesCollector(store db.DB) TupleCollector {
	return func(ctx context.Context, tuples map[string][]*openfgav1.TupleKey) error {
		const collectorID = "fixed_role"
		type Org struct {
			Id   int64
			Name string
		}
		var orgs []Org
		orgsQuery := "SELECT id, name FROM org"
		err := store.WithDbSession(ctx, func(sess *db.Session) error {
			return sess.SQL(orgsQuery).Find(&orgs)
		})
		if err != nil {
			return err
		}

		type Assignment struct {
			RoleName   string
			Action     string
			Kind       string
			Identifier string
		}

		assignments := []Assignment{
			{RoleName: "fixed:dashboards:creator", Action: "folders:read", Kind: "folders", Identifier: "general"},
			{RoleName: "fixed:dashboards:creator", Action: "dashboards:create", Kind: "folders", Identifier: "general"},
			{RoleName: "fixed:folders:creator", Action: "folders:create", Kind: "folders", Identifier: "general"},
			{RoleName: "fixed:folders.general:reader", Action: "folders:read", Kind: "folders", Identifier: "general"},
		}

		for _, a := range assignments {
			fixedRole := zanzana.TranslateFixedRole(a.RoleName)
			subject := zanzana.NewTupleEntry(zanzana.TypeRole, fixedRole, "assignee")

			for _, org := range orgs {
				tuple, ok := zanzana.TranslateToTuple(subject, a.Action, a.Kind, a.Identifier, org.Id)
				if !ok {
					continue
				}

				key := fmt.Sprintf("%s-%s", collectorID, a.Action)
				tuples[key] = append(tuples[key], tuple)
			}
		}

		return nil
	}
}
