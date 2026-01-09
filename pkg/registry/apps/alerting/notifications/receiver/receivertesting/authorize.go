package receivertesting

import (
	"context"

	"k8s.io/apiserver/pkg/authorization/authorizer"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
)

func Authorize(ctx context.Context, ac accesscontrol.AccessControl, attr authorizer.Attributes) (authorized authorizer.Decision, reason string, err error) {
	user, err := identity.GetRequester(ctx)
	if err != nil {
		return authorizer.DecisionDeny, "valid user is required", err
	}
	eval := accesscontrol.EvalAny(
		accesscontrol.EvalPermission(accesscontrol.ActionAlertingNotificationsWrite),
		accesscontrol.EvalPermission(accesscontrol.ActionAlertingReceiversTest),
	)
	ok, err := ac.Evaluate(ctx, user, eval)
	if ok {
		return authorizer.DecisionAllow, "", nil
	}
	return authorizer.DecisionDeny, "", err
}
