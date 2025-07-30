package resourcepermission

import (
	"context"
	"fmt"
	"sort"
	"time"

	"github.com/grafana/authlib/types"
	"github.com/grafana/grafana/pkg/registry/apis/iam/common"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/sqlstore/session"
	"github.com/grafana/grafana/pkg/storage/legacysql"
	"github.com/grafana/grafana/pkg/util"

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

func (s *ResourcePermissionSqlBackend) createResourcePermission(ctx context.Context, dbHelper *legacysql.LegacyDatabaseHelper, ns types.NamespaceInfo, v0ResourcePerm *v0alpha1.ResourcePermission) (int64, error) {
	if v0ResourcePerm == nil {
		return 0, fmt.Errorf("resource permission cannot be nil")
	}

	if v0ResourcePerm.Name == "" {
		if v0ResourcePerm.GenerateName == "" {
			return 0, ErrEmptyResourcePermissionName
		}
		rand, err := util.GetRandomString(10)
		if err != nil {
			return 0, fmt.Errorf("generating random string for resource permission name: %w", err)
		}
		v0ResourcePerm.Name = v0ResourcePerm.GenerateName + rand
	}

	if len(v0ResourcePerm.Spec.Permissions) == 0 {
		return 0, fmt.Errorf("resource permission must have at least one permission: %w", ErrInvalidResourcePermissionSpec)
	}

	// For now, implement a simplified version that creates permissions
	// TODO: Implement full managed role pattern like the existing store
	err := dbHelper.DB.GetSqlxSession().WithTransaction(ctx, func(tx *session.SessionTx) error {
		for _, perm := range v0ResourcePerm.Spec.Permissions {
			// Create a basic role for this permission (simplified approach)
			// In a full implementation, this would use the managed role pattern
			timestamp := time.Now().UnixMilli()
			roleName := fmt.Sprintf("resource-perm-%s-%s-%d", v0ResourcePerm.Name, perm.Name, timestamp)

			// Create role
			roleID, err := s.createBasicRole(ctx, tx, dbHelper, ns.OrgID, roleName)
			if err != nil {
				return fmt.Errorf("creating role for permission: %w", err)
			}

			// Create permissions for this role
			permissions := s.createPermissionsForRole(v0ResourcePerm, perm)
			if len(permissions) > 0 {
				permissionInsert, permissionInsertArgs, err := buildResourcePermissionInsertQuery(dbHelper, permissions, roleID)
				if err != nil {
					return err
				}

				_, err = tx.Exec(ctx, permissionInsert, permissionInsertArgs...)
				if err != nil {
					return fmt.Errorf("inserting permissions for role %d: %w", roleID, err)
				}
			}

			// Assign the role to the appropriate subject (user/team/built-in role)
			err = s.assignRoleToSubject(ctx, tx, dbHelper, roleID, ns.OrgID, perm)
			if err != nil {
				return fmt.Errorf("assigning role %d to subject: %w", roleID, err)
			}
		}

		return nil
	})

	if err != nil {
		return 0, err
	}

	// Return a timestamp as resource version
	return int64(time.Now().UnixMilli()), nil
}

// createBasicRole creates a basic role for the resource permission
func (s *ResourcePermissionSqlBackend) createBasicRole(ctx context.Context, tx *session.SessionTx, dbHelper *legacysql.LegacyDatabaseHelper, orgID int64, roleName string) (int64, error) {
	// Create a basic role
	now := time.Now()
	roleUID, err := util.GetRandomString(40)
	if err != nil {
		return 0, fmt.Errorf("generating role UID: %w", err)
	}

	roleInsert := fmt.Sprintf(`
		INSERT INTO %s (name, uid, description, version, org_id, created, updated, display_name, group_name, hidden)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
	`, dbHelper.Table("role"))

	result, err := tx.Exec(ctx, roleInsert,
		roleName, roleUID, "Auto-generated role for resource permission", 1, orgID,
		now, now, roleName, "auto", false)
	if err != nil {
		return 0, fmt.Errorf("inserting role: %w", err)
	}

	roleID, err := result.LastInsertId()
	if err != nil {
		return 0, fmt.Errorf("getting role ID: %w", err)
	}

	return roleID, nil
}

// createPermissionsForRole creates Permission objects for the given role
func (s *ResourcePermissionSqlBackend) createPermissionsForRole(v0ResourcePerm *v0alpha1.ResourcePermission, perm v0alpha1.ResourcePermissionspecPermission) []accesscontrol.Permission {
	var permissions []accesscontrol.Permission

	// Extract resource info from spec
	resource := v0ResourcePerm.Spec.Resource.Resource
	resourceUID := v0ResourcePerm.Spec.Resource.Name
	if resourceUID == "" {
		resourceUID = "*" // wildcard if no specific resource name
	}

	for _, verb := range perm.Verbs {
		// Create scope in the format expected by Grafana (e.g., "dashboards:uid:abc123")
		scope := fmt.Sprintf("%s:uid:%s", resource, resourceUID)
		if resourceUID == "*" {
			scope = fmt.Sprintf("%s:*", resource)
		}

		permission := accesscontrol.Permission{
			Action: verb,
			Scope:  scope,
		}

		// Set the kind, attribute, identifier fields
		permission.Kind, permission.Attribute, permission.Identifier = permission.SplitScope()

		permissions = append(permissions, permission)
	}

	return permissions
}

// assignRoleToSubject assigns the created role to the appropriate subject (user/team/built-in role)
func (s *ResourcePermissionSqlBackend) assignRoleToSubject(ctx context.Context, tx *session.SessionTx, dbHelper *legacysql.LegacyDatabaseHelper, roleID int64, orgID int64, perm v0alpha1.ResourcePermissionspecPermission) error {
	now := time.Now()

	switch perm.Kind {
	case v0alpha1.ResourcePermissionSpecPermissionKindUser:
		// For simplicity, we'll create a placeholder user assignment
		// In a real implementation, you'd look up the actual user ID by UID
		userAssignSQL := fmt.Sprintf(`
			INSERT INTO %s (org_id, user_id, role_id, created)
			VALUES (?, ?, ?, ?)
		`, dbHelper.Table("user_role"))

		// Use a placeholder user ID (in real implementation, look up by perm.Name)
		_, err := tx.Exec(ctx, userAssignSQL, orgID, 1, roleID, now)
		if err != nil {
			return fmt.Errorf("assigning role to user %s: %w", perm.Name, err)
		}

	case v0alpha1.ResourcePermissionSpecPermissionKindTeam:
		// For simplicity, we'll create a placeholder team assignment
		// In a real implementation, you'd look up the actual team ID by UID
		teamAssignSQL := fmt.Sprintf(`
			INSERT INTO %s (org_id, team_id, role_id, created)
			VALUES (?, ?, ?, ?)
		`, dbHelper.Table("team_role"))

		// Use a placeholder team ID (in real implementation, look up by perm.Name)
		_, err := tx.Exec(ctx, teamAssignSQL, orgID, 1, roleID, now)
		if err != nil {
			return fmt.Errorf("assigning role to team %s: %w", perm.Name, err)
		}

	case v0alpha1.ResourcePermissionSpecPermissionKindBasicRole:
		// Assign to built-in role
		builtinAssignSQL := fmt.Sprintf(`
			INSERT INTO %s (role, role_id, org_id, created, updated)
			VALUES (?, ?, ?, ?, ?)
		`, dbHelper.Table("builtin_role"))

		_, err := tx.Exec(ctx, builtinAssignSQL, perm.Name, roleID, orgID, now, now)
		if err != nil {
			return fmt.Errorf("assigning role to built-in role %s: %w", perm.Name, err)
		}

	case v0alpha1.ResourcePermissionSpecPermissionKindServiceAccount:
		// Treat service accounts as users for now
		userAssignSQL := fmt.Sprintf(`
			INSERT INTO %s (org_id, user_id, role_id, created)
			VALUES (?, ?, ?, ?)
		`, dbHelper.Table("user_role"))

		// Use a placeholder user ID (in real implementation, look up service account)
		_, err := tx.Exec(ctx, userAssignSQL, orgID, 1, roleID, now)
		if err != nil {
			return fmt.Errorf("assigning role to service account %s: %w", perm.Name, err)
		}

	default:
		return fmt.Errorf("unsupported permission kind: %s", perm.Kind)
	}

	return nil
}

// fromV0ResourcePermission is kept for compatibility but not used in the new approach
func fromV0ResourcePermission(v0Perm *v0alpha1.ResourcePermission, orgID int64) []accesscontrol.ResourcePermission {
	var permissions []accesscontrol.ResourcePermission

	// Extract resource info from spec
	resource := v0Perm.Spec.Resource.Resource
	resourceUID := v0Perm.Spec.Resource.Name
	if resourceUID == "" {
		resourceUID = "*" // wildcard if no specific resource name
	}

	for _, perm := range v0Perm.Spec.Permissions {
		for _, verb := range perm.Verbs {
			// Create scope in the format expected by Grafana (e.g., "dashboards:uid:abc123")
			scope := fmt.Sprintf("%s:uid:%s", resource, resourceUID)
			if resourceUID == "*" {
				scope = fmt.Sprintf("%s:*", resource)
			}

			resourcePerm := accesscontrol.ResourcePermission{
				Scope:   scope,
				Actions: []string{verb},
			}

			// Set subject information based on permission kind
			switch perm.Kind {
			case v0alpha1.ResourcePermissionSpecPermissionKindUser:
				resourcePerm.UserUID = perm.Name
			case v0alpha1.ResourcePermissionSpecPermissionKindTeam:
				resourcePerm.TeamUID = perm.Name
			case v0alpha1.ResourcePermissionSpecPermissionKindBasicRole:
				resourcePerm.BuiltInRole = perm.Name
			case v0alpha1.ResourcePermissionSpecPermissionKindServiceAccount:
				resourcePerm.UserUID = perm.Name
				// Note: Service account distinction might need additional handling
			}

			permissions = append(permissions, resourcePerm)
		}
	}

	return permissions
}
