package resourcepermission

import (
	"context"
	"fmt"
	"sort"

	"github.com/grafana/grafana/pkg/registry/apis/iam/common"
	"github.com/grafana/grafana/pkg/storage/legacysql"

	v0alpha1 "github.com/grafana/grafana/apps/iam/pkg/apis/iam/v0alpha1"
)

func (s *ResourcePermissionSqlBackend) getResourcePermissions(ctx context.Context, sql *legacysql.LegacyDatabaseHelper, query *ListResourcePermissionsQuery) (map[string][]flatResourcePermission, error) {
	rawQuery, args, err := buildListResourcePermissionsQueryFromTemplate(sql, query)
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
			&perm.SubjectUID, &perm.SubjectType, &perm.IsServiceAccount,
		); err != nil {
			return nil, fmt.Errorf("scanning resource permission: %w", err)
		}

		// Create a grouping key based on the subject type and UID
		key := fmt.Sprintf("%s:%s", perm.SubjectType, perm.SubjectUID)

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
		if key == name || (len(perms) > 0 && perms[0].SubjectUID == name) {
			resourcePermission := toV0ResourcePermission(perms)
			if resourcePermission == nil {
				return nil, fmt.Errorf("resource permission %q not found", name)
			}
			return resourcePermission, nil
		}
	}

	return nil, fmt.Errorf("resource permission %q not found", name)
}
