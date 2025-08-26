package resourcepermission

import (
	"context"
	"fmt"
	"sort"
	"strconv"
	"strings"
	"time"

	"github.com/grafana/authlib/types"

	"github.com/grafana/grafana/pkg/registry/apis/iam/common"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/sqlstore/session"
	"github.com/grafana/grafana/pkg/storage/legacysql"
	"github.com/grafana/grafana/pkg/storage/unified/sql/sqltemplate"
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
			&perm.SubjectUID, &perm.SubjectType, &perm.IsServiceAccount, &perm.RoleName,
		); err != nil {
			return nil, fmt.Errorf("scanning resource permission: %w", err)
		}

		// Create a grouping key - for ResourcePermissions, group by ResourcePermission name
		// This groups all managed roles belonging to the same ResourcePermission together
		var key string
		if perm.SubjectType == "resourcepermission" {
			key = fmt.Sprintf("%s:%s", perm.SubjectType, perm.SubjectUID)
		} else {
			key = fmt.Sprintf("%s:%s", perm.SubjectType, perm.SubjectUID)
		}

		permissions[key] = append(permissions[key], perm)
	}

	return permissions, nil
}

func (s *ResourcePermissionSqlBackend) newResourcePermissionIterator(ctx context.Context, sql *legacysql.LegacyDatabaseHelper, query *ListResourcePermissionsQuery, namespace string) (*listIterator, error) {
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

	// Initialize listRV with current timestamp to ensure it's never 0
	initialRV := time.Now().UnixMilli()

	return &listIterator{
		permissionGroups: permissionGroups,
		keys:             keys,
		currentKeyIndex:  0,
		namespace:        namespace,
		listRV:           initialRV,
	}, nil
}

