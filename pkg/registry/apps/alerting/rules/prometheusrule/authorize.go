package prometheusrule

import (
	"context"

	"k8s.io/apiserver/pkg/authorization/authorizer"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
)

func Authorize(ctx context.Context, ac accesscontrol.AccessControl, attr authorizer.Attributes) (authorized authorizer.Decision, reason string, err error) {
	if attr.GetResource() != ResourceInfo.GroupResource().Resource {
		return authorizer.DecisionNoOpinion, "", nil
	}
	user, err := identity.GetRequester(ctx)
	if err != nil {
		return authorizer.DecisionDeny, "valid user is required", err
	}

	var action accesscontrol.Evaluator
	switch attr.GetVerb() {
	case "get", "list", "watch":
		action = accesscontrol.EvalPermission(accesscontrol.ActionAlertingPrometheusRulesRead)
	case "create":
		action = accesscontrol.EvalPermission(accesscontrol.ActionAlertingPrometheusRulesCreate)
	case "patch", "update":
		action = accesscontrol.EvalPermission(accesscontrol.ActionAlertingPrometheusRulesWrite)
	case "delete", "deletecollection":
		action = accesscontrol.EvalPermission(accesscontrol.ActionAlertingPrometheusRulesDelete)
	default:
		return authorizer.DecisionNoOpinion, "", nil
	}

	ok, err := ac.Evaluate(ctx, user, action)
	if ok {
		return authorizer.DecisionAllow, "", nil
	}
	return authorizer.DecisionDeny, "", err
}
