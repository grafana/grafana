package resourcepermission

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/grafana/authlib/types"
	"github.com/grafana/grafana/apps/iam/pkg/apis/iam/v0alpha1"
	"github.com/grafana/grafana/pkg/registry/apis/iam/common"
	"github.com/grafana/grafana/pkg/registry/apis/iam/legacy"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/sqlstore/session"
	"github.com/grafana/grafana/pkg/storage/legacysql"
)

// List
func (s *ResourcePermSqlBackend) newRoleIterator(ctx context.Context, dbHelper *legacysql.LegacyDatabaseHelper, ns types.NamespaceInfo, pagination *common.Pagination) (*listIterator, error) {
	var (
		scope string

		actionSets    = make([]string, 0, 3*len(s.mappers))
		scopePatterns = make([]string, 0, len(s.mappers))

		assignments = make([]rbacAssignment, 0, 8)
		scopes      = make([]string, 0, 8)
	)

	for _, mapper := range s.mappers {
		actionSets = append(actionSets, mapper.ActionSets()...)
	}
	for _, mapper := range s.mappers {
		scopePatterns = append(scopePatterns, mapper.ScopePattern())
	}

	// Run in a transaction to ensure a consistent view of the data
	err := dbHelper.DB.GetSqlxSession().WithTransaction(ctx, func(tx *session.SessionTx) error {
		// Get page
		rawPageQuery, pageArgs, err := buildPageQueryFromTemplate(dbHelper, &PageQuery{
			ScopePatterns: scopePatterns,
			OrgID:         ns.OrgID,
			Pagination:    *pagination,
		})
		if err != nil {
			return err
		}
		rows, err := tx.Query(ctx, rawPageQuery, pageArgs...)
		if err != nil {
			if rows != nil {
				_ = rows.Close()
			}
			return fmt.Errorf("querying resource permissions: %w", err)
		}
		defer func() {
			_ = rows.Close()
		}()

		for rows.Next() {
			if err := rows.Scan(&scope); err != nil {
				return fmt.Errorf("scanning resource permission: %w", err)
			}
			scopes = append(scopes, scope)
		}

		if len(scopes) == 0 {
			// No results
			return nil
		}

		// Get assignments for the page
		assignments, err = s.getRbacAssignmentsWithTx(ctx, dbHelper, tx, &ListResourcePermissionsQuery{
			Scopes:     scopes,
			OrgID:      ns.OrgID,
			ActionSets: actionSets,
		})
		return err
	})
	if err != nil {
		return nil, err
	}

	if len(assignments) == 0 {
		// No results
		return &listIterator{}, nil
	}

	v0ResourcePermissions, err := s.toV0ResourcePermissions(assignments, ns.Value)
	if err != nil {
		return nil, err
	}

	return &listIterator{
		resourcePermissions: v0ResourcePermissions,
		initOffset:          pagination.Continue,
	}, nil
}

func (s *ResourcePermSqlBackend) latestUpdate(ctx context.Context, dbHelper *legacysql.LegacyDatabaseHelper, ns types.NamespaceInfo) int64 {
	scopePatterns := make([]string, 0, len(s.mappers)*3)
	for _, mapper := range s.mappers {
		scopePatterns = append(scopePatterns, mapper.ScopePattern())
	}
	query, args, err := buildLatestUpdateQueryFromTemplate(dbHelper, ns.OrgID, scopePatterns)
	if err != nil {
		s.logger.FromContext(ctx).Warn("Failed to build latest update query", "error", err)
		return timeNow().UnixMilli()
	}

	var maxUpdated time.Time
	err = dbHelper.DB.GetSqlxSession().Get(ctx, &maxUpdated, query, args...)
	if err != nil {
		if !errors.Is(err, sql.ErrNoRows) {
			s.logger.FromContext(ctx).Warn("Failed to get latest update for roles", "error", err)
		}
		return timeNow().UnixMilli()
	}

	return maxUpdated.UnixMilli()
}

