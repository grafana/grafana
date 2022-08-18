package database

import (
	"context"
	"strconv"
	"strings"

	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/sqlstore"
)

const (
	globalOrgID = 0
)

func ProvideService(sqlStore *sqlstore.SQLStore) *AccessControlStore {
	return &AccessControlStore{sqlStore}
}

type AccessControlStore struct {
	sql *sqlstore.SQLStore
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
