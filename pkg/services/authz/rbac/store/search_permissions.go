package store

import (
	"context"
	"fmt"
	"strings"

	"github.com/grafana/authlib/types"
	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/storage/legacysql"
)

type SearchPermissionStore interface {
	SearchUsersPermissions(context.Context, types.NamespaceInfo, accesscontrol.SearchOptions) (map[int64][]accesscontrol.Permission, error)
	GetUsersBasicRoles(context.Context, types.NamespaceInfo, []int64) (map[int64][]string, error)
	GetSearchCallerID(context.Context, types.NamespaceInfo, types.IdentityType, string, *int64) (int64, error)
}

func searchTables(query string, helper *legacysql.LegacyDatabaseHelper) (string, error) {
	replacements := []string{}
	for _, table := range []string{"user_role", "team_role", "team_member", "builtin_role", "org_user", "role", "permission"} {
		name, err := helper.DialectForDriver().Ident(helper.Table(table))
		if err != nil {
			return "", err
		}
		replacements = append(replacements, table+" AS", name+" AS")
	}
	return strings.NewReplacer(replacements...).Replace(query), nil
}

func (s *SQLPermissionsStore) GetSearchCallerID(ctx context.Context, ns types.NamespaceInfo, kind types.IdentityType, uid string, internalID *int64) (int64, error) {
	helper, err := s.sql(ctx)
	if err != nil {
		return 0, err
	}
	userTable, err := helper.DialectForDriver().Ident(helper.Table("user"))
	if err != nil {
		return 0, err
	}
	var result struct {
		ID int64 `xorm:"id"`
	}
	err = helper.DB.WithDbSession(ctx, func(sess *db.Session) error {
		column, value := "uid", any(uid)
		if internalID != nil {
			column, value = "id", *internalID
		}
		exists, err := sess.SQL("SELECT id FROM "+userTable+" WHERE "+column+" = ? AND is_service_account = ?", value, kind == types.TypeServiceAccount).Get(&result)
		if err != nil {
			return err
		}
		if !exists {
			return fmt.Errorf("caller not found")
		}
		return nil
	})
	return result.ID, err
}

const (
	// userAssignsSQL is a query to select all users assignments.
	userAssignsSQL = `SELECT ur.user_id, ur.org_id, ur.role_id
	FROM user_role AS ur`

	// teamAssignsSQL is a query to select all users' team assignments.
	teamAssignsSQL = `SELECT tm.user_id, tr.org_id, tr.role_id
	FROM team_role AS tr
	INNER JOIN team_member AS tm ON tm.team_id = tr.team_id`

	// basicRoleAssignsSQL is a query to select all users basic role (Admin, Editor, Viewer, None) assignments.
	// The join must match on org_id as well as role name: builtin_role has one row
	// per org per managed role, so joining on name alone would match a user's managed
	// role to another org's managed role and leak its permissions cross-org.
	// However the basic_role -> role join is global, so we need to add the global org ID to the query.
	basicRoleAssignsSQL = `SELECT ou.user_id, ou.org_id, br.role_id
	FROM builtin_role AS br
	INNER JOIN org_user AS ou ON ou.role = br.role AND (ou.org_id = br.org_id OR br.org_id = ?)`

	// grafanaAdminAssignsSQL is a query to select all grafana admin users.
	// it has to be formatted with the quoted user table.
	grafanaAdminAssignsSQL = `SELECT sa.user_id, br.org_id, br.role_id
	FROM builtin_role AS br
	INNER JOIN (
		SELECT u.id AS user_id
	    FROM %s AS u WHERE u.is_admin
	) AS sa ON 1 = 1
	WHERE br.role = ?`
)

