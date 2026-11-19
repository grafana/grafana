package legacypermissions

import (
	"context"
	"strings"

	"go.opentelemetry.io/otel/attribute"

	"github.com/grafana/grafana/pkg/infra/db"
	ac "github.com/grafana/grafana/pkg/services/accesscontrol"
)

// permissionStore owns embedded legacy enumeration reads. It deliberately does not
// accept an Access Control service or store: those still own mutations, not loading.
type permissionStore struct{ sql db.DB }

func (s permissionStore) permissions(ctx context.Context, query ac.GetUserPermissionsQuery) ([]ac.Permission, error) {
	return s.permissionsForActions(ctx, query, nil)
}

func (s permissionStore) permissionsForActions(
	ctx context.Context,
	query ac.GetUserPermissionsQuery,
	actions []string,
) (_ []ac.Permission, err error) {
	ctx, span := tracer.Start(ctx, "authz.legacypermissions.sql.permissions")
	attempts := 0
	defer func() {
		span.SetAttributes(attribute.Int("query.count", attempts))
		endPermissionSpan(span, err)
	}()
	if query.UserID == 0 && len(query.TeamIDs) == 0 && len(query.Roles) == 0 {
		return []ac.Permission{}, nil
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
	if len(actions) > 0 {
		q += " AND permission.action IN (?" + strings.Repeat(", ?", len(actions)-1) + ")"
		for _, action := range actions {
			params = append(params, action)
		}
	}
	var out []ac.Permission
	// Keep transaction-bound sessions and SQLite retry behavior from the legacy path.
	err = s.sql.WithDbSession(ctx, func(sess *db.Session) (err error) {
		attempts++
		rows, err := sess.QueryRows(q, params...)
		if err != nil {
			return err
		}
		_, scanSpan := tracer.Start(ctx, "authz.legacypermissions.sql.scan")
		defer func() {
			scanSpan.SetAttributes(attribute.Int("result_count", len(out)))
			endPermissionSpan(scanSpan, err)
		}()
		defer func() { _ = rows.Close() }()
		out = make([]ac.Permission, 0, 512)
		var action, scope string
		for rows.Next() {
			if err := rows.Scan(&action, &scope); err != nil {
				return err
			}
			out = append(out, ac.Permission{Action: action, Scope: scope})
		}
		return rows.Err()
	})
	if err != nil {
		return nil, err
	}
	return out, nil
}

func (s permissionStore) teams(ctx context.Context, query ac.GetUserPermissionsQuery) (_ map[int64][]ac.Permission, err error) {
	ctx, span := tracer.Start(ctx, "authz.legacypermissions.sql.teams")
	attempts := 0
	defer func() {
		span.SetAttributes(attribute.Int("query.count", attempts))
		endPermissionSpan(span, err)
	}()
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
	err = s.sql.WithDbSession(ctx, func(sess *db.Session) (err error) {
		attempts++
		rows, err := sess.QueryRows(q, params...)
		if err != nil {
			return err
		}
		_, scanSpan := tracer.Start(ctx, "authz.legacypermissions.sql.scan")
		rowCount := 0
		defer func() {
			scanSpan.SetAttributes(attribute.Int("result_count", rowCount), attribute.Int("team.count", len(out)))
			endPermissionSpan(scanSpan, err)
		}()
		defer func() { _ = rows.Close() }()
		out = make(map[int64][]ac.Permission)
		var action, scope string
		var teamID int64
		for rows.Next() {
			if err := rows.Scan(&action, &scope, &teamID); err != nil {
				return err
			}
			if _, ok := out[teamID]; !ok {
				out[teamID] = make([]ac.Permission, 0, 32)
			}
			out[teamID] = append(out[teamID], ac.Permission{Action: action, Scope: scope})
			rowCount++
		}
		return rows.Err()
	})
	if err != nil {
		return nil, err
	}
	return out, nil
}
