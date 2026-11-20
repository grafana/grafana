package legacypermissions

import (
	"context"
	"errors"
	"fmt"
	"slices"

	"github.com/open-feature/go-sdk/openfeature"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	ac "github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
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

	defaultValue := false
	settings := loadSettings{
		enforcementEnabled: l.license.FeatureEnabled("accesscontrol.enforcement"),
		excludeRedundantManagedPermissions: l.openFeatureClient.Boolean(
			ctx,
			featuremgmt.FlagExcludeRedundantManagedPermissions,
			defaultValue,
			openfeature.TransactionContext(ctx),
		),
	}

	query := queryFor(ac.GlobalOrgID, settings)
	userID, err := internalID(user)
	if err != nil {
		return nil, fmt.Errorf("get internal ID: %w", err)
	}

	query.UserID = userID
	query.Roles = ac.GetOrgRoles(user)

	baseline := []ac.Permission{sharedWithMe()}
	if !settings.enforcementEnabled {
		baseline = append(baseline, l.catalog.Permissions(query.Roles...)...)
	}

	permissions := make(map[string][]string, len(actions))
	for _, action := range actions {
		matchingActions := append(slices.Clone(l.actions.ResolveAction(action)), action)
		stored, err := l.store.permissionsForActions(ctx, query, matchingActions)
		if err != nil {
			return nil, fmt.Errorf("get permissions for actions: %w", err)
		}

		grants := append(l.actions.ExpandActionSets(stored), baseline...)
		for _, grant := range grants {
			if grant.Action == action {
				permissions[action] = append(permissions[action], grant.Scope)
			}
		}
	}

	return permissions, nil
}
