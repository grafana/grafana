package resourcepermission

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"strings"

	"github.com/grafana/authlib/types"

	"github.com/grafana/grafana/apps/iam/pkg/apis/iam/v0alpha1"
	"github.com/grafana/grafana/pkg/registry/apis/iam/legacy"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/sqlstore/session"
	"github.com/grafana/grafana/pkg/storage/legacysql"
)

// List

// Get
// getResourcePermissions queries resource permissions based on the provided ListResourcePermissionsQuery and groups them by resource (e.g. {folder.grafana.app, folders, fold1})
func (s *ResourcePermSqlBackend) getResourcePermissions(ctx context.Context, sql *legacysql.LegacyDatabaseHelper, query *ListResourcePermissionsQuery) (map[groupResourceName][]rbacAssignment, error) {
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

	permissions := make(map[groupResourceName][]rbacAssignment)
	for rows.Next() {
		var perm rbacAssignment
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

// getResourcePermission retrieves a single ResourcePermission by its name in the format <group>-<resource>-<name> (e.g. dashboard.grafana.app-dashboards-ad5rwqs)
func (s *ResourcePermSqlBackend) getResourcePermission(ctx context.Context, sql *legacysql.LegacyDatabaseHelper, ns types.NamespaceInfo, name string) (*v0alpha1.ResourcePermission, error) {
	mapper, grn, err := s.splitResourceName(name)
	if err != nil {
		return nil, err
	}

	resourceQuery := &ListResourcePermissionsQuery{
		Scope:      mapper.Scope(grn.Name),
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

// createAndAssignManagedRole creates a new managed role and assigns it to the given user/team/service account/basic role
func (s *ResourcePermSqlBackend) createAndAssignManagedRole(ctx context.Context, tx *session.SessionTx, dbHelper *legacysql.LegacyDatabaseHelper, orgID int64, assignment rbacAssignmentCreate) (int64, error) {
	// Create the managed role
	roleUID := accesscontrol.PrefixedRoleUID(fmt.Sprintf("%s:org:%v", assignment.RoleName, orgID))
	insertRoleQuery, args, err := buildInsertRoleQuery(dbHelper, orgID, roleUID, assignment.RoleName)
	if err != nil {
		return 0, err
	}

	_, err = tx.Exec(ctx, insertRoleQuery, args...)
	if err != nil {
		s.logger.Error("could not insert new role", "orgID", orgID, "roleName", assignment.RoleName, "error", err.Error())
		return 0, fmt.Errorf("could not insert new role")
	}

	var roleID int64
	idQuery := fmt.Sprintf("SELECT id FROM %s WHERE org_id = ? AND name = ?", dbHelper.Table("role"))
	err = tx.Get(ctx, &roleID, idQuery, orgID, assignment.RoleName)
	if err != nil {
		s.logger.Error("could not retrieve id of created role", "orgID", orgID, "roleName", assignment.RoleName, "error", err.Error())
		return 0, fmt.Errorf("could not retrieve id of created role")
	}

	assignQuery, args, err := buildInsertAssignmentQuery(dbHelper, orgID, roleID, assignment)
	if err != nil {
		return 0, err
	}
	_, err = tx.Exec(ctx, assignQuery, args...)
	if err != nil {
		s.logger.Error("could not insert role assignment", "orgID", orgID, "roleName", assignment.RoleName, "subjectID", assignment.SubjectID, "error", err.Error())
		return 0, fmt.Errorf("could not insert role assignment")
	}

	return roleID, nil
}

// storeRbacAssignment ensures that a role exists for the given assignment, creates and assigns it if it doesn't
// and then ensures that the role has the correct permission for the given scope
func (s *ResourcePermSqlBackend) storeRbacAssignment(ctx context.Context, dbHelper *legacysql.LegacyDatabaseHelper, tx *session.SessionTx, orgID int64, assignment rbacAssignmentCreate) error {
	// Check if role already exists
	var roleID int64
	query := fmt.Sprintf("SELECT id FROM %s WHERE org_id = ? AND name = ?", dbHelper.Table("role"))
	err := tx.Get(ctx, &roleID, query, orgID, assignment.RoleName)
	if err != nil && !errors.Is(err, sql.ErrNoRows) {
		s.logger.Error("could not check for existing role", "orgID", orgID, "roleName", assignment.RoleName, "error", err.Error())
		return fmt.Errorf("could not check for existing role")
	}

	// Role doesn't exist, create it
	if roleID == 0 {
		roleID, err = s.createAndAssignManagedRole(ctx, tx, dbHelper, orgID, assignment)
		if err != nil {
			return err
		}
	}

	// Add the new permission
	insertPermQuery, args, err := buildInsertPermissionQuery(dbHelper, roleID, assignment.permission())
	if err != nil {
		return err
	}
	_, err = tx.Exec(ctx, insertPermQuery, args...)
	if err != nil {
		s.logger.Error("could not insert role permission", "roleID", roleID, "scope", assignment.Scope, "error", err.Error())
		return fmt.Errorf("could not insert role permission")
	}

	return nil
}

// buildRbacAssignments builds the list of assignments (role assignments and permissions) for a given ResourcePermission spec
// It resolves user/team/service account UIDs to internal IDs for the role name and assignee subjectID
func (s *ResourcePermSqlBackend) buildRbacAssignments(ctx context.Context, ns types.NamespaceInfo, mapper Mapper, v0ResourcePerm *v0alpha1.ResourcePermission, rbacScope string) ([]rbacAssignmentCreate, error) {
	assignments := make([]rbacAssignmentCreate, 0, len(v0ResourcePerm.Spec.Permissions))

	for _, perm := range v0ResourcePerm.Spec.Permissions {
		rbacActionSet, err := mapper.ActionSet(perm.Verb)
		if err != nil {
			return nil, err
		}

		switch perm.Kind {
		case v0alpha1.ResourcePermissionSpecPermissionKindUser:
			userID, err := s.identityStore.GetUserInternalID(ctx, ns, legacy.GetUserInternalIDQuery{
				UID:   perm.Name,
				OrgID: ns.OrgID,
			})
			if err != nil && !strings.Contains(err.Error(), "not found") {
				return nil, fmt.Errorf("resolving user %q to internal ID: %w", perm.Name, err)
			}
			if userID == nil {
				return nil, fmt.Errorf("user %q not found: %w", perm.Name, errInvalidSpec)
			}
			assignments = append(assignments, rbacAssignmentCreate{
				RoleName:         fmt.Sprintf("managed:users:%d:permissions", userID.ID),
				AssignmentTable:  "user_role",
				AssignmentColumn: "user_id",
				SubjectID:        fmt.Sprintf("%d", userID.ID),
				Action:           rbacActionSet,
				Scope:            rbacScope,
			})
		case v0alpha1.ResourcePermissionSpecPermissionKindTeam:
			teamID, err := s.identityStore.GetTeamInternalID(ctx, ns, legacy.GetTeamInternalIDQuery{
				UID:   perm.Name,
				OrgID: ns.OrgID,
			})
			if err != nil && !strings.Contains(err.Error(), "not found") {
				return nil, fmt.Errorf("resolving team %q to internal ID: %w", perm.Name, err)
			}
			if teamID == nil {
				return nil, fmt.Errorf("team %q not found: %w", perm.Name, errInvalidSpec)
			}
			assignments = append(assignments, rbacAssignmentCreate{
				RoleName:         fmt.Sprintf("managed:teams:%d:permissions", teamID.ID),
				AssignmentTable:  "team_role",
				AssignmentColumn: "team_id",
				SubjectID:        fmt.Sprintf("%d", teamID.ID),
				Action:           rbacActionSet,
				Scope:            rbacScope,
			})
		case v0alpha1.ResourcePermissionSpecPermissionKindServiceAccount:
			saID, err := s.identityStore.GetServiceAccountInternalID(ctx, ns, legacy.GetServiceAccountInternalIDQuery{
				UID:   perm.Name,
				OrgID: ns.OrgID,
			})
			if err != nil && !strings.Contains(err.Error(), "not found") {
				return nil, fmt.Errorf("resolving service account %q to internal ID: %w", perm.Name, err)
			}
			if saID == nil {
				return nil, fmt.Errorf("service account %q not found: %w", perm.Name, errInvalidSpec)
			}
			assignments = append(assignments, rbacAssignmentCreate{
				RoleName:         fmt.Sprintf("managed:users:%d:permissions", saID.ID),
				AssignmentTable:  "user_role",
				AssignmentColumn: "user_id",
				SubjectID:        fmt.Sprintf("%d", saID.ID),
				Action:           rbacActionSet,
				Scope:            rbacScope,
			})
		case v0alpha1.ResourcePermissionSpecPermissionKindBasicRole:
			if !allowedBasicRoles[perm.Name] {
				return nil, fmt.Errorf("invalid basic role %q: %w", perm.Name, errInvalidSpec)
			}
			assignments = append(assignments, rbacAssignmentCreate{
				RoleName:         fmt.Sprintf("managed:builtins:%s:permissions", strings.ToLower(perm.Name)),
				AssignmentTable:  "builtin_role",
				AssignmentColumn: "role",
				SubjectID:        perm.Name,
				Action:           rbacActionSet,
				Scope:            rbacScope,
			})
		default:
			return nil, fmt.Errorf("unknown permission kind: %q: %w", perm.Kind, errInvalidSpec)
		}
	}

	return assignments, nil
}

// existsResourcePermission checks if a resource permission for the given scope already exists in the given organization
func (s *ResourcePermSqlBackend) existsResourcePermission(ctx context.Context, tx *session.SessionTx, dbHelper *legacysql.LegacyDatabaseHelper, orgID int64, scope string) error {
	idQuery := fmt.Sprintf(
		`SELECT r.id FROM %s AS r INNER JOIN %s AS p ON p.role_id = r.id WHERE r.org_id = ? AND r.name LIKE ? AND p.scope = ? LIMIT 1`,
		dbHelper.Table("role"), dbHelper.Table("permission"),
	)
	roleID := int64(0)
	err := tx.Get(ctx, &roleID, idQuery, orgID, "managed:%", scope)
	if err != nil && !errors.Is(err, sql.ErrNoRows) {
		s.logger.Error("could not check for existing resource permission", "orgID", orgID, "scope", scope, "error", err.Error())
		return fmt.Errorf("could not check for existing resource permission")
	}
	if roleID != 0 {
		return errConflict
	}
	return nil
}

func (s *ResourcePermSqlBackend) createResourcePermission(
	ctx context.Context, dbHelper *legacysql.LegacyDatabaseHelper, ns types.NamespaceInfo, mapper Mapper, grn *groupResourceName, v0ResourcePerm *v0alpha1.ResourcePermission,
) (int64, error) {
	if v0ResourcePerm == nil {
		return 0, fmt.Errorf("resource permission cannot be nil")
	}

	if len(v0ResourcePerm.Spec.Permissions) == 0 {
		return 0, fmt.Errorf("resource permission must have at least one permission: %w", errInvalidSpec)
	}

	// Validate that the group/resource/name in the name matches the spec
	if grn.Group != v0ResourcePerm.Spec.Resource.ApiGroup ||
		grn.Resource != v0ResourcePerm.Spec.Resource.Resource ||
		grn.Name != v0ResourcePerm.Spec.Resource.Name {
		return 0, fmt.Errorf("resource permission group/resource does not match spec: %w", errInvalidSpec)
	}

	if grn.Name == "" {
		return 0, fmt.Errorf("resource permission name cannot be empty: %w", errInvalidName)
	}

	assignments, err := s.buildRbacAssignments(ctx, ns, mapper, v0ResourcePerm, mapper.Scope(grn.Name))
	if err != nil {
		return 0, err
	}

	err = dbHelper.DB.GetSqlxSession().WithTransaction(ctx, func(tx *session.SessionTx) error {
		// Check if a resource permission for the same resource already exists
		if err = s.existsResourcePermission(ctx, tx, dbHelper, ns.OrgID, mapper.Scope(grn.Name)); err != nil {
			return err
		}

		for _, assignment := range assignments {
			if err := s.storeRbacAssignment(ctx, dbHelper, tx, ns.OrgID, assignment); err != nil {
				return err
			}
		}

		return nil
	})

	if err != nil {
		return 0, err
	}

	// Return a timestamp as resource version
	return timeNow().UnixMilli(), nil
}

// Update

// Delete
