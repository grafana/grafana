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

	// TODO: will be implemented in the follow up PR related to the issue https://github.com/grafana/identity-access-team/issues/2436
	// The current request contract cannot distinguish global evaluation from
	// evaluation in the requester's namespace.
	if user.GetOrgID() == accesscontrol.NoOrgID {
		return nil, errors.New("legacy check does not yet support global evaluation")
	}

	expression, err := accesscontrol.ToLegacyExpression(evaluator)
	if err != nil {
		return nil, fmt.Errorf("converting evaluator to legacy expression: %w", err)
	}

	namespace := user.GetNamespace()
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
	}, nil
}
