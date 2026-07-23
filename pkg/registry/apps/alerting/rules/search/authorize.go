package search

import (
	"context"

	"k8s.io/apiserver/pkg/authorization/authorizer"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
)

// RouteResource is the resource segment of the namespaced search route
// (/search), as seen by the apiserver authorizer.
const RouteResource = "search"

// Authorize gates the rule search route on rule-read access, consistent with
// listing rules. Per-folder/per-rule access is still enforced by each backend
// (the provisioning service for legacy, the access client for unified), so this
// is the coarse route-level check.
func Authorize(ctx context.Context, ac accesscontrol.AccessControl, attr authorizer.Attributes) (authorizer.Decision, string, error) {
	if attr.GetResource() != RouteResource {
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
