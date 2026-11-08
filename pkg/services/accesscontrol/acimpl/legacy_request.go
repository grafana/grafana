package acimpl

import (
	"errors"
	"maps"
	"slices"

	"github.com/grafana/authlib/types"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/authz/legacyclient"
)

const legacyGlobalNamespaceAnchorOrgID int64 = 1

func (a *AccessControl) buildLegacyCheckRequest(
	user identity.Requester,
	evaluator accesscontrol.Evaluator,
	useExternalGroups bool,
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

	permissions := user.GetPermissions()
	var global *legacyclient.LegacyGlobalEvaluation
	if user.GetOrgID() == accesscontrol.NoOrgID || user.GetOrgID() == accesscontrol.GlobalOrgID {
		permissions = user.GetGlobalPermissions()
		global = &legacyclient.LegacyGlobalEvaluation{
			RequesterOrgID: user.GetOrgID(),
		}
		// Global org IDs describe requester state. Use the configured instance
		// namespace for transport; evaluation still uses global grants.
		if namespace == "" || namespace == types.OrgNamespaceFormatter(user.GetOrgID()) {
			namespace = namespaceMapper(legacyGlobalNamespaceAnchorOrgID)
		}
	}
	if namespace == "" {
		namespace = namespaceMapper(user.GetOrgID())
	}

	groups := user.GetGroups()
	if useExternalGroups {
		groups = user.GetExternalGroups()
	}

	return legacyclient.LegacyCheckRequest{
		Namespace:           namespace,
		Subject:             user.GetUID(),
		Evaluator:           evaluator,
		Teams:               slices.Clone(groups),
		SkipScopeResolution: a.skipScopeResolution,
		GlobalEvaluation:    global,
		// Preserve authentication filtering when AuthZ reloads grants and resolver dependencies.
		Restriction: &legacyclient.LegacyActionRestriction{Actions: slices.Sorted(maps.Keys(permissions))},
	}, nil
}
