package resourcepermission

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"strings"
	"time"

	apierrors "k8s.io/apimachinery/pkg/api/errors"
	"k8s.io/apimachinery/pkg/runtime/schema"

	"github.com/grafana/authlib/types"
	"github.com/grafana/grafana/apps/iam/pkg/apis/iam/v0alpha1"
	"github.com/grafana/grafana/pkg/registry/apis/iam/common"
	"github.com/grafana/grafana/pkg/registry/apis/iam/datasourcek8s"
	"github.com/grafana/grafana/pkg/registry/apis/iam/legacy"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/sqlstore/session"
	"github.com/grafana/grafana/pkg/storage/legacysql"
)

// resolveScope returns the legacy DB scope for the given resource name.
// For resources with a registered NameResolver (e.g. service accounts), calls UIDToID via the
// K8s API — mode-agnostic and fails fast on lookup failure. For other id-scoped resources
// (teams, users) falls back to the identity store.
func resolveScope(ctx context.Context, ns types.NamespaceInfo, store IdentityStore, resolver NameResolver, mapper Mapper, name string) (string, error) {
	if resolver != nil {
		id, err := resolver.UIDToID(ctx, ns.Value, name)
		if err != nil {
			return "", err
		}
		return mapper.Scope(id), nil
	}
	scope := mapper.Scope(name)
	if isIDScoped(mapper) && store != nil {
		return legacy.ResolveUIDScopeForWrite(ctx, store, ns, scope)
	}
	return scope, nil
}

// List
func (s *ResourcePermSqlBackend) newRoleIterator(ctx context.Context, dbHelper *legacysql.LegacyDatabaseHelper, ns types.NamespaceInfo, pagination *common.Pagination) (*listIterator, error) {
	var (
		scope string

		actionSets    = s.mappers.EnabledActionSets()
		scopePatterns = s.mappers.EnabledScopePatterns()

		assignments = make([]rbacAssignment, 0, 8)
		scopes      = make([]string, 0, 8)
	)

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

	v0ResourcePermissions, err := s.toV0ResourcePermissions(ctx, ns, assignments)
	if err != nil {
		return nil, err
	}

	return &listIterator{
		resourcePermissions: v0ResourcePermissions,
		initOffset:          pagination.Continue,
	}, nil
}

