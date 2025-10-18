package recordingrule

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
	// Default evaluator - all actions require read permissions
	defaultEvaluator := accesscontrol.EvalPermission(accesscontrol.ActionAlertingRuleRead)

	switch attr.GetVerb() {
	case "get", "list", "watch":
		action = defaultEvaluator
	case "create":
		action = accesscontrol.EvalAll(
			defaultEvaluator,
			accesscontrol.EvalPermission(accesscontrol.ActionAlertingRuleCreate),
		)
	case "patch", "update":
		action = accesscontrol.EvalAll(
			defaultEvaluator,
			accesscontrol.EvalPermission(accesscontrol.ActionAlertingRuleUpdate),
		)
	case "delete", "deletecollection":
		action = accesscontrol.EvalAll(
			defaultEvaluator,
			accesscontrol.EvalPermission(accesscontrol.ActionAlertingRuleDelete),
		)
	}

	ok, err := ac.Evaluate(ctx, user, action)
	if ok {
		return authorizer.DecisionAllow, "", nil
	}
	return authorizer.DecisionDeny, "", err
}
