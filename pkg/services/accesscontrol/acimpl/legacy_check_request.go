package acimpl

import (
	"errors"
	"maps"
	"slices"

	"github.com/grafana/authlib/types"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/authn"
	"github.com/grafana/grafana/pkg/services/authz/legacyclient"
	"github.com/grafana/grafana/pkg/services/user"
)

const legacyGlobalNamespaceAnchorOrgID int64 = 1

func (a *AccessControl) buildLegacyCheckRequest(
	user identity.Requester,
	evaluator accesscontrol.Evaluator,
	namespaceMapper types.NamespaceFormatter,
) (legacyclient.LegacyCheckRequest, error) {
	if user == nil || user.IsNil() {
		return legacyclient.LegacyCheckRequest{}, errors.New("legacy check requester is required")
	}

	namespace := user.GetNamespace()
	var internal *legacyclient.LegacyInternalIdentity
	if profile, ok := identity.InternalIdentityProfileFor(user); ok {
		internal = &legacyclient.LegacyInternalIdentity{Profile: legacyclient.LegacyInternalIdentityProfile(profile)}
	} else if name, ok := accesscontrol.BackgroundUserName(user); ok {
		permissions := make(map[string][]string, len(user.GetPermissions()))
		for action, scopes := range user.GetPermissions() {
			permissions[action] = slices.Clone(scopes)
		}

		internal = &legacyclient.LegacyInternalIdentity{
			Background: &legacyclient.LegacyBackgroundIdentity{
				Name:        name,
				OrgRole:     string(user.GetOrgRole()),
				Permissions: permissions,
			},
		}
	}

	if internal != nil {
		if namespace == "" || namespace == "*" {
			if user.GetOrgID() < 1 || namespaceMapper == nil {
				return legacyclient.LegacyCheckRequest{}, errors.New("internal legacy check requires a concrete target namespace")
			}
			namespace = namespaceMapper(user.GetOrgID())
		}

		parsedNamespace, err := types.ParseNamespace(namespace)
		if err != nil || parsedNamespace.OrgID < 1 {
			return legacyclient.LegacyCheckRequest{}, errors.New("internal legacy check requires a concrete target namespace")
		}

		return legacyclient.LegacyCheckRequest{
			Namespace:           parsedNamespace.Value,
			InternalIdentity:    internal,
			Evaluator:           evaluator,
			SkipScopeResolution: a.skipScopeResolution,
		}, nil
	}

	requesterOrgID := user.GetOrgID()
	permissions := user.GetPermissions()
	if user.GetOrgID() == accesscontrol.NoOrgID || user.GetOrgID() == accesscontrol.GlobalOrgID {
		permissions = user.GetGlobalPermissions()
		// Global org IDs describe requester state. Use the configured instance
		// namespace for transport; evaluation still uses global grants.
		if namespace == "" || namespace == types.OrgNamespaceFormatter(user.GetOrgID()) {
			namespace = namespaceMapper(legacyGlobalNamespaceAnchorOrgID)
		}
	}
	if namespace == "" {
		namespace = namespaceMapper(user.GetOrgID())
	}

	return legacyclient.LegacyCheckRequest{
		Namespace:           namespace,
		RequesterOrgID:      &requesterOrgID,
		Subject:             user.GetUID(),
		Evaluator:           evaluator,
		TeamIDs:             legacyCheckTeamIDs(user),
		SkipScopeResolution: a.skipScopeResolution,
		// Preserve authentication filtering when AuthZ reloads grants and resolver dependencies.
		Restriction: &legacyclient.LegacyActionRestriction{Actions: slices.Sorted(maps.Keys(permissions))},
	}, nil
}

func legacyCheckTeamIDs(requester identity.Requester) []int64 {
	if requester.GetOrgID() < 1 || !requester.IsIdentityType(types.TypeUser, types.TypeServiceAccount) {
		return nil
	}

	// These requesters carry legacy memberships. Other implementations, including
	// StaticRequester, may return an empty slice without knowing their memberships.
	switch requester.(type) {
	case *user.SignedInUser, *authn.Identity:
		return slices.Clone(requester.GetTeams())
	default:
		return nil
	}
}
