package resourcepermission

import (
	"context"
	"fmt"
	"strings"

	"github.com/grafana/authlib/types"
	v0alpha1 "github.com/grafana/grafana/apps/iam/pkg/apis/iam/v0alpha1"
	"github.com/grafana/grafana/pkg/storage/legacysql"
	"k8s.io/apimachinery/pkg/runtime/schema"
)

// List

// Get
// getResourcePermissions queries resource permissions based on the provided ListResourcePermissionsQuery and groups them by resource (e.g. {folder.grafana.app, folders, fold1})
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

		key, err := s.parseScope(perm.Scope)
		if err != nil {
			s.logger.Warn("skipping", "scope", perm.Scope, "err", err)
			continue
		}

		permissions[*key] = append(permissions[*key], perm)
	}

	return permissions, nil
}

// getResourcePermission retrieves a single ResourcePermission by its name in the format <group>.<resource>.<name> (e.g. dashboard.grafana.app-dashboards-ad5rwqs)
func (s *ResourcePermSqlBackend) getResourcePermission(ctx context.Context, sql *legacysql.LegacyDatabaseHelper, ns types.NamespaceInfo, name string) (*v0alpha1.ResourcePermission, error) {
	// e.g. dashboard.grafana.app-dashboards-ad5rwqs
	parts := strings.SplitN(name, "-", 3)
	if len(parts) != 3 {
		return nil, fmt.Errorf("%w: %s", errInvalidName, name)
	}

	group, resourceType, uid := parts[0], parts[1], parts[2]
	mapper, ok := s.mappers[schema.GroupResource{Group: group, Resource: resourceType}]
	if !ok {
		return nil, fmt.Errorf("%w: %s/%s", errUnknownGroupResource, group, resourceType)
	}

	resourceQuery := &ListResourcePermissionsQuery{
		Scope:      mapper.Scope(uid),
		OrgID:      ns.OrgID,
		ActionSets: mapper.ActionSets(),
	}

	permsByResource, err := s.getResourcePermissions(ctx, sql, resourceQuery)
	if err != nil {
		return nil, err
	}

	if len(permsByResource) == 0 {
		return nil, fmt.Errorf("resource permission %q: %w", resourceQuery.Scope, errNotFound)
	}

	resourcePermission, err := toV0ResourcePermissions(permsByResource)
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
