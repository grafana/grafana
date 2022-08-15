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

func deletePermissions(sess *sqlstore.DBSession, ids []int64) error {
	if len(ids) == 0 {
		return nil
	}

	rawSQL := "DELETE FROM permission WHERE id IN(?" + strings.Repeat(",?", len(ids)-1) + ")"
	args := make([]interface{}, 0, len(ids)+1)
	args = append(args, rawSQL)
	for _, id := range ids {
		args = append(args, id)
	}

	_, err := sess.Exec(args...)
	if err != nil {
		return err
	}

	return nil
}

func (s *AccessControlStore) DeleteUserPermissions(ctx context.Context, userID int64) error {
	err := s.sql.WithDbSession(ctx, func(sess *sqlstore.DBSession) error {
		// Delete user role assignments
		if _, err := sess.Exec("DELETE FROM user_role WHERE user_id = ?", userID); err != nil {
			return err
		}

		// Delete permissions that are scoped to user
		if _, err := sess.Exec("DELETE FROM permission WHERE scope = ?", accesscontrol.Scope("users", "id", strconv.FormatInt(userID, 10))); err != nil {
			return err
		}

		var roleIDs []int64
		if err := sess.SQL("SELECT id FROM role WHERE name = ?", accesscontrol.ManagedUserRoleName(userID)).Find(&roleIDs); err != nil {
			return err
		}

		if len(roleIDs) == 0 {
			return nil
		}

		query := "DELETE FROM permission WHERE role_id IN(? " + strings.Repeat(",?", len(roleIDs)-1) + ")"
		args := make([]interface{}, 0, len(roleIDs)+1)
		args = append(args, query)
		for _, id := range roleIDs {
			args = append(args, id)
		}

		// Delete managed user permissions
		if _, err := sess.Exec(args...); err != nil {
			return err
		}

		// Delete managed user roles
		if _, err := sess.Exec("DELETE FROM role WHERE name = ?", accesscontrol.ManagedUserRoleName(userID)); err != nil {
			return err
		}

		return nil
	})
	return err
}
