package legacypermissions

import (
	"context"
	"strings"

	"github.com/grafana/grafana/pkg/infra/db"
	ac "github.com/grafana/grafana/pkg/services/accesscontrol"
)

// permissionStore owns embedded legacy enumeration reads. It deliberately does not
// accept an Access Control service or store: those still own mutations, not loading.
type permissionStore struct{ sql db.DB }

func (s permissionStore) permissions(ctx context.Context, query ac.GetUserPermissionsQuery) ([]ac.Permission, error) {
	if query.UserID == 0 && len(query.TeamIDs) == 0 && len(query.Roles) == 0 {
		return nil, nil
	}
	filter, params := ac.UserRolesFilter(query.OrgID, query.UserID, query.TeamIDs, query.Roles, s.sql.GetDialect())
	q := `SELECT permission.action, permission.scope FROM permission
	INNER JOIN role ON role.id = permission.role_id ` + filter
	if len(query.RolePrefixes) > 0 {
		filter, args := ac.RolePrefixesFilter(query.RolePrefixes)
		q += filter
		params = append(params, args...)
	}
	if query.ExcludeRedundantManagedPermissions {
		q += ac.ManagedPermissionsActionSetsFilter()
	}
	var out []ac.Permission
	// Keep transaction-bound sessions and SQLite retry behavior from the legacy path.
	err := s.sql.WithDbSession(ctx, func(sess *db.Session) error {
		rows, err := sess.QueryRows(q, params...)
		if err != nil {
			return err
		}
		defer func() { _ = rows.Close() }()
		out = make([]ac.Permission, 0, 512)
		for rows.Next() {
			var p ac.Permission
			if err := rows.Scan(&p.Action, &p.Scope); err != nil {
				return err
			}
			out = append(out, p)
		}
		return rows.Err()
	})
	if err != nil {
		return nil, err
	}
	return out, nil
}

func (s permissionStore) teams(ctx context.Context, query ac.GetUserPermissionsQuery) (map[int64][]ac.Permission, error) {
	if len(query.TeamIDs) == 0 {
		return nil, nil
	}
	q := `SELECT permission.action, permission.scope, all_role.team_id
	FROM permission INNER JOIN role ON role.id = permission.role_id
	INNER JOIN (SELECT tr.role_id, tr.team_id FROM team_role AS tr
	WHERE tr.team_id IN (?` + strings.Repeat(", ?", len(query.TeamIDs)-1) + `) AND tr.org_id = ?)
	AS all_role ON role.id = all_role.role_id `
	params := make([]any, 0, len(query.TeamIDs)+1)
	for _, team := range query.TeamIDs {
		params = append(params, team)
	}
	params = append(params, query.OrgID)
	if len(query.RolePrefixes) > 0 {
		filter, args := ac.RolePrefixesFilter(query.RolePrefixes)
		q += filter
		params = append(params, args...)
	}
	if query.ExcludeRedundantManagedPermissions {
		q += ac.ManagedPermissionsActionSetsFilter()
	}
	var out map[int64][]ac.Permission
	err := s.sql.WithDbSession(ctx, func(sess *db.Session) error {
		rows, err := sess.QueryRows(q, params...)
		if err != nil {
			return err
		}
		defer func() { _ = rows.Close() }()
		out = make(map[int64][]ac.Permission)
		for rows.Next() {
			var p ac.Permission
			var teamID int64
			if err := rows.Scan(&p.Action, &p.Scope, &teamID); err != nil {
				return err
			}
			out[teamID] = append(out[teamID], p)
		}
		return rows.Err()
	})
	if err != nil {
		return nil, err
	}
	return out, nil
}