func (s *ResourcePermSqlBackend) latestUpdate(ctx context.Context, dbHelper *legacysql.LegacyDatabaseHelper, ns types.NamespaceInfo) int64 {
	scopePatterns := s.mappers.EnabledScopePatterns()
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

// getRbacAssignmentsWithTx queries resource permissions based on the provided ListResourcePermissionsQuery and groups them by resource (e.g. {folder.grafana.app, folders, fold1})
func (s *ResourcePermSqlBackend) getRbacAssignmentsWithTx(ctx context.Context, dbHelper *legacysql.LegacyDatabaseHelper, tx *session.SessionTx, query *ListResourcePermissionsQuery) ([]rbacAssignment, error) {
	rawQuery, args, err := buildListResourcePermissionsQueryFromTemplate(dbHelper, query, true)
	if err != nil {
		return nil, err
	}

	rows, err := tx.Query(ctx, rawQuery, args...)
	if err != nil {
		if rows != nil {
			_ = rows.Close()
		}
		if isDatasourceTypeColumnMissing(err) {
			return s.getRbacAssignmentsNoDsTypeWithTx(ctx, dbHelper, tx, query)
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
			&perm.SubjectUID, &perm.SubjectType, &perm.IsServiceAccount, &perm.DatasourceType,
		); err != nil {
			return nil, fmt.Errorf("scanning resource permission: %w", err)
		}
		permissions = append(permissions, perm)
	}

	return permissions, nil
}

// getRbacAssignmentsNoDsTypeWithTx is a fallback for databases where the datasource_type
// column does not yet exist in the permission table (e.g. before the migration runs).
func (s *ResourcePermSqlBackend) getRbacAssignmentsNoDsTypeWithTx(ctx context.Context, dbHelper *legacysql.LegacyDatabaseHelper, tx *session.SessionTx, query *ListResourcePermissionsQuery) ([]rbacAssignment, error) {
	rawQuery, args, err := buildListResourcePermissionsQueryFromTemplate(dbHelper, query, false)
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

// isDatasourceTypeColumnMissing returns true when the error indicates that the
// datasource_type column does not exist in the database (pre-migration state).
func isDatasourceTypeColumnMissing(err error) bool {
	if err == nil {
		return false
	}
	msg := strings.ToLower(err.Error())
	return strings.Contains(msg, "datasource_type") &&
		(strings.Contains(msg, "unknown column") ||
			strings.Contains(msg, "does not exist") ||
			strings.Contains(msg, "no such column"))
}

// getResourcePermission retrieves a single ResourcePermission by its name in the format <group>-<resource>-<name> (e.g. dashboard.grafana.app-dashboards-ad5rwqs)
func (s *ResourcePermSqlBackend) getResourcePermission(ctx context.Context, sql *legacysql.LegacyDatabaseHelper, tx *session.SessionTx, ns types.NamespaceInfo, name string) (*v0alpha1.ResourcePermission, error) {
	grn, err := splitResourceName(name)
	if err != nil {
		return nil, apierrors.NewInternalError(err)
	}

	mapper, err := s.getResourceMapper(grn.Group, grn.Resource)
	if err != nil {
		return nil, apierrors.NewInternalError(err)
	}

	resolver, _ := s.mappers.GetResolver(schema.GroupResource{Group: grn.Group, Resource: grn.Resource})
	scope, err := resolveScope(ctx, ns, s.identityStore, resolver, mapper, grn.Name)
	if err != nil {
		return nil, apierrors.NewBadRequest(fmt.Sprintf("resolving scope for %q: %v", grn.Name, err))
	}

	resourceQuery := &ListResourcePermissionsQuery{
		Scopes:     []string{scope},
		OrgID:      ns.OrgID,
		ActionSets: mapper.ActionSets(),
	}

	assignments, err := s.getRbacAssignmentsWithTx(ctx, sql, tx, resourceQuery)
	if err != nil {
		return nil, apierrors.NewInternalError(err)
	}

	if len(assignments) == 0 {
		return nil, apierrors.NewNotFound(v0alpha1.ResourcePermissionInfo.GroupResource(), name)
	}

	resourcePermission, err := s.toV0ResourcePermissions(ctx, ns, assignments)
	if err != nil {
		return nil, apierrors.NewInternalError(err)
	}
	if len(resourcePermission) == 0 {
		return nil, apierrors.NewNotFound(v0alpha1.ResourcePermissionInfo.GroupResource(), name)
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
// datasourceType is the plugin type (e.g. "loki") extracted from the resource group; empty for non-datasource resources.
func (s *ResourcePermSqlBackend) buildRbacAssignments(ctx context.Context, ns types.NamespaceInfo, mapper Mapper, v0ResourcePerm []v0alpha1.ResourcePermissionspecPermission, rbacScope, datasourceType string) ([]rbacAssignmentCreate, error) {
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
				DatasourceType:   datasourceType,
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
				DatasourceType:   datasourceType,
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
				DatasourceType:   datasourceType,
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
				DatasourceType:   datasourceType,
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
	resolver, _ := s.mappers.GetResolver(schema.GroupResource{Group: grn.Group, Resource: grn.Resource})
	rbacScope, err := resolveScope(ctx, ns, s.identityStore, resolver, mapper, grn.Name)
	if err != nil {
		return 0, apierrors.NewBadRequest(fmt.Sprintf("resolving scope for %q: %v", grn.Name, err))
	}

	assignments, err := s.buildRbacAssignments(ctx, ns, mapper, v0ResourcePerm.Spec.Permissions, rbacScope, datasourcek8s.DSTypeFromDatasourceAPIGroup(grn.Group))
	if err != nil {
		return 0, err
	}

	err = dbHelper.DB.GetSqlxSession().WithTransaction(ctx, func(tx *session.SessionTx) error {
		// Check if a resource permission for the same resource already exists
		if err = s.existsResourcePermission(ctx, tx, dbHelper, ns.OrgID, rbacScope); err != nil {
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

func (s *ResourcePermSqlBackend) updateResourcePermission(ctx context.Context, dbHelper *legacysql.LegacyDatabaseHelper, ns types.NamespaceInfo, mapper Mapper, grn *groupResourceName, v0ResourcePerm *v0alpha1.ResourcePermission) (int64, error) {
	err := dbHelper.DB.GetSqlxSession().WithTransaction(ctx, func(tx *session.SessionTx) error {
		currentPerms, err := s.getResourcePermission(ctx, dbHelper, tx, ns, grn.string())
		if err != nil {
			if apierrors.IsNotFound(err) {
				return apierrors.NewNotFound(v0alpha1.ResourcePermissionInfo.GroupResource(), grn.string())
			}
			s.logger.Error("could not get resource permissions", "orgID", ns.OrgID, "scope", grn.Name, "error", err.Error())
			return fmt.Errorf("could not get the existing resource permissions for resource %s", grn.Name)
		}

		permissionsToAdd, permissionsToRemove := diffPermissions(currentPerms.Spec.Permissions, v0ResourcePerm.Spec.Permissions)
		resolver, _ := s.mappers.GetResolver(schema.GroupResource{Group: grn.Group, Resource: grn.Resource})
		rbacScope, err := resolveScope(ctx, ns, s.identityStore, resolver, mapper, grn.Name)
		if err != nil {
			return fmt.Errorf("resolving scope for %q: %w", grn.Name, err)
		}

		if len(permissionsToRemove) > 0 {
			permsToRemove, err := s.buildRbacAssignments(ctx, ns, mapper, permissionsToRemove, rbacScope, datasourcek8s.DSTypeFromDatasourceAPIGroup(grn.Group))
			if err != nil {
				return err
			}

			for _, perm := range permsToRemove {
				resourceQuery := &DeleteResourcePermissionsQuery{
					Scope:    perm.Scope,
					OrgID:    ns.OrgID,
					RoleName: perm.RoleName,
				}

				removePermQuery, args, err := buildDeleteResourcePermissionsQueryFromTemplate(dbHelper, resourceQuery)
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

		if len(permissionsToAdd) > 0 {
			permsToAdd, err := s.buildRbacAssignments(ctx, ns, mapper, permissionsToAdd, rbacScope, datasourcek8s.DSTypeFromDatasourceAPIGroup(grn.Group))
			if err != nil {
				return err
			}

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

func diffPermissions(currentPermissions, desiredPermissions []v0alpha1.ResourcePermissionspecPermission) (permissionsToAdd, permissionsToRemove []v0alpha1.ResourcePermissionspecPermission) {
	for _, desired := range desiredPermissions {
		found := false
		for _, existing := range currentPermissions {
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
	for _, existing := range currentPermissions {
		found := false
		for _, desired := range desiredPermissions {
			if desired.Name == existing.Name && desired.Kind == existing.Kind && desired.Verb == existing.Verb {
				found = true
				break
			}
		}
		if !found {
			permissionsToRemove = append(permissionsToRemove, existing)
		}
	}

	return permissionsToAdd, permissionsToRemove
}

// deleteResourcePermission deletes resource permissions for a single ResourcePermission resource referenced by its name in the format <group>-<resource>-<name> (e.g. dashboard.grafana.app-dashboards-ad5rwqs)
func (s *ResourcePermSqlBackend) deleteResourcePermission(ctx context.Context, sql *legacysql.LegacyDatabaseHelper, ns types.NamespaceInfo, name string) error {
	grn, err := splitResourceName(name)
	if err != nil {
		return err
	}

	mapper, err := s.getResourceMapper(grn.Group, grn.Resource)
	if err != nil {
		return err
	}

	resolver, _ := s.mappers.GetResolver(schema.GroupResource{Group: grn.Group, Resource: grn.Resource})
	scope, err := resolveScope(ctx, ns, s.identityStore, resolver, mapper, grn.Name)
	if err != nil {
		return fmt.Errorf("resolving scope for %q: %w", grn.Name, err)
	}
	resourceQuery := &DeleteResourcePermissionsQuery{
		Scope: scope,
		OrgID: ns.OrgID,
	}

	rawQuery, args, err := buildDeleteResourcePermissionsQueryFromTemplate(sql, resourceQuery)
	if err != nil {
		return err
	}

	_, err = sql.DB.GetSqlxSession().Exec(ctx, rawQuery, args...)
	if err != nil {
		s.logger.Error("could not delete resource permissions", "scope", scope, "orgID", ns.OrgID, err.Error())
		return fmt.Errorf("could not delete resource permission")
	}

	return nil
}

// ListDirectPermissionsForSubject returns all direct resource permissions (dashboard/folder level) for the given subject UID (team or user) in the namespace (org).
// Used by the ResourcePermissions search subresource
func (s *ResourcePermSqlBackend) ListDirectPermissionsForSubject(ctx context.Context, namespace, subjectUID string) ([]v0alpha1.PermissionSpec, error) {
	if subjectUID == "" {
		return nil, nil
	}
	ns, err := types.ParseNamespace(namespace)
	if err != nil {
		return nil, fmt.Errorf("parse namespace: %w", err)
	}
	if ns.OrgID <= 0 {
		return nil, errInvalidNamespace
	}
	logger := s.logger.FromContext(ctx)
	dbHelper, err := s.dbProvider(ctx)
	if err != nil {
		if errors.Is(err, legacysql.ErrNamespaceNotFound) {
			logger.Warn("Namespace not found", "error", err)
			return nil, apierrors.NewNotFound(v0alpha1.ResourcePermissionInfo.GroupResource(), namespace)
		}
		logger.Error("Failed to get database helper", "error", err)
		return nil, errDatabaseHelper
	}
	actionSets := s.mappers.EnabledActionSets()
	var assignments []rbacAssignment
	err = dbHelper.DB.GetSqlxSession().WithTransaction(ctx, func(tx *session.SessionTx) error {
		assignments, err = s.getRbacAssignmentsWithTx(ctx, dbHelper, tx, &ListResourcePermissionsQuery{
			OrgID:      ns.OrgID,
			ActionSets: actionSets,
			SubjectUID: subjectUID,
		})
		return err
	})
	if err != nil {
		return nil, err
	}
	result := make([]v0alpha1.PermissionSpec, 0, len(assignments))
	for _, a := range assignments {
		grn, err := s.mappers.ParseScopeCtx(ctx, ns, s.identityStore, a.Scope, a.DatasourceType)
		if err != nil {
			logger.Warn("Dropping permission with unresolvable scope", "scope", a.Scope, "action", a.Action, "error", err)
			continue
		}
		result = append(result, v0alpha1.PermissionSpec{
			Action: a.Action,
			Scope:  grn.Resource + ":uid:" + grn.Name,
		})
	}
	return result, nil
}
