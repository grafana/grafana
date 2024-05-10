package receiver

import (
	"context"

	"k8s.io/apiserver/pkg/authorization/authorizer"

	"github.com/grafana/grafana/pkg/infra/appcontext"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
)

func Authorize(ctx context.Context, ac accesscontrol.AccessControl, attr authorizer.Attributes) (authorized authorizer.Decision, reason string, err error) {
	if attr.GetResource() != resourceInfo.GroupResource().Resource {
		return authorizer.DecisionNoOpinion, "", nil
	}
	user, err := appcontext.User(ctx)
	if err != nil {
		return authorizer.DecisionDeny, "valid user is required", err
	}

	e := func(eval accesscontrol.Evaluator) (authorized authorizer.Decision, reason string, err error) {
		ok, err := ac.Evaluate(ctx, user, eval)
		if ok {
			return authorizer.DecisionAllow, "", nil
		}
		return authorizer.DecisionDeny, "", err
	}

	var action accesscontrol.Evaluator
	switch attr.GetVerb() {
	case "list":
		return e(accesscontrol.EvalAny(
			accesscontrol.EvalPermission(accesscontrol.ActionAlertingNotificationsRead),
			accesscontrol.EvalPermission(accesscontrol.ActionAlertingReceiversList),
			accesscontrol.EvalPermission(accesscontrol.ActionAlertingReceiversRead),
		))
	case "patch":
		fallthrough
	case "create":
		fallthrough
	case "update":
		action = accesscontrol.EvalAny(
			accesscontrol.EvalPermission(accesscontrol.ActionAlertingNotificationsWrite),
		)
	case "deletecollection":
		fallthrough
	case "delete":
		action = accesscontrol.EvalAny(
			accesscontrol.EvalPermission(accesscontrol.ActionAlertingNotificationsWrite),
		)
	}

	eval := accesscontrol.EvalAny(
		accesscontrol.EvalPermission(accesscontrol.ActionAlertingNotificationsRead),
		accesscontrol.EvalPermission(accesscontrol.ActionAlertingReceiversRead),
	)
	if action != nil {
		eval = accesscontrol.EvalAll(eval, action)
	}

	return e(eval)
}
