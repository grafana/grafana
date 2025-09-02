package resourcepermission

import (
	"context"
	"fmt"
	"strings"

	v0alpha1 "github.com/grafana/grafana/apps/iam/pkg/apis/iam/v0alpha1"
	"github.com/grafana/grafana/pkg/storage/legacysql"
)

// List

// Get
func (s *ResourcePermSqlBackend) getResourcePermissions(ctx context.Context, sql *legacysql.LegacyDatabaseHelper, query *ListResourcePermissionsQuery) (map[groupResourceName][]flatResourcePermission, error) {
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

	permissions := make(map[groupResourceName][]flatResourcePermission)
	for rows.Next() {
		var perm flatResourcePermission
		if err := rows.Scan(
			&perm.ID, &perm.Action, &perm.Scope, &perm.Created, &perm.Updated, &perm.RoleName,
			&perm.SubjectUID, &perm.SubjectType, &perm.IsServiceAccount,
		); err != nil {
			return nil, fmt.Errorf("scanning resource permission: %w", err)
		}

		scopeParts := strings.SplitN(perm.Scope, ":", 3)
		if len(scopeParts) != 3 {
			s.logger.Warn("invalid scope format", "scope", perm.Scope)
			continue // skip invalid scope
		}
		gr, ok := s.reverseMapper[scopeParts[0]]
		if !ok {
			s.logger.Warn("unknown scope prefix", "scope", perm.Scope)
			continue // skip unknown scope prefix
		}
		key := groupResourceName{
			Group:    gr.Group,
			Resource: gr.Resource,
			Name:     scopeParts[2],
		}

		permissions[key] = append(permissions[key], perm)
	}

	return permissions, nil
}

func (s *ResourcePermSqlBackend) getResourcePermission(ctx context.Context, sql *legacysql.LegacyDatabaseHelper, name string) (*v0alpha1.ResourcePermission, error) {
	// e.g. dashboard.grafana.app-dashboards-ad5rwqs
	parts := strings.SplitN(name, "-", 3)

	if len(parts) != 3 {
		return nil, fmt.Errorf("invalid resource name: %s", name)
	}

	group, resourceType, uid := parts[0], parts[1], parts[2]
	mapper, ok := s.getMapper(group, resourceType)
	if !ok {
		return nil, fmt.Errorf("%w: %s/%s", errUnknownGroupResource, group, resourceType)
	}

	resourceQuery := &ListResourcePermissionsQuery{
		Scope:      mapper.Scope(uid),
		OrgID:      1,
		ActionSets: mapper.ActionSets(),
	}

	permsByResource, err := s.getResourcePermissions(ctx, sql, resourceQuery)
	if err != nil {
		return nil, err
	}

	if len(permsByResource) == 0 {
		return nil, fmt.Errorf("resource permission %q not found", resourceQuery.Scope)
	}

	resourcePermission, err := s.toV0ResourcePermissions(permsByResource)
	if err != nil {
		return nil, err
	}
	if resourcePermission == nil {
		return nil, fmt.Errorf("resource permission %q: %w", resourceQuery.Scope, errNotFound)
	}

	return &resourcePermission[0], nil
}

// Create

// Update

// Delete
