package database

import (
	"context"
	"strconv"
	"strings"

	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/services/sqlstore/db"
)

const (
	globalOrgID = 0
)

func ProvideService(sql db.DB) *AccessControlStore {
	return &AccessControlStore{sql}
}

type AccessControlStore struct {
	sql db.DB
}

func (s *AccessControlStore) GetUserPermissions(ctx context.Context, query accesscontrol.GetUserPermissionsQuery) ([]accesscontrol.Permission, error) {
	result := make([]accesscontrol.Permission, 0)
	err := s.sql.WithDbSession(ctx, func(sess *sqlstore.DBSession) error {
		if query.UserID == 0 && len(query.TeamIDs) == 0 && len(query.Roles) == 0 {
			// no permission to fetch
			return nil
		}

		filter, params := userRolesFilter(query.OrgID, query.UserID, query.TeamIDs, query.Roles)

		q := `
		SELECT
			permission.action,
			permission.scope
			FROM permission
			INNER JOIN role ON role.id = permission.role_id
		` + filter

		if len(query.Actions) > 0 {
			q += " WHERE permission.action IN("
			if len(query.Actions) > 0 {
				q += "?" + strings.Repeat(",?", len(query.Actions)-1)
			}
			q += ")"
			for _, a := range query.Actions {
				params = append(params, a)
			}
		}
		if err := sess.SQL(q, params...).Find(&result); err != nil {
			return err
		}

		return nil
	})

	return result, err
}

// GetUsersPermissions returns the list of user permissions indexed by UserID
func (s *AccessControlStore) GetUsersPermissions(ctx context.Context, orgID int64, actionPrefix string) (map[int64][]accesscontrol.Permission, map[int64][]string, error) {
	type UserRBACPermission struct {
		UserID int64  `xorm:"user_id"`
		Action string `xorm:"action"`
		Scope  string `xorm:"scope"`
	}
	type UserOrgRole struct {
		UserID  int64  `xorm:"id"`
		OrgRole string `xorm:"role"`
		IsAdmin bool   `xorm:"is_admin"`
	}
	dbPerms := make([]UserRBACPermission, 0)
	dbRoles := make([]UserOrgRole, 0)
	err := s.sql.WithDbSession(ctx, func(sess *sqlstore.DBSession) error {
		// Find permissions
		q := `
		SELECT
			user_id,
			action,
			scope
		FROM (
			SELECT ur.user_id, ur.org_id, p.action, p.scope
				FROM permission AS p
				INNER JOIN user_role AS ur on ur.role_id = p.role_id
			UNION
				SELECT tm.user_id, tr.org_id, p.action, p.scope
					FROM permission AS p
					INNER JOIN team_role AS tr ON tr.role_id = p.role_id
					INNER JOIN team_member AS tm ON tm.team_id = tr.team_id
			UNION
				SELECT ou.user_id, br.org_id, p.action, p.scope
					FROM permission AS p
					INNER JOIN builtin_role AS br ON br.role_id = p.role_id
					INNER JOIN org_user AS ou ON ou.role = br.role
			UNION
				SELECT sa.user_id, br.org_id, p.action, p.scope
					FROM permission AS p
					INNER JOIN builtin_role AS br ON br.role_id = p.role_id
					INNER JOIN (
						SELECT user.id AS user_id
						FROM user WHERE user.is_admin
					) AS sa ON 1 = 1 
					WHERE br.role = 'Grafana Admin'
		) AS up
		WHERE
			(org_id = ? OR org_id = ?)
			AND action LIKE ?
		`

		if err := sess.SQL(q, globalOrgID, orgID, actionPrefix+"%").Find(&dbPerms); err != nil {
			return err
		}

		// Find roles
		// Technically Grafana Admins won't be returned here if they are not members of the org
		q = `
		SELECT u.id, ou.role, u.is_admin
		FROM user AS u 
		INNER JOIN org_user AS ou ON u.id = ou.user_id
		WHERE ou.org_id = ?
		`

		if err := sess.SQL(q, orgID).Find(&dbRoles); err != nil {
			return err
		}
		return nil
	})

	mapped := map[int64][]accesscontrol.Permission{}
	for i := range dbPerms {
		mapped[dbPerms[i].UserID] = append(mapped[dbPerms[i].UserID], accesscontrol.Permission{Action: dbPerms[i].Action, Scope: dbPerms[i].Scope})
	}

	roles := map[int64][]string{}
	for i := range dbRoles {
		roles[dbRoles[i].UserID] = []string{dbRoles[i].OrgRole}
		if dbRoles[i].IsAdmin {
			roles[dbRoles[i].UserID] = append(roles[dbRoles[i].UserID], accesscontrol.RoleGrafanaAdmin)
		}
	}

	return mapped, roles, err
}

