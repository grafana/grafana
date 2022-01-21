package database

import (
	"context"
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

func (s *AccessControlStore) GetUserPermissions(ctx context.Context, query accesscontrol.GetUserPermissionsQuery) ([]*accesscontrol.Permission, error) {
	result := make([]*accesscontrol.Permission, 0)
	err := s.sql.WithDbSession(ctx, func(sess *sqlstore.DBSession) error {
		filter, params := userRolesFilter(query.OrgID, query.UserID, query.Roles)

		// TODO: optimize this
		q := `SELECT
			permission.id,
			permission.role_id,
			permission.action,
			permission.scope,
			permission.updated,
			permission.created
			FROM permission
			INNER JOIN role ON role.id = permission.role_id
		` + filter

		if err := sess.SQL(q, params...).Find(&result); err != nil {
			return err
		}

		return nil
	})

	return result, err
}

func userRolesFilter(orgID, userID int64, roles []string) (string, []interface{}) {
	q := `
	WHERE role.id IN (
		SELECT ur.role_id
		FROM user_role AS ur
		WHERE ur.user_id = ?
		AND (ur.org_id = ? OR ur.org_id = ?)
		UNION
		SELECT tr.role_id FROM team_role as tr
		INNER JOIN team_member as tm ON tm.team_id = tr.team_id
		WHERE tm.user_id = ? AND tr.org_id = ?
	`
	params := []interface{}{userID, orgID, globalOrgID, userID, orgID}

	if len(roles) != 0 {
		q += `
			UNION
			SELECT br.role_id FROM builtin_role AS br
			WHERE role IN (? ` + strings.Repeat(", ?", len(roles)-1) + `)
		`
		for _, role := range roles {
			params = append(params, role)
		}

		q += `AND (br.org_id = ? OR br.org_id = ?)`
		params = append(params, orgID, globalOrgID)
	}

	q += `)`

	return q, params
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
