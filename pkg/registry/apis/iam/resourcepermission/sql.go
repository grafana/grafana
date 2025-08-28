package resourcepermission

import (
	"context"
	"fmt"

	v0alpha1 "github.com/grafana/grafana/apps/iam/pkg/apis/iam/v0alpha1"
	"github.com/grafana/grafana/pkg/registry/apis/iam/common"
	"github.com/grafana/grafana/pkg/storage/legacysql"
)

// GET
func (s *ResourcePermSqlBackend) getResourcePermissions(ctx context.Context, sql *legacysql.LegacyDatabaseHelper, query *ListResourcePermissionsQuery) (map[string][]flatResourcePermission, error) {
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
			&perm.ID, &perm.Action, &perm.Scope, &perm.Created, &perm.Updated, &perm.RoleName,
			&perm.SubjectUID, &perm.SubjectType, &perm.IsServiceAccount, &perm.SubjectName,
		); err != nil {
			return nil, fmt.Errorf("scanning resource permission: %w", err)
		}

		key := fmt.Sprintf("%s:%s", perm.SubjectType, perm.SubjectUID)

		permissions[key] = append(permissions[key], perm)
	}

	return permissions, nil
}

func (s *ResourcePermSqlBackend) getResourcePermission(ctx context.Context, sql *legacysql.LegacyDatabaseHelper, name string) (*v0alpha1.ResourcePermission, error) {
	resourceQuery := &ListResourcePermissionsQuery{
		ResourceUID:       name,
		OrgID:             1,
		ManagedRolePrefix: "managed:%",
		Pagination: common.Pagination{
			Limit:    1000,
			Continue: 0,
		},
	}

	permissionGroups, err := s.getResourcePermissions(ctx, sql, resourceQuery)
	if err != nil {
		return nil, err
	}

	if len(permissionGroups) == 0 {
		return nil, fmt.Errorf("resource permission %q not found", name)
	}

	resourcePermission := toV0ResourcePermissionByResource(permissionGroups, name)
	if resourcePermission == nil {
		return nil, fmt.Errorf("resource permission %q not found", name)
	}

	return resourcePermission, nil
}

//LIST

//CREATE

//UPDATE

//DELETE
