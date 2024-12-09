package routingtree

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
	case "patch":
		fallthrough
	case "create":
		fallthrough
	case "update":
		fallthrough
	case "deletecollection":
		fallthrough
	case "delete":
		action = accesscontrol.EvalAny(
			accesscontrol.EvalPermission(accesscontrol.ActionAlertingNotificationsWrite),
			accesscontrol.EvalPermission(accesscontrol.ActionAlertingRoutesWrite),
		)
	}

	eval := accesscontrol.EvalAny(
		accesscontrol.EvalPermission(accesscontrol.ActionAlertingNotificationsRead),
		accesscontrol.EvalPermission(accesscontrol.ActionAlertingRoutesRead),
	)
	if action != nil {
		eval = accesscontrol.EvalAll(eval, action)
	}

	ok, err := ac.Evaluate(ctx, user, eval)
	if ok {
		return authorizer.DecisionAllow, "", nil
	}
	return authorizer.DecisionDeny, "", err
}