func (s *SQLPermissionsStore) SearchUsersPermissions(ctx context.Context, ns types.NamespaceInfo, options accesscontrol.SearchOptions) (map[int64][]accesscontrol.Permission, error) {
	ctx, span := s.tracer.Start(ctx, "authz_direct_db.database.SearchUsersPermissions")
	defer span.End()
	helper, err := s.sql(ctx)
	if err != nil {
		return nil, err
	}
	orgID := ns.OrgID
	userTable, err := helper.DialectForDriver().Ident(helper.Table("user"))
	if err != nil {
		return nil, err
	}

	type UserRBACPermission struct {
		UserID int64  `xorm:"user_id"`
		Action string `xorm:"action"`
		Scope  string `xorm:"scope"`
	}
	dbPerms := make([]UserRBACPermission, 0)

	if err := helper.DB.WithDbSession(ctx, func(sess *db.Session) error {
		roleNameFilterJoin := ""
		if len(options.RolePrefixes) > 0 {
			roleNameFilterJoin = "INNER JOIN role AS r ON up.role_id = r.id"
		}

		params := []any{}

		direct := userAssignsSQL
		team := teamAssignsSQL

		if options.UserID > 0 {
			direct += " WHERE ur.user_id = ?"
			params = append(params, options.UserID)

			team += " WHERE tm.user_id = ?"
			params = append(params, options.UserID)
		}

		// Basic role link to its role is global
		basic := basicRoleAssignsSQL
		params = append(params, accesscontrol.GlobalOrgID)
		if options.UserID > 0 {
			basic += " WHERE ou.user_id = ?"
			params = append(params, options.UserID)
		}

		grafanaAdmin := fmt.Sprintf(grafanaAdminAssignsSQL, userTable)
		params = append(params, accesscontrol.RoleGrafanaAdmin)
		if options.UserID > 0 {
			grafanaAdmin += " AND sa.user_id = ?"
			params = append(params, options.UserID)
		}

		// Find permissions
		q := `
		SELECT
			user_id,
			p.action,
			p.scope
		FROM (
			` + direct + `
			UNION ALL
			` + team + `
			UNION ALL
			` + basic + `
			UNION ALL
			` + grafanaAdmin + `
		) AS up ` + roleNameFilterJoin + `
		INNER JOIN permission AS p ON up.role_id = p.role_id
		WHERE (up.org_id = ? OR up.org_id = ?)
		`
		params = append(params, orgID, accesscontrol.GlobalOrgID)

		if options.ActionPrefix != "" {
			// The action-prefix and action-set conditions must be grouped so the
			// preceding org filter (and trailing role-prefix filter) always apply.
			// Without the parentheses, SQL precedence detaches the action-set OR
			// branch from the org filter and leaks permissions across orgs.
			q += ` AND (p.action LIKE ?`
			params = append(params, options.ActionPrefix+"%")
			if len(options.ActionSets) > 0 {
				q += ` OR p.action IN ( ? ` + strings.Repeat(", ?", len(options.ActionSets)-1) + ")"
				for _, a := range options.ActionSets {
					params = append(params, a)
				}
			}
			q += `)`
		}
		if options.Action != "" {
			if len(options.ActionSets) == 0 {
				q += ` AND p.action = ?`
				params = append(params, options.Action)
			} else {
				actions := append(options.ActionSets, options.Action)
				q += ` AND p.action IN ( ? ` + strings.Repeat(", ?", len(actions)-1) + ")"
				for _, a := range actions {
					params = append(params, a)
				}
			}
		}
		if options.Scope != "" {
			// Search for scope and wildcard that include the scope
			scopes := append(options.Wildcards(), options.Scope)
			q += ` AND p.scope IN ( ? ` + strings.Repeat(", ?", len(scopes)-1) + ")"
			for i := range scopes {
				params = append(params, scopes[i])
			}
		}
		if len(options.RolePrefixes) > 0 {
			q += " AND ( " + strings.Repeat("r.name LIKE ? OR ", len(options.RolePrefixes)-1)
			q += "r.name LIKE ? )"
			for _, prefix := range options.RolePrefixes {
				params = append(params, prefix+"%")
			}
		}

		query, err := searchTables(q, helper)
		if err != nil {
			return err
		}
		return sess.SQL(query, params...).Find(&dbPerms)
	}); err != nil {
		return nil, err
	}

	mapped := map[int64][]accesscontrol.Permission{}
	for i := range dbPerms {
		mapped[dbPerms[i].UserID] = append(mapped[dbPerms[i].UserID], accesscontrol.Permission{Action: dbPerms[i].Action, Scope: dbPerms[i].Scope})
	}

	return mapped, nil
}

// GetUsersBasicRoles returns the list of user basic roles (Admin, Editor, Viewer, Grafana Admin) indexed by UserID
func (s *SQLPermissionsStore) GetUsersBasicRoles(ctx context.Context, ns types.NamespaceInfo, userFilter []int64) (map[int64][]string, error) {
	ctx, span := s.tracer.Start(ctx, "authz_direct_db.database.GetUsersBasicRoles")
	defer span.End()
	helper, err := s.sql(ctx)
	if err != nil {
		return nil, err
	}
	orgID := ns.OrgID
	userTable, err := helper.DialectForDriver().Ident(helper.Table("user"))
	if err != nil {
		return nil, err
	}

	type UserOrgRole struct {
		UserID  int64  `xorm:"id"`
		OrgRole string `xorm:"role"`
		IsAdmin bool   `xorm:"is_admin"`
	}
	dbRoles := make([]UserOrgRole, 0)
	if err := helper.DB.WithDbSession(ctx, func(sess *db.Session) error {
		// Find roles
		q := `
		SELECT u.id, ou.role, u.is_admin
		FROM ` + userTable + ` AS u
		LEFT JOIN org_user AS ou ON u.id = ou.user_id
		WHERE (u.is_admin OR ou.org_id = ?)
		`
		params := []any{orgID}
		if len(userFilter) > 0 {
			q += "AND u.id IN (?" + strings.Repeat(",?", len(userFilter)-1) + ")"
			for _, u := range userFilter {
				params = append(params, u)
			}
		}

		query, err := searchTables(q, helper)
		if err != nil {
			return err
		}
		return sess.SQL(query, params...).Find(&dbRoles)
	}); err != nil {
		return nil, err
	}

	roles := map[int64][]string{}
	for i := range dbRoles {
		if dbRoles[i].OrgRole != "" {
			roles[dbRoles[i].UserID] = []string{dbRoles[i].OrgRole}
		}
		if dbRoles[i].IsAdmin {
			roles[dbRoles[i].UserID] = append(roles[dbRoles[i].UserID], accesscontrol.RoleGrafanaAdmin)
		}
	}
	return roles, nil
}
