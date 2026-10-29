package acimpl

import (
	"errors"
	"fmt"
	"maps"
	"slices"

	"github.com/grafana/authlib/types"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	authzextv1 "github.com/grafana/grafana/pkg/services/authz/proto/v1"
)

const legacyGlobalNamespaceAnchorOrgID int64 = 1

func (a *AccessControl) buildLegacyCheckRequest(
	user identity.Requester,
	evaluator accesscontrol.Evaluator,
	useExternalGroups bool,
	namespaceMapper types.NamespaceFormatter,
) (*authzextv1.LegacyCheckRequest, error) {
	if user == nil || user.IsNil() {
		return nil, errors.New("legacy check requester is required")
	}

	expression, err := accesscontrol.ToLegacyExpression(evaluator)
	if err != nil {
		return nil, fmt.Errorf("converting evaluator to legacy expression: %w", err)
	}

	namespace := user.GetNamespace()
	if profile, ok := identity.InternalIdentityProfileFor(user); ok {
		if namespace == "" || namespace == "*" {
			if user.GetOrgID() < 1 || namespaceMapper == nil {
				return nil, errors.New("internal legacy check requires a concrete target namespace")
			}
			namespace = namespaceMapper(user.GetOrgID())
		}

		parsedNamespace, err := types.ParseNamespace(namespace)
		if err != nil || parsedNamespace.OrgID < 1 {
			return nil, errors.New("internal legacy check requires a concrete target namespace")
		}

		return &authzextv1.LegacyCheckRequest{
			Namespace:           parsedNamespace.Value,
			InternalIdentity:    &authzextv1.LegacyInternalIdentity{Profile: profile.String()},
			Expression:          expression,
			SkipScopeResolution: a.skipScopeResolution,
		}, nil
	}

	var global *authzextv1.LegacyGlobalEvaluation
	if user.GetOrgID() == accesscontrol.NoOrgID || user.GetOrgID() == accesscontrol.GlobalOrgID {
		permissions := user.GetGlobalPermissions()
		global = &authzextv1.LegacyGlobalEvaluation{
			RequesterOrgId:   user.GetOrgID(),
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

	return &authzextv1.LegacyCheckRequest{
		Namespace:           namespace,
		Subject:             user.GetUID(),
		Expression:          expression,
		Teams:               slices.Clone(groups),
		SkipScopeResolution: a.skipScopeResolution,
		GlobalEvaluation:    global,
	}, nil
}
