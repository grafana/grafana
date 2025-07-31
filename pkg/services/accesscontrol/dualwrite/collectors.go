package dualwrite

import (
	"context"

	openfgav1 "github.com/openfga/api/proto/openfga/v1"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/infra/db"
	authzextv1 "github.com/grafana/grafana/pkg/services/authz/proto/v1"
	"github.com/grafana/grafana/pkg/services/authz/zanzana"
	"github.com/grafana/grafana/pkg/services/folder"
	"github.com/grafana/grafana/pkg/setting"
)

func teamMembershipCollector(store db.DB) legacyTupleCollector {
	return func(ctx context.Context, orgID int64) (map[string]map[string]*openfgav1.TupleKey, error) {
		query := `
			SELECT t.uid as team_uid, u.uid as user_uid, tm.permission
			FROM team_member tm
			INNER JOIN team t ON tm.team_id = t.id
			INNER JOIN ` + store.GetDialect().Quote("user") + ` u ON tm.user_id = u.id
			WHERE t.org_id = ?
		`

		type membership struct {
			TeamUID    string `xorm:"team_uid"`
			UserUID    string `xorm:"user_uid"`
			Permission int
		}

		var memberships []membership
		err := store.WithDbSession(ctx, func(sess *db.Session) error {
			return sess.SQL(query, orgID).Find(&memberships)
		})
		if err != nil {
			return nil, err
		}

		tuples := make(map[string]map[string]*openfgav1.TupleKey)

		for _, m := range memberships {
			tuple := &openfgav1.TupleKey{
				User:   zanzana.NewTupleEntry(zanzana.TypeUser, m.UserUID, ""),
				Object: zanzana.NewTupleEntry(zanzana.TypeTeam, m.TeamUID, ""),
			}

			// Admin permission is 4 and member 0
			if m.Permission == 4 {
				tuple.Relation = zanzana.RelationTeamAdmin
			} else {
				tuple.Relation = zanzana.RelationTeamMember
			}

			if tuples[tuple.Object] == nil {
				tuples[tuple.Object] = make(map[string]*openfgav1.TupleKey)
			}

			tuples[tuple.Object][tuple.String()] = tuple
		}

		return tuples, nil
	}
}

// folderTreeCollector collects folder tree structure and writes it as relation tuples
func folderTreeCollector(folderService folder.Service) legacyTupleCollector {
	return func(ctx context.Context, orgID int64) (map[string]map[string]*openfgav1.TupleKey, error) {
		ctx, span := tracer.Start(ctx, "accesscontrol.migrator.folderTreeCollector")
		defer span.End()

		ctx, ident := identity.WithServiceIdentity(ctx, orgID)

		tuples := make(map[string]map[string]*openfgav1.TupleKey)

		const pageSize = 1000
		var page int64 = 1

		for {
			q := folder.GetFoldersQuery{
				OrgID:        orgID,
				SignedInUser: ident,
				Limit:        pageSize,
				Page:         page,
			}

			folders, err := folderService.GetFolders(ctx, q)
			if err != nil {
				return nil, err
			}

			for _, f := range folders {
				var tuple *openfgav1.TupleKey
				if f.ParentUID == "" {
					continue
				}

				tuple = &openfgav1.TupleKey{
					Object:   zanzana.NewTupleEntry(zanzana.TypeFolder, f.UID, ""),
					Relation: zanzana.RelationParent,
					User:     zanzana.NewTupleEntry(zanzana.TypeFolder, f.ParentUID, ""),
				}

				if tuples[tuple.Object] == nil {
					tuples[tuple.Object] = make(map[string]*openfgav1.TupleKey)
				}

				tuples[tuple.Object][tuple.String()] = tuple
			}

			if int64(len(folders)) < pageSize {
				break
			}

			page++
		}

		return tuples, nil
	}
}

