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
	"github.com/grafana/grafana/pkg/registry/apis/iam/legacy"
	"github.com/grafana/grafana/pkg/services/sqlstore/session"
	"github.com/grafana/grafana/pkg/storage/legacysql"
	"github.com/grafana/grafana/pkg/util"
)

// List

// Get

// Create

// TODO: use mapper?
func actionSet(resource string, level string) string {
	return fmt.Sprintf("%s:%s", resource, level)
}

// TODO: use mapper?
func scope(resource string, name string) string {
	return fmt.Sprintf("%s:uid:%s", resource, name)
}

// createRoleAndAssign creates a new managed role and assigns it to the given user/team/service account/basic role
func (s *ResourcePermSqlBackend) createRoleAndAssign(ctx context.Context, tx *session.SessionTx, dbHelper *legacysql.LegacyDatabaseHelper, orgID int64, assignment grant) (int64, error) {
	// Create the managed role
	insertRoleQuery, args, err := buildInsertRoleQuery(dbHelper, orgID, "", assignment.RoleName)
	if err != nil {
		return 0, err
	}

	_, err = tx.Exec(ctx, insertRoleQuery, args...)
	if err != nil {
		return 0, fmt.Errorf("executing insert role query: %w", err)
	}

	var roleID int64
	idQuery := fmt.Sprintf("SELECT id FROM %s WHERE org_id = ? AND name = ?", dbHelper.Table("role"))
	err = tx.Get(ctx, &roleID, idQuery, orgID, assignment.RoleName)
	if err != nil {
		return 0, fmt.Errorf("retrieving id of created role: %w", err)
	}

	assignQuery, args, err := buildInsertAssignmentQuery(dbHelper, orgID, roleID, assignment)
	if err != nil {
		return 0, err
	}
	_, err = tx.Exec(ctx, assignQuery, args...)
	if err != nil {
		return 0, fmt.Errorf("executing insert assignment query: %w", err)
	}

	return roleID, nil
}

// handleAssignment ensures that a role exists for the given assignment, creates and assigns it if it doesn't
// and then ensures that the role has the correct permission for the given scope
func (s *ResourcePermSqlBackend) handleAssignment(ctx context.Context, dbHelper *legacysql.LegacyDatabaseHelper, tx *session.SessionTx, orgID int64, assignment grant) error {
	// Check if role already exists
	var roleID int64
	query := fmt.Sprintf("SELECT id FROM %s WHERE org_id = ? AND name = ?", dbHelper.Table("role"))
	err := tx.Get(ctx, &roleID, query, orgID, assignment.RoleName)
	if err != nil && !errors.Is(err, sql.ErrNoRows) {
		return fmt.Errorf("checking for existing role: %w", err)
	}

	// Role doesn't exist, create it
	if roleID == 0 {
		roleID, err = s.createRoleAndAssign(ctx, tx, dbHelper, orgID, assignment)
		if err != nil {
			return err
		}
	}

	// Remove any existing permission for that resource
	deletePermQuery, args, err := buildDeletePermissionQuery(dbHelper, roleID, assignment.Scope)
	if err != nil {
		return err
	}
	_, err = tx.Exec(ctx, deletePermQuery, args...)
	if err != nil {
		s.logger.Error("deleting existing permission", "roleID", roleID, "scope", assignment.Scope, "error", err)
		return fmt.Errorf("could not delete role permissions")
	}

	// Add the new permission
	insertPermQuery, args, err := buildInsertPermissionQuery(dbHelper, roleID, assignment.permission())
	if err != nil {
		return err
	}
	_, err = tx.Exec(ctx, insertPermQuery, args...)
	if err != nil {
		s.logger.Error("inserting new permission", "roleID", roleID, "scope", assignment.Scope, "error", err)
		return fmt.Errorf("could not insert role permission")
	}

	return nil
}

