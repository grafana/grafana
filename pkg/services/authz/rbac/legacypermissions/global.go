package legacypermissions

import (
	"context"
	"errors"
	"fmt"
	"slices"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	ac "github.com/grafana/grafana/pkg/services/accesscontrol"
)

// GetGlobalUserPermissions loads only the requested legacy actions using the
// same source policy as global enumeration. Zanzana grants are excluded.
func (l *Loader) GetGlobalUserPermissions(
	ctx context.Context,
	user identity.Requester,
	actions []string,
) (map[string][]string, error) {
	if user.GetOrgID() != ac.GlobalOrgID {
		return nil, errors.New("global permission loading requires org zero")
	}

	settings := l.settings(ctx)

	query := queryFor(ac.GlobalOrgID, settings)
	userID, err := internalID(user)
	if err != nil {
		return nil, fmt.Errorf("get internal ID: %w", err)
	}

	query.UserID = userID
	query.Roles = ac.GetOrgRoles(user)

	queries := []ac.GetUserPermissionsQuery{query}
	if l.cfg.RBAC.PermissionCache && user.HasUniqueId() {
		basic := basicRoleQueryFor(ac.GlobalOrgID, settings)
		assigned := cachedAssignmentQueryFor(ac.GlobalOrgID, settings)
		if basic.ExcludeRedundantManagedPermissions == assigned.ExcludeRedundantManagedPermissions {
			queries[0].ExcludeRedundantManagedPermissions = basic.ExcludeRedundantManagedPermissions
		} else {
			// Cached OSS enumeration filters user grants but retains basic-role
			// grants. Separate their queries only when their policies differ.
			basic.Roles = query.Roles
			assigned.UserID = userID
			queries = []ac.GetUserPermissionsQuery{basic, assigned}
		}
	}

	baseline := []ac.Permission{sharedWithMe()}
	if !settings.enforcementEnabled {
		baseline = append(baseline, l.catalog.Permissions(query.Roles...)...)
	}

	permissions := make(map[string][]string, len(actions))
	for _, action := range actions {
		matchingActions := append(slices.Clone(l.actions.ResolveAction(action)), action)
		grants := slices.Clone(baseline)
		for _, query := range queries {
			stored, err := l.store.permissionsForActions(ctx, query, matchingActions)
			if err != nil {
				return nil, fmt.Errorf("get permissions for actions: %w", err)
			}
			grants = append(grants, l.actions.ExpandActionSets(stored)...)
		}
		for _, grant := range grants {
			if grant.Action == action {
				permissions[action] = append(permissions[action], grant.Scope)
			}
		}
	}

	return permissions, nil
}
