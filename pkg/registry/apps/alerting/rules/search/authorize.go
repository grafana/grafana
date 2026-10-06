package search

import (
	"context"

	"k8s.io/apiserver/pkg/authorization/authorizer"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
)

const HybridRouteResource = "search"

// Authorize gates hybrid search on rule-read access. Unified storage enforces
// per-folder/per-rule access on the results.
func Authorize(ctx context.Context, ac accesscontrol.AccessControl, attr authorizer.Attributes) (authorizer.Decision, string, error) {
	if attr.GetResource() != HybridRouteResource {
		return authorizer.DecisionNoOpinion, "", nil
	}
	user, err := identity.GetRequester(ctx)
	if err != nil {
		return authorizer.DecisionDeny, "valid user is required", err
	}
	ok, err := ac.Evaluate(ctx, user, accesscontrol.EvalPermission(accesscontrol.ActionAlertingRuleRead))
	if ok {
		return authorizer.DecisionAllow, "", nil
	}
	return authorizer.DecisionDeny, "", err
}
