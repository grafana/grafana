package database

import (
	"context"
	"fmt"
	"strconv"
	"strings"

	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/attribute"

	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
)

var tracer = otel.Tracer("github.com/grafana/grafana/pkg/services/accesscontrol/database")

const (
	// userAssignsSQL is a query to select all users assignments.
	userAssignsSQL = `SELECT ur.user_id, ur.org_id, ur.role_id
	FROM user_role AS ur`

	// teamAssignsSQL is a query to select all users' team assignments.
	teamAssignsSQL = `SELECT tm.user_id, tr.org_id, tr.role_id
	FROM team_role AS tr
	INNER JOIN team_member AS tm ON tm.team_id = tr.team_id`

	// basicRoleAssignsSQL is a query to select all users basic role (Admin, Editor, Viewer, None) assignments.
	basicRoleAssignsSQL = `SELECT ou.user_id, ou.org_id, br.role_id
	FROM builtin_role AS br
	INNER JOIN org_user AS ou ON ou.role = br.role`

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

func ProvideService(sql db.DB) *AccessControlStore {
	return &AccessControlStore{sql}
}

type AccessControlStore struct {
	sql db.DB
}

func (s *AccessControlStore) GetUserPermissions(ctx context.Context, query accesscontrol.GetUserPermissionsQuery) ([]accesscontrol.Permission, error) {
	ctx, span := tracer.Start(ctx, "accesscontrol.database.GetUserPermissions")
	defer span.End()

	if query.UserID == 0 && len(query.TeamIDs) == 0 && len(query.Roles) == 0 {
		return nil, nil
	}

	_, buildSpan := tracer.Start(ctx, "accesscontrol.database.GetUserPermissions.build_query")
	filter, params := accesscontrol.UserRolesFilter(query.OrgID, query.UserID, query.TeamIDs, query.Roles, s.sql.GetDialect())

	q := `
	SELECT
		permission.action,
		permission.scope
		FROM permission
		INNER JOIN role ON role.id = permission.role_id
	` + filter

	if len(query.RolePrefixes) > 0 {
		rolePrefixesFilter, filterParams := accesscontrol.RolePrefixesFilter(query.RolePrefixes)
		q += rolePrefixesFilter
		params = append(params, filterParams...)
	}

	if query.ExcludeRedundantManagedPermissions {
		q += accesscontrol.ManagedPermissionsActionSetsFilter()
	}
	buildSpan.End()

	_, querySpan := tracer.Start(ctx, "accesscontrol.database.GetUserPermissions.query")
	result, err := s.getUserPermissionsRaw(ctx, q, params)
	if err != nil {
		querySpan.End()
		return nil, err
	}
	querySpan.SetAttributes(attribute.Int("result_count", len(result)))
	querySpan.End()

	return result, nil
}

// getUserPermissionsRaw scans rows directly into []Permission. This avoids xorm's
// Find() reflection over 10k+ rows, which was adding tens of ms after the DB had
// already returned. The query runs inside WithDbSession so retryable errors
// (e.g. SQLite lock contention) and transaction-bound sessions from context are honored.
func (s *AccessControlStore) getUserPermissionsRaw(ctx context.Context, q string, params []any) ([]accesscontrol.Permission, error) {
	var out []accesscontrol.Permission
	err := s.sql.WithDbSession(ctx, func(sess *db.Session) error {
		rows, err := sess.QueryRows(q, params...)
		if err != nil {
			return err
		}
		defer func() { _ = rows.Close() }()

		// Pre-allocate with a reasonable capacity to limit reallocations for large result sets.
		out = make([]accesscontrol.Permission, 0, 512)
		var action, scope string
		for rows.Next() {
			if err := rows.Scan(&action, &scope); err != nil {
				return err
			}
			out = append(out, accesscontrol.Permission{Action: action, Scope: scope})
		}
		return rows.Err()
	})
	if err != nil {
		return nil, err
	}
	return out, nil
}

func (s *AccessControlStore) GetBasicRolesPermissions(ctx context.Context, query accesscontrol.GetUserPermissionsQuery) ([]accesscontrol.Permission, error) {
	return s.GetUserPermissions(ctx, accesscontrol.GetUserPermissionsQuery{
		Roles:        query.Roles,
		OrgID:        query.OrgID,
		RolePrefixes: query.RolePrefixes,
	})
}

func (s *AccessControlStore) GetTeamsPermissions(ctx context.Context, query accesscontrol.GetUserPermissionsQuery) (map[int64][]accesscontrol.Permission, error) {
	ctx, span := tracer.Start(ctx, "accesscontrol.database.GetTeamsPermissions")
	defer span.End()

	teams := query.TeamIDs
	orgID := query.OrgID
	rolePrefixes := query.RolePrefixes

	if len(teams) == 0 {
		return nil, nil
	}

	q := `
		SELECT
			permission.action,
			permission.scope,
			all_role.team_id
		FROM permission
		INNER JOIN role ON role.id = permission.role_id
		INNER JOIN (
			SELECT tr.role_id, tr.team_id FROM team_role as tr
			WHERE tr.team_id IN(?` + strings.Repeat(", ?", len(teams)-1) + `)
			  AND tr.org_id = ?
		) as all_role ON role.id = all_role.role_id
		`

	params := make([]any, 0, len(teams)+1)
	for _, team := range teams {
		params = append(params, team)
	}
	params = append(params, orgID)

	if len(rolePrefixes) > 0 {
		rolePrefixesFilter, filterParams := accesscontrol.RolePrefixesFilter(rolePrefixes)
		q += rolePrefixesFilter
		params = append(params, filterParams...)
	}

	if query.ExcludeRedundantManagedPermissions {
		q += accesscontrol.ManagedPermissionsActionSetsFilter()
	}

	var teamPermissions map[int64][]accesscontrol.Permission
	err := s.sql.WithDbSession(ctx, func(sess *db.Session) error {
		rows, err := sess.QueryRows(q, params...)
		if err != nil {
			return err
		}
		defer func() { _ = rows.Close() }()

		teamPermissions = make(map[int64][]accesscontrol.Permission)
		var action, scope string
		var teamID int64
		for rows.Next() {
			if err := rows.Scan(&action, &scope, &teamID); err != nil {
				return err
			}
			if _, ok := teamPermissions[teamID]; !ok {
				teamPermissions[teamID] = make([]accesscontrol.Permission, 0, 32)
			}
			teamPermissions[teamID] = append(teamPermissions[teamID], accesscontrol.Permission{Action: action, Scope: scope})
		}
		return rows.Err()
	})
	if err != nil {
		return nil, err
	}
	return teamPermissions, nil
}

// SearchUsersPermissions returns the list of user permissions in specific organization indexed by UserID
func (s *AccessControlStore) SearchUsersPermissions(ctx context.Context, orgID int64, options accesscontrol.SearchOptions) (map[int64][]accesscontrol.Permission, error) {
	ctx, span := tracer.Start(ctx, "accesscontrol.database.SearchUsersPermissions")
	defer span.End()

	type UserRBACPermission struct {
		UserID int64  `xorm:"user_id"`
		Action string `xorm:"action"`
		Scope  string `xorm:"scope"`
	}
	dbPerms := make([]UserRBACPermission, 0)

	if err := s.sql.WithDbSession(ctx, func(sess *db.Session) error {
		roleNameFilterJoin := ""
		if len(options.RolePrefixes) > 0 {
			roleNameFilterJoin = "INNER JOIN role AS r ON up.role_id = r.id"
		}

		params := []any{}

		direct := userAssignsSQL
		team := teamAssignsSQL
		basic := basicRoleAssignsSQL

		if options.UserID > 0 {
			direct += " WHERE ur.user_id = ?"
			params = append(params, options.UserID)

			team += " WHERE tm.user_id = ?"
			params = append(params, options.UserID)

			basic += " WHERE ou.user_id = ?"
			params = append(params, options.UserID)
		}

		grafanaAdmin := fmt.Sprintf(grafanaAdminAssignsSQL, s.sql.Quote("user"))
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
			q += ` AND p.action LIKE ?`
			params = append(params, options.ActionPrefix+"%")
			if len(options.ActionSets) > 0 {
				q += ` OR p.action IN ( ? ` + strings.Repeat(", ?", len(options.ActionSets)-1) + ")"
				for _, a := range options.ActionSets {
					params = append(params, a)
				}
			}
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

		return sess.SQL(q, params...).Find(&dbPerms)
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
func (s *AccessControlStore) GetUsersBasicRoles(ctx context.Context, userFilter []int64, orgID int64) (map[int64][]string, error) {
	ctx, span := tracer.Start(ctx, "accesscontrol.database.GetUsersBasicRoles")
	defer span.End()

	type UserOrgRole struct {
		UserID  int64  `xorm:"id"`
		OrgRole string `xorm:"role"`
		IsAdmin bool   `xorm:"is_admin"`
	}
	dbRoles := make([]UserOrgRole, 0)
	if err := s.sql.WithDbSession(ctx, func(sess *db.Session) error {
		// Find roles
		q := `
		SELECT u.id, ou.role, u.is_admin
		FROM ` + s.sql.GetDialect().Quote("user") + ` AS u
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

		return sess.SQL(q, params...).Find(&dbRoles)
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

func (s *AccessControlStore) DeleteUserPermissions(ctx context.Context, orgID, userID int64) error {
	ctx, span := tracer.Start(ctx, "accesscontrol.database.DeleteUserPermissions")
	defer span.End()

	err := s.sql.WithDbSession(ctx, func(sess *db.Session) error {
		roleDeleteQuery := "DELETE FROM user_role WHERE user_id = ?"
		roleDeleteParams := []any{roleDeleteQuery, userID}
		if orgID != accesscontrol.GlobalOrgID {
			roleDeleteQuery += " AND org_id = ?"
			roleDeleteParams = []any{roleDeleteQuery, userID, orgID}
		}

		// Delete user role assignments
		if _, err := sess.Exec(roleDeleteParams...); err != nil {
			return err
		}

		// only delete scopes to user if all permissions is removed (i.e. user is removed)
		if orgID == accesscontrol.GlobalOrgID {
			// Delete permissions that are scoped to user
			if _, err := sess.Exec("DELETE FROM permission WHERE scope = ?", accesscontrol.Scope("users", "id", strconv.FormatInt(userID, 10))); err != nil {
				return err
			}
		}

		roleQuery := "SELECT id FROM role WHERE name = ?"
		roleParams := []any{accesscontrol.ManagedUserRoleName(userID)}
		if orgID != accesscontrol.GlobalOrgID {
			roleQuery += " AND org_id = ?"
			roleParams = []any{accesscontrol.ManagedUserRoleName(userID), orgID}
		}

		var roleIDs []int64
		if err := sess.SQL(roleQuery, roleParams...).Find(&roleIDs); err != nil {
			return err
		}

		if len(roleIDs) == 0 {
			return nil
		}

		permissionDeleteQuery := "DELETE FROM permission WHERE role_id IN(? " + strings.Repeat(",?", len(roleIDs)-1) + ")"
		permissionDeleteParams := make([]any, 0, len(roleIDs)+1)
		permissionDeleteParams = append(permissionDeleteParams, permissionDeleteQuery)
		for _, id := range roleIDs {
			permissionDeleteParams = append(permissionDeleteParams, id)
		}

		// Delete managed user permissions
		if _, err := sess.Exec(permissionDeleteParams...); err != nil {
			return err
		}

		managedRoleDeleteQuery := "DELETE FROM role WHERE id IN(? " + strings.Repeat(",?", len(roleIDs)-1) + ")"
		managedRoleDeleteParams := []any{managedRoleDeleteQuery}
		for _, id := range roleIDs {
			managedRoleDeleteParams = append(managedRoleDeleteParams, id)
		}
		// Delete managed user roles
		if _, err := sess.Exec(managedRoleDeleteParams...); err != nil {
			return err
		}

		return nil
	})
	return err
}

func (s *AccessControlStore) DeleteTeamPermissions(ctx context.Context, orgID, teamID int64) error {
	ctx, span := tracer.Start(ctx, "accesscontrol.database.DeleteTeamPermissions")
	defer span.End()

	err := s.sql.WithDbSession(ctx, func(sess *db.Session) error {
		roleDeleteQuery := "DELETE FROM team_role WHERE team_id = ? AND org_id = ?"
		roleDeleteParams := []any{roleDeleteQuery, teamID, orgID}

		// Delete team role assignments
		if _, err := sess.Exec(roleDeleteParams...); err != nil {
			return err
		}

		// Delete permissions that are scoped to the team
		if _, err := sess.Exec("DELETE FROM permission WHERE scope = ?", accesscontrol.Scope("teams", "id", strconv.FormatInt(teamID, 10))); err != nil {
			return err
		}

		// Delete the team managed role
		roleQuery := "SELECT id FROM role WHERE name = ? AND org_id = ?"
		roleParams := []any{accesscontrol.ManagedTeamRoleName(teamID), orgID}

		var roleIDs []int64
		if err := sess.SQL(roleQuery, roleParams...).Find(&roleIDs); err != nil {
			return err
		}

		if len(roleIDs) == 0 {
			return nil
		}

		permissionDeleteQuery := "DELETE FROM permission WHERE role_id IN(? " + strings.Repeat(",?", len(roleIDs)-1) + ")"
		permissionDeleteParams := make([]any, 0, len(roleIDs)+1)
		permissionDeleteParams = append(permissionDeleteParams, permissionDeleteQuery)
		for _, id := range roleIDs {
			permissionDeleteParams = append(permissionDeleteParams, id)
		}

		// Delete managed team permissions
		if _, err := sess.Exec(permissionDeleteParams...); err != nil {
			return err
		}

		managedRoleDeleteQuery := "DELETE FROM role WHERE id IN(? " + strings.Repeat(",?", len(roleIDs)-1) + ")"
		managedRoleDeleteParams := []any{managedRoleDeleteQuery}
		for _, id := range roleIDs {
			managedRoleDeleteParams = append(managedRoleDeleteParams, id)
		}
		// Delete managed team role
		if _, err := sess.Exec(managedRoleDeleteParams...); err != nil {
			return err
		}

		return nil
	})
	return err
}