// Get
// getRbacAssignmentsWithTx queries resource permissions based on the provided ListResourcePermissionsQuery and groups them by resource (e.g. {folder.grafana.app, folders, fold1})
func (s *ResourcePermSqlBackend) getRbacAssignmentsWithTx(ctx context.Context, sql *legacysql.LegacyDatabaseHelper, tx *session.SessionTx, query *ListResourcePermissionsQuery) ([]rbacAssignment, error) {
	rawQuery, args, err := buildListResourcePermissionsQueryFromTemplate(sql, query)
	if err != nil {
		return nil, err
	}

	rows, err := tx.Query(ctx, rawQuery, args...)
	if err != nil {
		if rows != nil {
			_ = rows.Close()
		}
		return nil, fmt.Errorf("querying resource permissions: %w", err)
	}
	defer func() {
		_ = rows.Close()
	}()

	permissions := make([]rbacAssignment, 0, 8)
	for rows.Next() {
		var perm rbacAssignment
		if err := rows.Scan(
			&perm.ID, &perm.Action, &perm.Scope, &perm.Created, &perm.Updated, &perm.RoleName,
			&perm.SubjectUID, &perm.SubjectType, &perm.IsServiceAccount,
		); err != nil {
			return nil, fmt.Errorf("scanning resource permission: %w", err)
		}
		permissions = append(permissions, perm)
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
		Scopes:     []string{mapper.Scope(grn.Name)},
		OrgID:      ns.OrgID,
		ActionSets: mapper.ActionSets(),
	}

	var assignments []rbacAssignment
	err = sql.DB.GetSqlxSession().WithTransaction(ctx, func(tx *session.SessionTx) error {
		assignments, err = s.getRbacAssignmentsWithTx(ctx, sql, tx, resourceQuery)
		return err
	})

	if len(assignments) == 0 {
		return nil, fmt.Errorf("resource permission %q: %w", resourceQuery.Scopes, errNotFound)
	}

	resourcePermission, err := s.toV0ResourcePermissions(assignments, ns.Value)
	if err != nil {
		return nil, err
	}
	if resourcePermission == nil {
		return nil, fmt.Errorf("resource permission %q: %w", resourceQuery.Scopes, errNotFound)
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
func (s *ResourcePermSqlBackend) buildRbacAssignments(ctx context.Context, ns types.NamespaceInfo, mapper Mapper, v0ResourcePerm []v0alpha1.ResourcePermissionspecPermission, rbacScope string) ([]rbacAssignmentCreate, error) {
	assignments := make([]rbacAssignmentCreate, 0, len(v0ResourcePerm))

	for _, perm := range v0ResourcePerm {
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
	if err := validateCreateAndUpdateInput(v0ResourcePerm, grn); err != nil {
		return 0, err
	}

	assignments, err := s.buildRbacAssignments(ctx, ns, mapper, v0ResourcePerm.Spec.Permissions, mapper.Scope(grn.Name))
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

func (s *ResourcePermSqlBackend) updateResourcePermission(ctx context.Context, dbHelper *legacysql.LegacyDatabaseHelper, ns types.NamespaceInfo, mapper Mapper, grn *groupResourceName, v0ResourcePerm *v0alpha1.ResourcePermission) (int64, error) {
	if err := validateCreateAndUpdateInput(v0ResourcePerm, grn); err != nil {
		return 0, err
	}

	currentPerms, err := s.getResourcePermission(ctx, dbHelper, ns, grn.string())
	if err != nil {
		if errors.Is(err, errNotFound) {
			return 0, fmt.Errorf("resource permissions not found: %w", errNotFound)
		}
		s.logger.Error("could not get resource permissions", "orgID", ns.OrgID, "scope", grn.Name, "error", err.Error())
		return 0, fmt.Errorf("could not get the existing resource permissions for resource %s", grn.Name)
	}

	// Diff the existing permissions with the desired ones
	permissionsToAdd := make([]v0alpha1.ResourcePermissionspecPermission, 0)
	permissionsToRemove := make([]v0alpha1.ResourcePermissionspecPermission, 0)

	for _, desired := range v0ResourcePerm.Spec.Permissions {
		found := false
		for _, existing := range currentPerms.Spec.Permissions {
			if desired.Name == existing.Name && desired.Kind == existing.Kind && desired.Verb == existing.Verb {
				found = true
				break
			}
		}
		if !found {
			permissionsToAdd = append(permissionsToAdd, desired)
		}
	}

	// Compile a list of permissions to remove
	for _, existing := range currentPerms.Spec.Permissions {
		found := false
		for _, desired := range v0ResourcePerm.Spec.Permissions {
			if desired.Name == existing.Name && desired.Kind == existing.Kind && desired.Verb == existing.Verb {
				found = true
				break
			}
		}
		if !found {
			permissionsToRemove = append(permissionsToRemove, existing)
		}
	}

	// Build the assignments to add/remove
	permsToAdd, err := s.buildRbacAssignments(ctx, ns, mapper, permissionsToAdd, mapper.Scope(grn.Name))
	if err != nil {
		return 0, err
	}

	permsToRemove, err := s.buildRbacAssignments(ctx, ns, mapper, permissionsToRemove, mapper.Scope(grn.Name))
	if err != nil {
		return 0, err
	}

	err = dbHelper.DB.GetSqlxSession().WithTransaction(ctx, func(tx *session.SessionTx) error {
		if len(permsToRemove) > 0 {
			for _, perm := range permsToRemove {
				removePermQuery, args, err := buildRemovePermissionQuery(dbHelper, perm.Scope, perm.Action, perm.RoleName, ns.OrgID)
				if err != nil {
					return err
				}
				_, err = tx.Exec(ctx, removePermQuery, args...)
				if err != nil {
					s.logger.Error("could not remove role permission", "scope", perm.Scope, "role", perm.RoleName, "error", err.Error())
					return fmt.Errorf("could not remove role permission")
				}

			}
		}

		if len(permsToAdd) > 0 {
			for _, assignment := range permsToAdd {
				if err := s.storeRbacAssignment(ctx, dbHelper, tx, ns.OrgID, assignment); err != nil {
					return err
				}
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

func validateCreateAndUpdateInput(v0ResourcePerm *v0alpha1.ResourcePermission, grn *groupResourceName) error {
	if v0ResourcePerm == nil {
		return fmt.Errorf("resource permission cannot be nil")
	}

	if len(v0ResourcePerm.Spec.Permissions) == 0 {
		return fmt.Errorf("resource permission must have at least one permission: %w", errInvalidSpec)
	}

	// Validate that the group/resource/name in the name matches the spec
	if grn.Group != v0ResourcePerm.Spec.Resource.ApiGroup ||
		grn.Resource != v0ResourcePerm.Spec.Resource.Resource ||
		grn.Name != v0ResourcePerm.Spec.Resource.Name {
		return fmt.Errorf("resource permission name does not match spec: %w", errInvalidSpec)
	}

	return nil
}

// Delete

// deleteResourcePermission deletes resource permissions for a single ResourcePermission resource referenced by its name in the format <group>-<resource>-<name> (e.g. dashboard.grafana.app-dashboards-ad5rwqs)
func (s *ResourcePermSqlBackend) deleteResourcePermission(ctx context.Context, sql *legacysql.LegacyDatabaseHelper, ns types.NamespaceInfo, name string) error {
	mapper, grn, err := s.splitResourceName(name)
	if err != nil {
		return err
	}
	scope := mapper.Scope(grn.Name)

	resourceQuery := &DeleteResourcePermissionsQuery{
		Scope: scope,
		OrgID: ns.OrgID,
	}

	rawQuery, args, err := buildDeleteResourcePermissionsQueryFromTemplate(sql, resourceQuery)
	if err != nil {
		return err
	}

	// run delete query
	_, err = sql.DB.GetSqlxSession().Exec(ctx, rawQuery, args...)
	if err != nil {
		s.logger.Error("could not delete resource permissions", "scope", scope, "orgID", ns.OrgID, err.Error())
		return fmt.Errorf("could not delete resource permission")
	}

	return nil
}