// managedPermissionsCollector collects managed permissions.
// It will only store actions that are supported by our schema. Managed permissions can
// be directly mapped to user/team/role without having to write an intermediate role.
func managedPermissionsCollector(store db.DB, kind string) legacyTupleCollector {
	return func(ctx context.Context, orgID int64) (map[string]map[string]*openfgav1.TupleKey, error) {
		query := `
			SELECT u.uid as user_uid, u.is_service_account as is_service_account, t.uid as team_uid, p.action, p.kind, p.identifier, r.org_id, br.role as basic_role_name
			FROM permission p
			INNER JOIN role r ON p.role_id = r.id
			LEFT JOIN user_role ur ON r.id = ur.role_id
			LEFT JOIN ` + store.GetDialect().Quote("user") + ` u ON u.id = ur.user_id
			LEFT JOIN team_role tr ON r.id = tr.role_id
			LEFT JOIN team t ON tr.team_id = t.id
			LEFT JOIN builtin_role br ON r.id  = br.role_id
			WHERE r.name LIKE 'managed:%'
			AND r.org_id = ?
			AND p.kind = ?
		`
		type Permission struct {
			Action           string `xorm:"action"`
			Kind             string
			Identifier       string
			UserUID          string `xorm:"user_uid"`
			IsServiceAccount bool   `xorm:"is_service_account"`
			TeamUID          string `xorm:"team_uid"`
			BasicRoleName    string `xorm:"basic_role_name"`
		}

		var permissions []Permission
		err := store.WithDbSession(ctx, func(sess *db.Session) error {
			return sess.SQL(query, orgID, kind).Find(&permissions)
		})
		if err != nil {
			return nil, err
		}

		tuples := make(map[string]map[string]*openfgav1.TupleKey)

		for _, p := range permissions {
			var subject string
			if len(p.UserUID) > 0 && p.IsServiceAccount {
				subject = zanzana.NewTupleEntry(zanzana.TypeServiceAccount, p.UserUID, "")
			} else if len(p.UserUID) > 0 {
				subject = zanzana.NewTupleEntry(zanzana.TypeUser, p.UserUID, "")
			} else if len(p.TeamUID) > 0 {
				subject = zanzana.NewTupleEntry(zanzana.TypeTeam, p.TeamUID, zanzana.RelationTeamMember)
			} else if len(p.BasicRoleName) > 0 {
				subject = zanzana.NewTupleEntry(zanzana.TypeRole, zanzana.TranslateBasicRole(p.BasicRoleName), zanzana.RelationAssignee)
			} else {
				reconcilerLogger.Debug("unrecognized permission", "permission", p)
				continue
			}

			tuple, ok := zanzana.TranslateToResourceTuple(subject, p.Action, p.Kind, p.Identifier)
			if !ok {
				continue
			}

			if tuples[tuple.Object] == nil {
				tuples[tuple.Object] = make(map[string]*openfgav1.TupleKey)
			}

			// For resource actions on folders we need to merge the tuples into one with combined subresources.
			if zanzana.IsFolderResourceTuple(tuple) {
				key := tupleStringWithoutCondition(tuple)
				if t, ok := tuples[tuple.Object][key]; ok {
					zanzana.MergeFolderResourceTuples(t, tuple)
				} else {
					tuples[tuple.Object][key] = tuple
				}

				continue
			}

			tuples[tuple.Object][tuple.String()] = tuple
		}

		return tuples, nil
	}
}

func tupleStringWithoutCondition(tuple *openfgav1.TupleKey) string {
	c := tuple.Condition
	tuple.Condition = nil
	s := tuple.String()
	tuple.Condition = c
	return s
}

// basicRoleBindingsCollector collects role bindings for basic roles
func basicRoleBindingsCollector(store db.DB) legacyTupleCollector {
	return func(ctx context.Context, orgID int64) (map[string]map[string]*openfgav1.TupleKey, error) {
		query := `
			SELECT
				ou.org_id, u.uid as user_uid,
				u.is_service_account as is_service_account,
				ou.role as org_role
			FROM org_user ou
			LEFT JOIN ` + store.GetDialect().Quote("user") + ` u ON u.id = ou.user_id
			WHERE ou.org_id = ?
		`
		// FIXME: handle service admin role
		type Binding struct {
			UserUID          string `xorm:"user_uid"`
			IsServiceAccount bool   `xorm:"is_service_account"`
			OrgRole          string `xorm:"org_role"`
		}

		var bindings []Binding
		err := store.WithDbSession(ctx, func(sess *db.Session) error {
			return sess.SQL(query, orgID).Find(&bindings)
		})
		if err != nil {
			return nil, err
		}

		tuples := make(map[string]map[string]*openfgav1.TupleKey)

		for _, b := range bindings {
			userType := zanzana.TypeUser
			if b.IsServiceAccount {
				userType = zanzana.TypeServiceAccount
			}

			tuple := &openfgav1.TupleKey{
				User:     zanzana.NewTupleEntry(userType, b.UserUID, ""),
				Relation: zanzana.RelationAssignee,
				Object:   zanzana.NewTupleEntry(zanzana.TypeRole, zanzana.TranslateBasicRole(b.OrgRole), ""),
			}

			if tuples[tuple.Object] == nil {
				tuples[tuple.Object] = make(map[string]*openfgav1.TupleKey)
			}

			tuples[tuple.Object][tuple.String()] = tuple
		}

		return tuples, nil
	}
}