func userRolesFilter(orgID, userID int64, teamIDs []int64, roles []string) (string, []interface{}) {
	var params []interface{}
	builder := strings.Builder{}

	// This is an additional security. We should never have permissions granted to userID 0.
	// Only allow real users to get user/team permissions (anonymous/apikeys)
	if userID > 0 {
		builder.WriteString(`
			SELECT ur.role_id
			FROM user_role AS ur
			WHERE ur.user_id = ?
			AND (ur.org_id = ? OR ur.org_id = ?)
		`)
		params = []interface{}{userID, orgID, globalOrgID}
	}

	if len(teamIDs) > 0 {
		if builder.Len() > 0 {
			builder.WriteString("UNION")
		}
		builder.WriteString(`
			SELECT tr.role_id FROM team_role as tr
			WHERE tr.team_id IN(?` + strings.Repeat(", ?", len(teamIDs)-1) + `)
			AND tr.org_id = ?
		`)
		for _, id := range teamIDs {
			params = append(params, id)
		}
		params = append(params, orgID)
	}

	if len(roles) != 0 {
		if builder.Len() > 0 {
			builder.WriteString("UNION")
		}

		builder.WriteString(`
			SELECT br.role_id FROM builtin_role AS br
			WHERE br.role IN (?` + strings.Repeat(", ?", len(roles)-1) + `)
			AND (br.org_id = ? OR br.org_id = ?)
		`)
		for _, role := range roles {
			params = append(params, role)
		}

		params = append(params, orgID, globalOrgID)
	}

	return "INNER JOIN (" + builder.String() + ") as all_role ON role.id = all_role.role_id", params
}

func (s *AccessControlStore) DeleteUserPermissions(ctx context.Context, orgID, userID int64) error {
	err := s.sql.WithDbSession(ctx, func(sess *sqlstore.DBSession) error {
		roleDeleteQuery := "DELETE FROM user_role WHERE user_id = ?"
		roleDeleteParams := []interface{}{roleDeleteQuery, userID}
		if orgID != accesscontrol.GlobalOrgID {
			roleDeleteQuery += " AND org_id = ?"
			roleDeleteParams = []interface{}{roleDeleteQuery, userID, orgID}
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
		roleParams := []interface{}{accesscontrol.ManagedUserRoleName(userID)}
		if orgID != accesscontrol.GlobalOrgID {
			roleQuery += " AND org_id = ?"
			roleParams = []interface{}{accesscontrol.ManagedUserRoleName(userID), orgID}
		}

		var roleIDs []int64
		if err := sess.SQL(roleQuery, roleParams...).Find(&roleIDs); err != nil {
			return err
		}

		if len(roleIDs) == 0 {
			return nil
		}

		permissionDeleteQuery := "DELETE FROM permission WHERE role_id IN(? " + strings.Repeat(",?", len(roleIDs)-1) + ")"
		permissionDeleteParams := make([]interface{}, 0, len(roleIDs)+1)
		permissionDeleteParams = append(permissionDeleteParams, permissionDeleteQuery)
		for _, id := range roleIDs {
			permissionDeleteParams = append(permissionDeleteParams, id)
		}

		// Delete managed user permissions
		if _, err := sess.Exec(permissionDeleteParams...); err != nil {
			return err
		}

		managedRoleDeleteQuery := "DELETE FROM role WHERE id IN(? " + strings.Repeat(",?", len(roleIDs)-1) + ")"
		managedRoleDeleteParams := []interface{}{managedRoleDeleteQuery}
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
