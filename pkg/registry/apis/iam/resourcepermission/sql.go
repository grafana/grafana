package resourcepermission

import (
	"context"
	"fmt"
	"sort"
	"strings"

	"github.com/grafana/grafana/pkg/registry/apis/iam/common"
	"github.com/grafana/grafana/pkg/storage/legacysql"

	"github.com/grafana/grafana/apps/iam/pkg/apis/iam/v0alpha1"
)

func (s *ResourcePermissionSqlBackend) getResourcePermissions(ctx context.Context, sql *legacysql.LegacyDatabaseHelper, query *ListResourcePermissionsQuery) (map[string][]flatResourcePermission, error) {
	rawQuery, args, err := buildListResourcePermissionsQuery(sql, query)
	if err != nil {
		return nil, err
	}

	rows, err := sql.DB.GetSqlxSession().Query(ctx, rawQuery, args...)
	if err != nil {
		if rows != nil {
			_ = rows.Close()
		}
		return nil, fmt.Errorf("querying resource permissions: %w", err)
	}
	defer func() {
		_ = rows.Close()
	}()

	permissions := make(map[string][]flatResourcePermission)
	for rows.Next() {
		var perm flatResourcePermission
		if err := rows.Scan(
			&perm.ID, &perm.Action, &perm.Scope, &perm.Created, &perm.Updated,
			&perm.RoleName, &perm.RoleUID, &perm.OrgID,
			&perm.UserID, &perm.UserOrgID,
			&perm.UserUID, &perm.UserLogin, &perm.UserName, &perm.UserEmail,
			&perm.IsServiceAccount,
			&perm.TeamID,
			&perm.TeamUID, &perm.TeamName,
			&perm.BuiltInOrgID, &perm.BuiltInRole,
		); err != nil {
			return nil, fmt.Errorf("scanning resource permission: %w", err)
		}

		// Create a grouping key based on the assignee (user, team, or builtin role)
		var key string
		if perm.UserID != 0 {
			key = fmt.Sprintf("user:%s", perm.UserUID)
		} else if perm.TeamID != 0 {
			key = fmt.Sprintf("team:%s", perm.TeamUID)
		} else if perm.BuiltInRole != "" {
			key = fmt.Sprintf("builtin:%s", perm.BuiltInRole)
		} else {
			key = fmt.Sprintf("unknown:%d", perm.ID)
		}

		permissions[key] = append(permissions[key], perm)
	}

	return permissions, nil
}

func (s *ResourcePermissionSqlBackend) newResourcePermissionIterator(ctx context.Context, sql *legacysql.LegacyDatabaseHelper, query *ListResourcePermissionsQuery) (*listIterator, error) {
	permissionGroups, err := s.getResourcePermissions(ctx, sql, query)
	if err != nil {
		return nil, err
	}

	// Convert map keys to sorted slice for consistent iteration
	keys := make([]string, 0, len(permissionGroups))
	for key := range permissionGroups {
		keys = append(keys, key)
	}
	sort.Strings(keys)

	return &listIterator{
		permissionGroups: permissionGroups,
		keys:             keys,
		currentKeyIndex:  0,
	}, nil
}

func (s *ResourcePermissionSqlBackend) getResourcePermission(ctx context.Context, sql *legacysql.LegacyDatabaseHelper, name string) (*v0alpha1.ResourcePermission, error) {
	query := &ListResourcePermissionsQuery{
		UID: name,
		Pagination: common.Pagination{
			Limit:    100, // Get enough permissions for this specific resource
			Continue: 0,   // No continuation token
		},
	}

	permissionGroups, err := s.getResourcePermissions(ctx, sql, query)
	if err != nil {
		return nil, err
	}

	// Find the specific permission group by name
	for key, perms := range permissionGroups {
		if key == name || (len(perms) > 0 && (perms[0].UserUID == name || perms[0].TeamUID == name || perms[0].BuiltInRole == name)) {
			resourcePermission := toV0ResourcePermission(perms)
			if resourcePermission == nil {
				return nil, fmt.Errorf("resource permission %q not found", name)
			}
			return resourcePermission, nil
		}
	}

	return nil, fmt.Errorf("resource permission %q not found", name)
}

func buildListResourcePermissionsQuery(sql *legacysql.LegacyDatabaseHelper, query *ListResourcePermissionsQuery) (string, []interface{}, error) {
	baseQuery := `
	SELECT 
		p.id, p.action, p.scope, p.created, p.updated,
		r.name as role_name, r.uid as role_uid, r.org_id,
		ur.user_id, ur.org_id as user_org_id,
		u.uid as user_uid, u.login as user_login, u.name as user_name, u.email as user_email,
		COALESCE(u.is_service_account, 0) as is_service_account,
		tr.team_id, 
		t.uid as team_uid, t.name as team_name,
		br.org_id as builtin_org_id, br.role as builtin_role
	FROM permission p
	INNER JOIN role r ON p.role_id = r.id
	LEFT JOIN user_role ur ON r.id = ur.role_id AND ur.org_id = r.org_id
	LEFT JOIN ` + sql.DB.GetDialect().Quote("user") + ` u ON ur.user_id = u.id
	LEFT JOIN team_role tr ON r.id = tr.role_id AND tr.org_id = r.org_id  
	LEFT JOIN team t ON tr.team_id = t.id
	LEFT JOIN builtin_role br ON r.id = br.role_id AND br.org_id = r.org_id
	WHERE (ur.user_id IS NOT NULL OR tr.team_id IS NOT NULL OR br.role IS NOT NULL)
	`

	args := []interface{}{}
	conditions := []string{}

	// Add filters
	if query.UID != "" {
		conditions = append(conditions, "(u.uid = ? OR t.uid = ? OR br.role = ?)")
		args = append(args, query.UID, query.UID, query.UID)
	}

	// Combine conditions
	if len(conditions) > 0 {
		baseQuery += " AND " + strings.Join(conditions, " AND ")
	}

	// Add ordering and pagination
	baseQuery += " ORDER BY p.id"

	if query.Pagination.Limit > 0 {
		baseQuery += " LIMIT ?"
		args = append(args, query.Pagination.Limit)
	}

	if query.Pagination.Continue > 0 {
		baseQuery += " OFFSET ?"
		args = append(args, query.Pagination.Continue)
	}

	return baseQuery, args, nil
}