func roleBindingsCollector(store db.DB) legacyTupleCollector {
	return func(ctx context.Context, orgID int64) (map[string]map[string]*openfgav1.TupleKey, error) {
		userQuery := `
			SELECT u.uid AS user_uid, u.is_service_account as is_service_account, r.uid AS role_uid
			FROM user_role ur
			INNER JOIN ` + store.GetDialect().Quote("user") + ` u ON ur.user_id = u.id
			INNER JOIN role r ON ur.role_id = r.id
			WHERE (ur.org_id = 0 OR ur.org_id = ?)
			AND r.name NOT LIKE 'managed:%'
		`
		type Binding struct {
			UserUID          string `xorm:"user_uid"`
			IsServiceAccount bool   `xorm:"is_service_account"`
			TeamUID          string `xorm:"team_uid"`
			RoleUID          string `xorm:"role_uid"`
		}

		bindings := make([]Binding, 0)
		var userBindings []Binding
		err := store.WithDbSession(ctx, func(sess *db.Session) error {
			return sess.SQL(userQuery, orgID).Find(&userBindings)
		})
		if err != nil {
			return nil, err
		}
		bindings = append(bindings, userBindings...)

		teamQuery := `
			SELECT t.uid AS team_uid, r.uid AS role_uid
			FROM team_role tr
			INNER JOIN team t ON tr.team_id = t.id
			INNER JOIN role r ON tr.role_id = r.id
			WHERE t.org_id = ?
			AND r.name NOT LIKE 'managed:%'
		`
		var teamBindings []Binding
		err = store.WithDbSession(ctx, func(sess *db.Session) error {
			return sess.SQL(teamQuery, orgID).Find(&teamBindings)
		})
		if err != nil {
			return nil, err
		}
		bindings = append(bindings, teamBindings...)

		tuples := make(map[string]map[string]*openfgav1.TupleKey)
		for _, b := range bindings {
			var tuple *openfgav1.TupleKey

			if b.UserUID != "" {
				userType := zanzana.TypeUser
				if b.IsServiceAccount {
					userType = zanzana.TypeServiceAccount
				}

				tuple = &openfgav1.TupleKey{
					User:     zanzana.NewTupleEntry(userType, b.UserUID, ""),
					Relation: zanzana.RelationAssignee,
					Object:   zanzana.NewTupleEntry(zanzana.TypeRole, b.RoleUID, ""),
				}

				if tuples[tuple.Object] == nil {
					tuples[tuple.Object] = make(map[string]*openfgav1.TupleKey)
				}
			} else if b.TeamUID != "" {
				tuple = &openfgav1.TupleKey{
					User:     zanzana.NewTupleEntry(zanzana.TypeTeam, b.TeamUID, zanzana.RelationTeamMember),
					Relation: zanzana.RelationAssignee,
					Object:   zanzana.NewTupleEntry(zanzana.TypeRole, b.RoleUID, ""),
				}

				if tuples[tuple.Object] == nil {
					tuples[tuple.Object] = make(map[string]*openfgav1.TupleKey)
				}
			}

			tuples[tuple.Object][tuple.String()] = tuple
		}

		return tuples, nil
	}
}

