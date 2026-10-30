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
	if profile, ok := identity.InternalIdentityProfileFor(user); ok {
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
			InternalIdentity:    &legacyclient.LegacyInternalIdentity{Profile: legacyclient.LegacyInternalIdentityProfile(profile)},
			Evaluator:           evaluator,
			SkipScopeResolution: a.skipScopeResolution,
		}, nil
	}

	var global *legacyclient.LegacyGlobalEvaluation
	if user.GetOrgID() == accesscontrol.NoOrgID || user.GetOrgID() == accesscontrol.GlobalOrgID {
		permissions := user.GetGlobalPermissions()
		global = &legacyclient.LegacyGlobalEvaluation{
			RequesterOrgID:   user.GetOrgID(),
			PermittedActions: slices.Sorted(maps.Keys(permissions)),
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
	}, nil
}
