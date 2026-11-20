package legacypermissions

import (
	"context"
	"fmt"

	"go.opentelemetry.io/otel/attribute"

	"github.com/grafana/grafana/pkg/infra/db"
	ac "github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/storage/legacysql"
	"github.com/grafana/grafana/pkg/storage/unified/sql/sqltemplate"
)

// Resolve the provider for each operation so one store can serve multiple tenants.
// Callers must authorize the namespace before it reaches the provider.
type permissionStore struct {
	database legacysql.LegacyDatabaseProvider
}

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
	helper, q, params, err := s.query(ctx, "legacy_permissions_query.sql", query, actions)
	if err != nil {
		return nil, err
	}
	var out []ac.Permission
	// Keep transaction-bound sessions and SQLite retry behavior from the legacy path.
	err = helper.DB.WithDbSession(ctx, func(sess *db.Session) (err error) {
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

func (s permissionStore) query(ctx context.Context, name string, query ac.GetUserPermissionsQuery, actions []string) (*legacysql.LegacyDatabaseHelper, string, []any, error) {
	helper, err := s.database(ctx)
	if err != nil {
		return nil, "", nil, fmt.Errorf("resolve legacy permission database: %w", err)
	}
	if helper == nil || helper.DB == nil || helper.Table == nil || helper.DialectForDriver() == nil {
		return nil, "", nil, fmt.Errorf("invalid legacy permission database helper")
	}
	req := newPermissionQuery(helper, query, actions)
	statement, err := sqltemplate.Execute(permissionQueries.Lookup(name), req)
	if err != nil {
		return nil, "", nil, fmt.Errorf("render legacy permission query: %w", err)
	}
	return helper, statement, req.GetArgs(), nil
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
	helper, q, params, err := s.query(ctx, "legacy_team_permissions_query.sql", query, nil)
	if err != nil {
		return nil, err
	}
	var out map[int64][]ac.Permission
	err = helper.DB.WithDbSession(ctx, func(sess *db.Session) (err error) {
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