func rolePermissionsCollector(store db.DB) legacyTupleCollector {
	return func(ctx context.Context, orgID int64) (map[string]map[string]*openfgav1.TupleKey, error) {
		query := `
			SELECT r.uid as role_uid, p.action, p.kind, p.identifier
			FROM permission p
			INNER JOIN role r ON p.role_id = r.id
			LEFT JOIN builtin_role br ON r.id  = br.role_id
			WHERE (r.org_id = 0 OR r.org_id = ?)
			AND r.name NOT LIKE 'managed:%'
		`

		type Permission struct {
			Action     string `xorm:"action"`
			Kind       string
			Identifier string
			RoleUID    string `xorm:"role_uid"`
		}

		var permissions []Permission
		err := store.WithDbSession(ctx, func(sess *db.Session) error {
			return sess.SQL(query, orgID).Find(&permissions)
		})
		if err != nil {
			return nil, err
		}

		tuples := make(map[string]map[string]*openfgav1.TupleKey)

		for _, p := range permissions {
			tuple, ok := zanzana.TranslateToResourceTuple(
				zanzana.NewTupleEntry(zanzana.TypeRole, p.RoleUID, zanzana.RelationAssignee),
				p.Action,
				p.Kind,
				p.Identifier,
			)
			if !ok {
				continue
			}

			if tuples[tuple.Object] == nil {
				tuples[tuple.Object] = make(map[string]*openfgav1.TupleKey)
			}

			// For resource actions on folders we need to merge the tuples into one with combined subresources.
			if zanzana.IsFolderResourceTuple(tuple) {
				key := tupleStringWithoutCondition(tuple)
				if t, ok := tuples[tuple.Object][key]; ok {
					zanzana.MergeFolderResourceTuples(t, tuple)
				} else {
					tuples[tuple.Object][key] = tuple
				}

				continue
			}

			tuples[tuple.Object][tuple.String()] = tuple
		}

		return tuples, nil
	}
}

// basicRoleBindingsCollector collects role bindings for basic roles
func anonymousRoleBindingsCollector(cfg *setting.Cfg, store db.DB) legacyTupleCollector {
	return func(ctx context.Context, orgID int64) (map[string]map[string]*openfgav1.TupleKey, error) {
		tuples := make(map[string]map[string]*openfgav1.TupleKey)
		object := zanzana.NewTupleEntry(zanzana.TypeRole, zanzana.TranslateBasicRole(cfg.Anonymous.OrgRole), "")
		// Object should be set to delete obsolete permissions
		tuples[object] = make(map[string]*openfgav1.TupleKey)

		o, err := getOrgByName(ctx, store, cfg.Anonymous.OrgName)
		if err != nil {
			return tuples, nil
		}

		if o.ID != orgID {
			return tuples, nil
		}

		tuple := &openfgav1.TupleKey{
			User:     zanzana.NewTupleEntry(zanzana.TypeAnonymous, "0", ""),
			Relation: zanzana.RelationAssignee,
			Object:   object,
		}

		tuples[tuple.Object][tuple.String()] = tuple

		return tuples, nil
	}
}

func zanzanaCollector(relations []string) zanzanaTupleCollector {
	return func(ctx context.Context, client zanzana.Client, object string, namespace string) (map[string]*openfgav1.TupleKey, error) {
		// list will use continuation token to collect all tuples for object and relation
		list := func(relation string) ([]*openfgav1.Tuple, error) {
			first, err := client.Read(ctx, &authzextv1.ReadRequest{
				Namespace: namespace,
				TupleKey: &authzextv1.ReadRequestTupleKey{
					Object:   object,
					Relation: relation,
				},
			})
			if err != nil {
				return nil, err
			}

			c := first.ContinuationToken

			for c != "" {
				res, err := client.Read(ctx, &authzextv1.ReadRequest{
					ContinuationToken: c,
					Namespace:         namespace,
					TupleKey: &authzextv1.ReadRequestTupleKey{
						Object:   object,
						Relation: relation,
					},
				})
				if err != nil {
					return nil, err
				}

				c = res.ContinuationToken
				first.Tuples = append(first.Tuples, res.Tuples...)
			}

			return zanzana.ToOpenFGATuples(first.Tuples), nil
		}

		out := make(map[string]*openfgav1.TupleKey)
		for _, r := range relations {
			tuples, err := list(r)
			if err != nil {
				return nil, err
			}
			for _, t := range tuples {
				if zanzana.IsFolderResourceTuple(t.Key) {
					out[tupleStringWithoutCondition(t.Key)] = t.Key
				} else {
					out[t.Key.String()] = t.Key
				}
			}
		}

		return out, nil
	}
}