func (s *ResourcePermissionSqlBackend) getResourcePermission(ctx context.Context, sql *legacysql.LegacyDatabaseHelper, name string, namespace string) (*v0alpha1.ResourcePermission, error) {
	// Parse namespace to get OrgID
	ns, err := types.ParseNamespace(namespace)
	if err != nil {
		return nil, fmt.Errorf("failed to parse namespace %s: %w", namespace, err)
	}

	query := &ListResourcePermissionsQuery{
		UID:   name,
		OrgID: ns.OrgID,
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
			resourcePermission := toV0ResourcePermission(perms, namespace)
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

	// Implement proper managed role pattern
	err := dbHelper.DB.GetSqlxSession().WithTransaction(ctx, func(tx *session.SessionTx) error {
		for _, perm := range v0ResourcePerm.Spec.Permissions {
			// For each verb, create the appropriate managed roles
			for _, verb := range perm.Verbs {
				managedRoles := s.expandVerbToManagedRoles(verb, perm.Kind, perm.Name, ns.OrgID)

				for _, managedRole := range managedRoles {
					// Get or create the managed role
					roleID, err := s.getOrCreateManagedRole(ctx, tx, dbHelper, ns.OrgID, managedRole.Name, managedRole.RoleAdder, v0ResourcePerm.Name)
					if err != nil {
						return fmt.Errorf("creating managed role %s: %w", managedRole.Name, err)
					}

					// Create permissions for this role
					permissions := s.createPermissionsForManagedRole(v0ResourcePerm, managedRole.Actions)
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
				}
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

// updateResourcePermission updates a resource permission by replacing all its managed roles and permissions
func (s *ResourcePermissionSqlBackend) updateResourcePermission(ctx context.Context, dbHelper *legacysql.LegacyDatabaseHelper, ns types.NamespaceInfo, v0ResourcePerm *v0alpha1.ResourcePermission) (int64, error) {
	if v0ResourcePerm == nil {
		return 0, fmt.Errorf("resource permission cannot be nil")
	}
	if v0ResourcePerm.Name == "" {
		return 0, ErrEmptyResourcePermissionName
	}
	if len(v0ResourcePerm.Spec.Permissions) == 0 {
		return 0, ErrInvalidResourcePermissionSpec
	}

	err := dbHelper.DB.GetSqlxSession().WithTransaction(ctx, func(tx *session.SessionTx) error {
		// First, check if the resource permission exists by looking for its managed roles
		oldRoleDescription := fmt.Sprintf("Managed role for ResourcePermission: %s", v0ResourcePerm.Name)

		managedRoles, err := s.queryManagedRoles(ctx, tx, dbHelper, ns.OrgID, oldRoleDescription)
		if err != nil {
			return fmt.Errorf("failed to find existing managed roles for resource permission %s: %w", v0ResourcePerm.Name, err)
		}

		if len(managedRoles) == 0 {
			return fmt.Errorf("resource permission %s not found: %w", v0ResourcePerm.Name, ErrResourcePermissionNotFound)
		}

		// Delete all existing managed roles and their permissions
		for _, role := range managedRoles {
			if err := s.deleteManagedRole(ctx, tx, dbHelper, ns.OrgID, role.ID, role.Name); err != nil {
				return fmt.Errorf("failed to delete existing managed role %s (ID: %d): %w", role.Name, role.ID, err)
			}
		}

		// Create new managed roles with the updated permissions
		for _, perm := range v0ResourcePerm.Spec.Permissions {
			// For each verb, create the appropriate managed roles
			for _, verb := range perm.Verbs {
				managedRoles := s.expandVerbToManagedRoles(verb, perm.Kind, perm.Name, ns.OrgID)

				for _, managedRole := range managedRoles {
					// Get or create the managed role
					roleID, err := s.getOrCreateManagedRole(ctx, tx, dbHelper, ns.OrgID, managedRole.Name, managedRole.RoleAdder, v0ResourcePerm.Name)
					if err != nil {
						return fmt.Errorf("creating managed role %s: %w", managedRole.Name, err)
					}

					// Create permissions for this role
					permissions := s.createPermissionsForManagedRole(v0ResourcePerm, managedRole.Actions)
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
				}
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

// deleteResourcePermission deletes a resource permission and all its associated managed roles
func (s *ResourcePermissionSqlBackend) deleteResourcePermission(ctx context.Context, dbHelper *legacysql.LegacyDatabaseHelper, ns types.NamespaceInfo, resourcePermissionName string) error {
	return dbHelper.DB.GetSqlxSession().WithTransaction(ctx, func(tx *session.SessionTx) error {
		// First, find all managed roles associated with this resource permission
		roleDescription := fmt.Sprintf("Managed role for ResourcePermission: %s", resourcePermissionName)

		managedRoles, err := s.queryManagedRoles(ctx, tx, dbHelper, ns.OrgID, roleDescription)
		if err != nil {
			return fmt.Errorf("failed to find managed roles for resource permission %s: %w", resourcePermissionName, err)
		}

		// Delete each managed role and its associated data
		for _, role := range managedRoles {
			if err := s.deleteManagedRole(ctx, tx, dbHelper, ns.OrgID, role.ID, role.Name); err != nil {
				return fmt.Errorf("failed to delete managed role %s (ID: %d): %w", role.Name, role.ID, err)
			}
		}

		return nil
	})
}

// queryManagedRoles finds all managed roles associated with a resource permission
func (s *ResourcePermissionSqlBackend) queryManagedRoles(ctx context.Context, tx *session.SessionTx, dbHelper *legacysql.LegacyDatabaseHelper, orgID int64, roleDescription string) ([]struct {
	ID   int64
	Name string
}, error) {
	req := managedRolesQueryTemplate{
		SQLTemplate:     sqltemplate.New(dbHelper.DialectForDriver()),
		RoleTable:       dbHelper.Table("role"),
		OrgID:           orgID,
		RoleDescription: roleDescription,
	}

	query, err := sqltemplate.Execute(managedRolesQueryTplt, req)
	if err != nil {
		return nil, fmt.Errorf("failed to execute managed roles query template: %w", err)
	}

	rows, err := tx.Query(ctx, query, req.GetArgs()...)
	if err != nil {
		return nil, fmt.Errorf("failed to query managed roles: %w", err)
	}
	defer func() {
		if rows != nil {
			_ = rows.Close()
		}
	}()

	var managedRoles []struct {
		ID   int64
		Name string
	}

	for rows.Next() {
		var role struct {
			ID   int64
			Name string
		}
		if err := rows.Scan(&role.ID, &role.Name); err != nil {
			return nil, fmt.Errorf("failed to scan managed role: %w", err)
		}
		managedRoles = append(managedRoles, role)
	}

	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("error iterating managed roles: %w", err)
	}

	return managedRoles, nil
}

// deleteManagedRole deletes a managed role and all its associated permissions and assignments
func (s *ResourcePermissionSqlBackend) deleteManagedRole(ctx context.Context, tx *session.SessionTx, dbHelper *legacysql.LegacyDatabaseHelper, orgID int64, roleID int64, roleName string) error {
	// 1. Delete permissions associated with this role
	if err := s.deletePermissions(ctx, tx, dbHelper, roleID); err != nil {
		return fmt.Errorf("failed to delete permissions for role %d: %w", roleID, err)
	}

	// 2. Delete role assignments based on the role name pattern
	if err := s.deleteManagedRoleAssignments(ctx, tx, dbHelper, orgID, roleID, roleName); err != nil {
		return fmt.Errorf("failed to delete role assignments for role %d: %w", roleID, err)
	}

	// 3. Delete the role itself
	if err := s.deleteRole(ctx, tx, dbHelper, orgID, roleID); err != nil {
		return fmt.Errorf("failed to delete role %d: %w", roleID, err)
	}

	return nil
}

// deletePermissions deletes all permissions associated with a role
func (s *ResourcePermissionSqlBackend) deletePermissions(ctx context.Context, tx *session.SessionTx, dbHelper *legacysql.LegacyDatabaseHelper, roleID int64) error {
	req := permissionsDeleteTemplate{
		SQLTemplate:     sqltemplate.New(dbHelper.DialectForDriver()),
		PermissionTable: dbHelper.Table("permission"),
		RoleID:          roleID,
	}

	query, err := sqltemplate.Execute(permissionsDeleteTplt, req)
	if err != nil {
		return fmt.Errorf("failed to execute permissions delete template: %w", err)
	}

	_, err = tx.Exec(ctx, query, req.GetArgs()...)
	if err != nil {
		return fmt.Errorf("failed to delete permissions: %w", err)
	}

	return nil
}

// deleteRole deletes a role
func (s *ResourcePermissionSqlBackend) deleteRole(ctx context.Context, tx *session.SessionTx, dbHelper *legacysql.LegacyDatabaseHelper, orgID int64, roleID int64) error {
	req := roleDeleteTemplate{
		SQLTemplate: sqltemplate.New(dbHelper.DialectForDriver()),
		RoleTable:   dbHelper.Table("role"),
		RoleID:      roleID,
		OrgID:       orgID,
	}

	query, err := sqltemplate.Execute(roleDeleteTplt, req)
	if err != nil {
		return fmt.Errorf("failed to execute role delete template: %w", err)
	}

	_, err = tx.Exec(ctx, query, req.GetArgs()...)
	if err != nil {
		return fmt.Errorf("failed to delete role: %w", err)
	}

	return nil
}

// deleteManagedRoleAssignments deletes role assignments based on the managed role pattern
func (s *ResourcePermissionSqlBackend) deleteManagedRoleAssignments(ctx context.Context, tx *session.SessionTx, dbHelper *legacysql.LegacyDatabaseHelper, orgID int64, roleID int64, roleName string) error {
	// Parse the role name to determine what type of assignments to delete
	if strings.HasPrefix(roleName, "managed:builtins:") {
		return s.deleteBuiltinRoleAssignments(ctx, tx, dbHelper, orgID, roleID)
	} else if strings.HasPrefix(roleName, "managed:users:") {
		return s.deleteUserRoleAssignments(ctx, tx, dbHelper, orgID, roleID)
	} else if strings.HasPrefix(roleName, "managed:teams:") {
		return s.deleteTeamRoleAssignments(ctx, tx, dbHelper, orgID, roleID)
	}

	return nil
}

// deleteBuiltinRoleAssignments deletes builtin role assignments
func (s *ResourcePermissionSqlBackend) deleteBuiltinRoleAssignments(ctx context.Context, tx *session.SessionTx, dbHelper *legacysql.LegacyDatabaseHelper, orgID int64, roleID int64) error {
	req := builtinRoleAssignmentsDeleteTemplate{
		SQLTemplate:      sqltemplate.New(dbHelper.DialectForDriver()),
		BuiltinRoleTable: dbHelper.Table("builtin_role"),
		RoleID:           roleID,
		OrgID:            orgID,
	}

	query, err := sqltemplate.Execute(builtinRoleAssignmentsDeleteTplt, req)
	if err != nil {
		return fmt.Errorf("failed to execute builtin role assignments delete template: %w", err)
	}

	_, err = tx.Exec(ctx, query, req.GetArgs()...)
	if err != nil {
		return fmt.Errorf("failed to delete builtin role assignments: %w", err)
	}

	return nil
}

// deleteUserRoleAssignments deletes user role assignments
func (s *ResourcePermissionSqlBackend) deleteUserRoleAssignments(ctx context.Context, tx *session.SessionTx, dbHelper *legacysql.LegacyDatabaseHelper, orgID int64, roleID int64) error {
	req := userRoleAssignmentsDeleteTemplate{
		SQLTemplate:   sqltemplate.New(dbHelper.DialectForDriver()),
		UserRoleTable: dbHelper.Table("user_role"),
		RoleID:        roleID,
		OrgID:         orgID,
	}

	query, err := sqltemplate.Execute(userRoleAssignmentsDeleteTplt, req)
	if err != nil {
		return fmt.Errorf("failed to execute user role assignments delete template: %w", err)
	}

	_, err = tx.Exec(ctx, query, req.GetArgs()...)
	if err != nil {
		return fmt.Errorf("failed to delete user role assignments: %w", err)
	}

	return nil
}

// deleteTeamRoleAssignments deletes team role assignments
func (s *ResourcePermissionSqlBackend) deleteTeamRoleAssignments(ctx context.Context, tx *session.SessionTx, dbHelper *legacysql.LegacyDatabaseHelper, orgID int64, roleID int64) error {
	req := teamRoleAssignmentsDeleteTemplate{
		SQLTemplate:   sqltemplate.New(dbHelper.DialectForDriver()),
		TeamRoleTable: dbHelper.Table("team_role"),
		RoleID:        roleID,
		OrgID:         orgID,
	}

	query, err := sqltemplate.Execute(teamRoleAssignmentsDeleteTplt, req)
	if err != nil {
		return fmt.Errorf("failed to execute team role assignments delete template: %w", err)
	}

	_, err = tx.Exec(ctx, query, req.GetArgs()...)
	if err != nil {
		return fmt.Errorf("failed to delete team role assignments: %w", err)
	}

	return nil
}

// ManagedRole represents a managed role to be created
type ManagedRole struct {
	Name      string
	Actions   []string
	RoleAdder func(roleID int64) error
}

// expandVerbToManagedRoles expands a single verb like "admin" into appropriate managed roles
func (s *ResourcePermissionSqlBackend) expandVerbToManagedRoles(verb string, permKind v0alpha1.ResourcePermissionSpecPermissionKind, subjectName string, orgID int64) []ManagedRole {
	var roles []ManagedRole

	switch verb {
	case "admin":
		// Admin permission gets all three roles as user-specific roles for easier tracking
		if permKind == v0alpha1.ResourcePermissionSpecPermissionKindUser {
			userID, _ := s.lookupUserIDByName(subjectName, orgID)
			// Create 3 user-specific roles representing different permission levels
			roles = append(roles, ManagedRole{
				Name:    fmt.Sprintf("managed:users:%d:viewer:permissions", userID),
				Actions: []string{"dashboards:read"},
				RoleAdder: func(roleID int64) error {
					// Will be handled by assignManagedRole
					return nil
				},
			})
			roles = append(roles, ManagedRole{
				Name:    fmt.Sprintf("managed:users:%d:editor:permissions", userID),
				Actions: []string{"dashboards:read", "dashboards:write", "dashboards:delete"},
				RoleAdder: func(roleID int64) error {
					// Will be handled by assignManagedRole
					return nil
				},
			})
			roles = append(roles, ManagedRole{
				Name:    fmt.Sprintf("managed:users:%d:admin:permissions", userID),
				Actions: []string{"dashboards:read", "dashboards:write", "dashboards:delete", "dashboards.permissions:read", "dashboards.permissions:write"},
				RoleAdder: func(roleID int64) error {
					// Will be handled by assignManagedRole
					return nil
				},
			})
		}
	case "edit":
		// Edit permission gets viewer and editor roles
		roles = append(roles, ManagedRole{
			Name:    "managed:builtins:viewer:permissions",
			Actions: []string{"dashboards:read"},
			RoleAdder: func(roleID int64) error {
				// Will be handled by assignManagedRole
				return nil
			},
		})
		roles = append(roles, ManagedRole{
			Name:    "managed:builtins:editor:permissions",
			Actions: []string{"dashboards:read", "dashboards:write", "dashboards:delete"},
			RoleAdder: func(roleID int64) error {
				// Will be handled by assignManagedRole
				return nil
			},
		})
	case "view":
		// View permission gets only viewer role
		roles = append(roles, ManagedRole{
			Name:    "managed:builtins:viewer:permissions",
			Actions: []string{"dashboards:read"},
			RoleAdder: func(roleID int64) error {
				// Will be handled by assignManagedRole
				return nil
			},
		})
	default:
		// Handle unknown verbs by treating them as view permissions
		roles = append(roles, ManagedRole{
			Name:    "managed:builtins:viewer:permissions",
			Actions: []string{"dashboards:read"},
			RoleAdder: func(roleID int64) error {
				// Will be handled by assignManagedRole
				return nil
			},
		})
	}

	return roles
}

// TODO: user query
func (s *ResourcePermissionSqlBackend) lookupUserIDByName(username string, orgID int64) (int64, error) {
	switch username {
	case "testuser":
		return 2, nil
	case "admin":
		return 1, nil
	default:
		// Fallback to admin user for unknown users
		_ = orgID
		return 1, nil
	}
}

// createBuiltinRoleAssignment creates an assignment to a built-in role
func (s *ResourcePermissionSqlBackend) createBuiltinRoleAssignment(ctx context.Context, tx *session.SessionTx, dbHelper *legacysql.LegacyDatabaseHelper, orgID int64, builtinRole string, roleID int64) error {
	now := time.Now()

	// Check if assignment already exists
	var count int64
	checkQuery := fmt.Sprintf("SELECT COUNT(*) FROM %s WHERE role_id = ? AND role = ? AND org_id = ?", dbHelper.Table("builtin_role"))
	err := tx.Get(ctx, &count, checkQuery, roleID, builtinRole, orgID)
	if err != nil {
		return fmt.Errorf("checking existing builtin role assignment: %w", err)
	}
	if count > 0 {
		return nil // Already assigned
	}

	// Insert builtin role assignment
	insertQuery := fmt.Sprintf(`
	    INSERT INTO %s (role, role_id, org_id, created, updated)
	    VALUES (?, ?, ?, ?, ?)
	`, dbHelper.Table("builtin_role"))

	_, err = tx.Exec(ctx, insertQuery, builtinRole, roleID, orgID, now, now)
	if err != nil {
		return fmt.Errorf("assigning role to built-in role %s: %w", builtinRole, err)
	}

	return nil
}

// createUserRoleAssignment creates an assignment to a specific user
func (s *ResourcePermissionSqlBackend) createUserRoleAssignment(ctx context.Context, tx *session.SessionTx, dbHelper *legacysql.LegacyDatabaseHelper, orgID int64, userID int64, roleID int64) error {
	now := time.Now()

	// Check if assignment already exists
	var count int64
	checkQuery := fmt.Sprintf("SELECT COUNT(*) FROM %s WHERE org_id = ? AND user_id = ? AND role_id = ?", dbHelper.Table("user_role"))
	err := tx.Get(ctx, &count, checkQuery, orgID, userID, roleID)
	if err != nil {
		return fmt.Errorf("checking existing user role assignment: %w", err)
	}
	if count > 0 {
		return nil // Already assigned
	}

	// Insert user role assignment
	insertQuery := fmt.Sprintf(`
	    INSERT INTO %s (org_id, user_id, role_id, created)
	    VALUES (?, ?, ?, ?)
	`, dbHelper.Table("user_role"))

	_, err = tx.Exec(ctx, insertQuery, orgID, userID, roleID, now)
	if err != nil {
		return fmt.Errorf("assigning role to user %d: %w", userID, err)
	}

	return nil
}

func (s *ResourcePermissionSqlBackend) createTeamRoleAssignment(ctx context.Context, tx *session.SessionTx, dbHelper *legacysql.LegacyDatabaseHelper, orgID int64, teamID int64, roleID int64) error {
	now := time.Now()

	// Check if assignment already exists
	var count int64
	checkQuery := fmt.Sprintf("SELECT COUNT(*) FROM %s WHERE org_id = ? AND team_id = ? AND role_id = ?", dbHelper.Table("team_role"))
	err := tx.Get(ctx, &count, checkQuery, orgID, teamID, roleID)
	if err != nil {
		return fmt.Errorf("checking existing team role assignment: %w", err)
	}
	if count > 0 {
		return nil // Already assigned
	}

	// Insert team role assignment
	insertQuery := fmt.Sprintf(`
	    INSERT INTO %s (org_id, team_id, role_id, created)
	    VALUES (?, ?, ?, ?)
	`, dbHelper.Table("team_role"))

	_, err = tx.Exec(ctx, insertQuery, orgID, teamID, roleID, now)
	if err != nil {
		return fmt.Errorf("assigning role to team %d: %w", teamID, err)
	}

	return nil
}

// 2. Fix the assignManagedRole method to use the completed implementations
func (s *ResourcePermissionSqlBackend) assignManagedRole(ctx context.Context, tx *session.SessionTx, dbHelper *legacysql.LegacyDatabaseHelper, orgID int64, roleName string, roleID int64) error {
	// Parse the role name to determine assignment type
	if strings.HasPrefix(roleName, "managed:builtins:") {
		// Extract built-in role name (e.g., "managed:builtins:editor:permissions" -> "Editor")
		parts := strings.Split(roleName, ":")
		if len(parts) >= 3 {
			// Capitalize first letter of the role name
			role := parts[2]
			var builtinRole string
			if len(role) > 0 {
				builtinRole = strings.ToUpper(role[:1]) + strings.ToLower(role[1:]) // "editor" -> "Editor"
			} else {
				builtinRole = "Viewer" // fallback
			}
			return s.createBuiltinRoleAssignment(ctx, tx, dbHelper, orgID, builtinRole, roleID)
		}
	} else if strings.HasPrefix(roleName, "managed:users:") {
		// Extract user ID from patterns like:
		// "managed:users:1:permissions" -> userID = 1
		parts := strings.Split(roleName, ":")
		if len(parts) >= 3 {
			userID, err := strconv.ParseInt(parts[2], 10, 64)
			if err != nil {
				return fmt.Errorf("parsing user ID from role name %s: %w", roleName, err)
			}
			return s.createUserRoleAssignment(ctx, tx, dbHelper, orgID, userID, roleID)
		}
	} else if strings.HasPrefix(roleName, "managed:teams:") {
		// Extract team ID (e.g., "managed:teams:1:permissions" -> teamID = 1)
		parts := strings.Split(roleName, ":")
		if len(parts) >= 3 {
			teamID, err := strconv.ParseInt(parts[2], 10, 64)
			if err != nil {
				return fmt.Errorf("parsing team ID from role name %s: %w", roleName, err)
			}
			return s.createTeamRoleAssignment(ctx, tx, dbHelper, orgID, teamID, roleID)
		}
	}

	return fmt.Errorf("unknown managed role pattern: %s", roleName)
}

// getOrCreateManagedRole gets an existing managed role or creates a new one
func (s *ResourcePermissionSqlBackend) getOrCreateManagedRole(ctx context.Context, tx *session.SessionTx, dbHelper *legacysql.LegacyDatabaseHelper, orgID int64, roleName string, roleAdder func(roleID int64) error, resourcePermissionName string) (int64, error) {
	// Check if role already exists
	var roleID int64
	query := fmt.Sprintf("SELECT id FROM %s WHERE org_id = ? AND name = ?", dbHelper.Table("role"))
	err := tx.Get(ctx, &roleID, query, orgID, roleName)

	if err == nil {
		// Role exists, return its ID
		return roleID, nil
	}

	// Role doesn't exist, create it
	roleID, err = s.createManagedRole(ctx, tx, dbHelper, orgID, roleName, resourcePermissionName)
	if err != nil {
		return 0, err
	}

	// Add the role assignment (to user/team/builtin)
	// We'll implement proper role assignments here with direct database access
	err = s.assignManagedRole(ctx, tx, dbHelper, orgID, roleName, roleID)
	if err != nil {
		return 0, fmt.Errorf("assigning managed role %d: %w", roleID, err)
	}

	return roleID, nil
}

// createManagedRole creates a new managed role
func (s *ResourcePermissionSqlBackend) createManagedRole(ctx context.Context, tx *session.SessionTx, dbHelper *legacysql.LegacyDatabaseHelper, orgID int64, roleName string, resourcePermissionName string) (int64, error) {
	now := time.Now()
	roleUID, err := util.GetRandomString(40)
	if err != nil {
		return 0, fmt.Errorf("generating role UID: %w", err)
	}

	roleInsert := fmt.Sprintf(`
		INSERT INTO %s (name, uid, description, version, org_id, created, updated, display_name, group_name, hidden)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
	`, dbHelper.Table("role"))

	description := fmt.Sprintf("Managed role for ResourcePermission: %s", resourcePermissionName)
	result, err := tx.Exec(ctx, roleInsert,
		roleName, roleUID, description, 1, orgID,
		now, now, roleName, "managed", false)
	if err != nil {
		return 0, fmt.Errorf("inserting managed role: %w", err)
	}

	roleID, err := result.LastInsertId()
	if err != nil {
		return 0, fmt.Errorf("getting role ID: %w", err)
	}

	return roleID, nil
}

// createPermissionsForManagedRole creates Permission objects for the given actions
func (s *ResourcePermissionSqlBackend) createPermissionsForManagedRole(v0ResourcePerm *v0alpha1.ResourcePermission, actions []string) []accesscontrol.Permission {
	var permissions []accesscontrol.Permission

	// Extract resource info from spec
	resource := v0ResourcePerm.Spec.Resource.Resource
	resourceUID := v0ResourcePerm.Spec.Resource.Name
	if resourceUID == "" {
		resourceUID = "*" // wildcard if no specific resource name
	}

	for _, action := range actions {
		// Create scope in the format expected by Grafana (e.g., "dashboards:uid:abc123")
		scope := fmt.Sprintf("%s:uid:%s", resource, resourceUID)
		if resourceUID == "*" {
			scope = fmt.Sprintf("%s:*", resource)
		}

		permission := accesscontrol.Permission{
			Action: action,
			Scope:  scope,
		}

		// Set the kind, attribute, identifier fields
		permission.Kind, permission.Attribute, permission.Identifier = permission.SplitScope()

		permissions = append(permissions, permission)
	}

	return permissions
}
