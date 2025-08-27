package resourcepermission

import (
	"context"
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

// TODO: use mapper?
func actionSet(resource string, level string) string {
	return fmt.Sprintf("%s:%s", resource, level)
}

// TODO: use mapper?
func scope(resource string, name string) string {
	return fmt.Sprintf("%s:uid:%s", resource, name)
}

// getOrCreateManagedRole gets an existing managed role or creates a new one
func (s *ResourcePermSqlBackend) getOrCreateManagedRole(ctx context.Context, dbHelper *legacysql.LegacyDatabaseHelper, tx *session.SessionTx, orgID int64, roleName string, resourcePermissionName string) (int64, error) {
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

	// TODO better name
	type assignment struct {
		RoleName        string
		AssigneeID      string
		AssignmentTable string
		Action          string
	}

	assignments := make([]assignment, 0, len(v0ResourcePerm.Spec.Permissions))
	rbacScope := scope(v0ResourcePerm.Spec.Resource.Resource, v0ResourcePerm.Spec.Resource.Name)

	// Implement proper managed role pattern
	err := dbHelper.DB.GetSqlxSession().WithTransaction(ctx, func(tx *session.SessionTx) error {
		// TODO: For each grant
		//       Check the target managed role exists
		//          To do so, resolve the identity UID (user, team, service account) to its internal ID
		//       If not, create it
		//       If yes, remove its permissions for that resource
		//       Add the new permissions to the managed role
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
					return fmt.Errorf("resolving user %q to internal ID: %w", perm.Name, err)
				}
				if userID == nil {
					return fmt.Errorf("user %q not found: %w", perm.Name, errInvalidSpec)
				}
				assignments = append(assignments, assignment{
					RoleName:        fmt.Sprintf("managed:users:%d:permissions", userID.ID),
					AssigneeID:      fmt.Sprintf("%d", userID.ID),
					AssignmentTable: "user_role",
					Action:          rbacActionSet,
				})
			case v0alpha1.ResourcePermissionSpecPermissionKindTeam:
				teamID, err := s.identityStore.GetTeamInternalID(ctx, ns, legacy.GetTeamInternalIDQuery{
					UID:   perm.Name,
					OrgID: ns.OrgID,
				})
				if err != nil && !strings.Contains(err.Error(), "not found") {
					return fmt.Errorf("resolving team %q to internal ID: %w", perm.Name, err)
				}
				if teamID == nil {
					return fmt.Errorf("team %q not found: %w", perm.Name, errInvalidSpec)
				}
				assignments = append(assignments, assignment{
					RoleName:        fmt.Sprintf("managed:teams:%d:permissions", teamID.ID),
					AssigneeID:      fmt.Sprintf("%d", teamID.ID),
					AssignmentTable: "team_role",
					Action:          rbacActionSet,
				})
			case v0alpha1.ResourcePermissionSpecPermissionKindServiceAccount:
				saID, err := s.identityStore.GetServiceAccountInternalID(ctx, ns, legacy.GetServiceAccountInternalIDQuery{
					UID:   perm.Name,
					OrgID: ns.OrgID,
				})
				if err != nil && !strings.Contains(err.Error(), "not found") {
					return fmt.Errorf("resolving service account %q to internal ID: %w", perm.Name, err)
				}
				if saID == nil {
					return fmt.Errorf("service account %q not found: %w", perm.Name, errInvalidSpec)
				}
				assignments = append(assignments, assignment{
					RoleName:        fmt.Sprintf("managed:users:%d:permissions", saID.ID),
					AssigneeID:      fmt.Sprintf("%d", saID.ID),
					AssignmentTable: "user_role",
					Action:          rbacActionSet,
				})
			case v0alpha1.ResourcePermissionSpecPermissionKindBasicRole:
				assignments = append(assignments, assignment{
					RoleName:        fmt.Sprintf("managed:builtins:%s:permissions", perm.Name),
					AssigneeID:      perm.Name,
					AssignmentTable: "builtin_role",
					Action:          rbacActionSet,
				})
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
