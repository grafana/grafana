package acimpl

import (
	"errors"
	"fmt"
	"slices"

	"github.com/grafana/authlib/types"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	authzextv1 "github.com/grafana/grafana/pkg/services/authz/proto/v1"
)

func (a *AccessControl) buildLegacyCheckRequest(
	user identity.Requester,
	evaluator accesscontrol.Evaluator,
	useExternalGroups bool,
) (*authzextv1.LegacyCheckRequest, error) {
	if user == nil || user.IsNil() {
		return nil, errors.New("legacy check requester is required")
	}

	expression, err := accesscontrol.ToLegacyExpression(evaluator)
	if err != nil {
		return nil, fmt.Errorf("converting evaluator to legacy expression: %w", err)
	}

	namespace := user.GetNamespace()
	var global *authzextv1.LegacyGlobalEvaluation
	if user.GetOrgID() == accesscontrol.NoOrgID || user.GetOrgID() == accesscontrol.GlobalOrgID {
		global = &authzextv1.LegacyGlobalEvaluation{
			RequesterOrgId: user.GetOrgID(),
			HasPermissions: len(user.GetGlobalPermissions()) > 0,
		}
		// A self-managed sentinel is requester state, not a tenant. The anchor
		// selects the same embedded instance; evaluation still uses global grants.
		if namespace == "" || namespace == types.OrgNamespaceFormatter(user.GetOrgID()) {
			namespace = types.OrgNamespaceFormatter(1)
		}
	}
	if namespace == "" {
		namespace = types.OrgNamespaceFormatter(user.GetOrgID())
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
