package resourcepermission

import (
	"context"
	"fmt"
	"strings"

	v0alpha1 "github.com/grafana/grafana/apps/iam/pkg/apis/iam/v0alpha1"
	"github.com/grafana/grafana/pkg/registry/apis/iam/common"
	"github.com/grafana/grafana/pkg/storage/legacysql"
)

// List
func (s *ResourcePermSqlBackend) listResourcePermissions(ctx context.Context, sql *legacysql.LegacyDatabaseHelper, query *ListResourcePermissionsQuery) ([]*v0alpha1.ResourcePermission, error) {
	distinctResources, err := s.getDistinctResources(ctx, sql, query)
	if err != nil {
		return nil, err
	}

	var permissions []*v0alpha1.ResourcePermission
	for _, resource := range distinctResources {
		resourceQuery := &ListResourcePermissionsQuery{
			Scope:      resource.Scope,
			OrgID:      query.OrgID,
			ActionSets: query.ActionSets,
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
			continue
		}

		var name string
		parts := strings.Split(resource.Scope, ":")
		if len(parts) >= 3 {
			resourceType := parts[0]
			uid := parts[2]
			apiGroup := getApiGroupForResource(resourceType)
			name = fmt.Sprintf("%s-%s-%s", apiGroup, resourceType, uid)
		}

		resourcePermission := toV0ResourcePermission(permissionGroups, name)
		if resourcePermission != nil {
			permissions = append(permissions, resourcePermission)
		}
	}

	return permissions, nil
}

// getDistinctResources gets all distinct resources (scopes) that have permissions
func (s *ResourcePermSqlBackend) getDistinctResources(ctx context.Context, sql *legacysql.LegacyDatabaseHelper, query *ListResourcePermissionsQuery) ([]distinctResource, error) {
	rawQuery, args, err := buildListResourcesQueryFromTemplate(sql, query)
	if err != nil {
		return nil, err
	}

	rows, err := sql.DB.GetSqlxSession().Query(ctx, rawQuery, args...)
	if err != nil {
		if rows != nil {
			_ = rows.Close()
		}
		return nil, fmt.Errorf("querying distinct resources: %w", err)
	}
	defer func() {
		_ = rows.Close()
	}()

	var resources []distinctResource
	for rows.Next() {
		var resource distinctResource
		if err := rows.Scan(&resource.Scope, &resource.Created); err != nil {
			return nil, fmt.Errorf("scanning distinct resource: %w", err)
		}
		resources = append(resources, resource)
	}

	return resources, nil
}

// Get
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
			&perm.SubjectUID, &perm.SubjectType, &perm.IsServiceAccount,
		); err != nil {
			return nil, fmt.Errorf("scanning resource permission: %w", err)
		}

		key := fmt.Sprintf("%s:%s", perm.SubjectType, perm.SubjectUID)

		permissions[key] = append(permissions[key], perm)
	}

	return permissions, nil
}

func (s *ResourcePermSqlBackend) getResourcePermission(ctx context.Context, sql *legacysql.LegacyDatabaseHelper, name string) (*v0alpha1.ResourcePermission, error) {
	//dashboard.grafana.app-dashboards-ad5rwqs
	parts := strings.Split(name, "-")

	if len(parts) != 3 {
		return nil, fmt.Errorf("invalid resource name: %s", name)
	}

	resourceType, uid := parts[1], parts[2]
	scope := resourceType + ":uid:" + uid
	actionSets := []string{resourceType + ":admin", resourceType + ":edit", resourceType + ":view"}
	resourceQuery := &ListResourcePermissionsQuery{
		Scope:      scope,
		OrgID:      1,
		ActionSets: actionSets,
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
		return nil, fmt.Errorf("resource permission %q not found", scope)
	}

	resourcePermission := toV0ResourcePermission(permissionGroups, name)
	if resourcePermission == nil {
		return nil, fmt.Errorf("resource permission %q not found", scope)
	}

	return resourcePermission, nil
}

// Create

// Update

// Delete
