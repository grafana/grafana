package legacypermissions

import (
	"context"
	"database/sql"
	"fmt"

	ac "github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/storage/legacysql"
	"github.com/grafana/grafana/pkg/storage/unified/sql/sqltemplate"
)

// Resolve the database for each read: this store is shared across tenants.
// The handler must authorize the namespace before it reaches this adapter.
type remotePermissionStore struct {
	database legacysql.LegacyDatabaseProvider
}

var _ permissionReader = remotePermissionStore{}

func (s remotePermissionStore) permissions(ctx context.Context, query ac.GetUserPermissionsQuery) ([]ac.Permission, error) {
	return s.permissionsForActions(ctx, query, nil)
}

func (s remotePermissionStore) permissionsForActions(ctx context.Context, query ac.GetUserPermissionsQuery, actions []string) ([]ac.Permission, error) {
	if query.UserID <= 0 && len(query.TeamIDs) == 0 && len(query.Roles) == 0 {
		return []ac.Permission{}, nil
	}
	rows, err := s.query(ctx, "legacy_permissions_query.sql", query, actions)
	if err != nil {
		return nil, err
	}
	defer func() { _ = rows.Close() }()

	permissions := make([]ac.Permission, 0, 512)
	for rows.Next() {
		var permission ac.Permission
		if err := rows.Scan(&permission.Action, &permission.Scope); err != nil {
			return nil, err
		}
		permissions = append(permissions, permission)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return permissions, nil
}

func (s remotePermissionStore) teams(ctx context.Context, query ac.GetUserPermissionsQuery) (map[int64][]ac.Permission, error) {
	if len(query.TeamIDs) == 0 {
		return nil, nil
	}
	rows, err := s.query(ctx, "legacy_team_permissions_query.sql", query, nil)
	if err != nil {
		return nil, err
	}
	defer func() { _ = rows.Close() }()

	permissions := make(map[int64][]ac.Permission)
	for rows.Next() {
		var permission ac.Permission
		var teamID int64
		if err := rows.Scan(&permission.Action, &permission.Scope, &teamID); err != nil {
			return nil, err
		}
		permissions[teamID] = append(permissions[teamID], permission)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return permissions, nil
}

func (s remotePermissionStore) query(ctx context.Context, name string, query ac.GetUserPermissionsQuery, actions []string) (*sql.Rows, error) {
	helper, err := s.database(ctx)
	if err != nil {
		return nil, fmt.Errorf("resolve legacy permission database: %w", err)
	}
	if helper == nil || helper.DB == nil || helper.Table == nil || helper.DialectForDriver() == nil {
		return nil, fmt.Errorf("invalid legacy permission database helper")
	}
	req := newRemotePermissionQuery(helper, query, actions)
	statement, err := sqltemplate.Execute(remoteQueries.Lookup(name), req)
	if err != nil {
		return nil, fmt.Errorf("render legacy permission query: %w", err)
	}
	return helper.DB.GetSqlxSession().Query(ctx, statement, req.GetArgs()...)
}