// buildRbacAssignments builds the list of grants (role assignments and permissions) for a given ResourcePermission spec
// It resolves user/team/service account UIDs to internal IDs for the role name and assignee ID
func (s *ResourcePermSqlBackend) buildRbacAssignments(ctx context.Context, ns types.NamespaceInfo, v0ResourcePerm *v0alpha1.ResourcePermission, rbacScope string) ([]grant, error) {
	assignments := make([]grant, 0, len(v0ResourcePerm.Spec.Permissions))

	for _, perm := range v0ResourcePerm.Spec.Permissions {
		// TODO: For now, only one verb per permission is supported
		//       We should modify the spec to reflect that
		rbacActionSet := actionSet(v0ResourcePerm.Spec.Resource.Resource, perm.Verbs[0])
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
			assignments = append(assignments, grant{
				RoleName:         fmt.Sprintf("managed:users:%d:permissions", userID.ID),
				AssignmentTable:  "user_role",
				AssignmentColumn: "user_id",
				AssigneeID:       fmt.Sprintf("%d", userID.ID),
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
			assignments = append(assignments, grant{
				RoleName:         fmt.Sprintf("managed:teams:%d:permissions", teamID.ID),
				AssignmentTable:  "team_role",
				AssignmentColumn: "team_id",
				AssigneeID:       fmt.Sprintf("%d", teamID.ID),
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
			assignments = append(assignments, grant{
				RoleName:         fmt.Sprintf("managed:users:%d:permissions", saID.ID),
				AssignmentTable:  "user_role",
				AssignmentColumn: "user_id",
				AssigneeID:       fmt.Sprintf("%d", saID.ID),
				Action:           rbacActionSet,
				Scope:            rbacScope,
			})
		case v0alpha1.ResourcePermissionSpecPermissionKindBasicRole:
			assignments = append(assignments, grant{
				RoleName:         fmt.Sprintf("managed:builtins:%s:permissions", perm.Name),
				AssignmentTable:  "builtin_role",
				AssignmentColumn: "role",
				AssigneeID:       perm.Name,
				Action:           rbacActionSet,
				Scope:            rbacScope,
			})
		}
	}

	return assignments, nil
}

func (s *ResourcePermSqlBackend) createResourcePermission(ctx context.Context, dbHelper *legacysql.LegacyDatabaseHelper, ns types.NamespaceInfo, v0ResourcePerm *v0alpha1.ResourcePermission) (int64, error) {
	if v0ResourcePerm == nil {
		return 0, fmt.Errorf("resource permission cannot be nil")
	}

	if v0ResourcePerm.Name == "" {
		if v0ResourcePerm.GenerateName == "" {
			return 0, errEmptyName
		}
		rand, err := util.GetRandomString(10)
		if err != nil {
			return 0, fmt.Errorf("generating random string for resource permission name: %w", err)
		}
		v0ResourcePerm.Name = v0ResourcePerm.GenerateName + rand
	}

	if len(v0ResourcePerm.Spec.Permissions) == 0 {
		return 0, fmt.Errorf("resource permission must have at least one permission: %w", errInvalidSpec)
	}

	rbacScope := scope(v0ResourcePerm.Spec.Resource.Resource, v0ResourcePerm.Spec.Resource.Name)

	assignments, err := s.buildRbacAssignments(ctx, ns, v0ResourcePerm, rbacScope)
	if err != nil {
		return 0, err
	}

	// Implement proper managed role pattern
	err = dbHelper.DB.GetSqlxSession().WithTransaction(ctx, func(tx *session.SessionTx) error {
		for _, assignment := range assignments {
			err := s.handleAssignment(ctx, dbHelper, tx, ns.OrgID, assignment)
			if err != nil {
				return err
			}
		}

		return nil
	})

	if err != nil {
		return 0, err
	}

	// Return a timestamp as resource version
	// TODO should we return the latest updated managed role?
	// Not sure since it could have effectively been updated for another resource than the one at stake.
	return int64(time.Now().UnixMilli()), nil
}

// Update

// Delete
