package accesscontrol

import (
	"context"
	"fmt"

	"k8s.io/apiserver/pkg/authorization/authorizer"

	"github.com/grafana/grafana/pkg/infra/appcontext"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
)

var _ authorizer.Authorizer = &AccessControlAuthorizer{}

type AccessControlAuthorizer struct {
	log log.Logger
	ac  accesscontrol.AccessControl
}

func ProvideAccessControlAuthorizer(ac accesscontrol.AccessControl) *AccessControlAuthorizer {
	return &AccessControlAuthorizer{log: log.New("grafana-apiserver.authorizer.accesscontrol"), ac: ac}
}

func (auth AccessControlAuthorizer) Authorize(ctx context.Context, a authorizer.Attributes) (authorized authorizer.Decision, reason string, err error) {
	// we only care about resource requests at this point
	if !a.IsResourceRequest() {
		return authorizer.DecisionNoOpinion, "", nil
	}

	signedInUser, err := appcontext.User(ctx)
	if err != nil {
		return authorizer.DecisionDeny, "error getting signed in user", err
	}

	action, ok := mapToAction(a.GetVerb(), a.GetResource())
	if !ok {
		return authorizer.DecisionNoOpinion, "", nil
	}

	ok, err = auth.ac.Evaluate(ctx, signedInUser, accesscontrol.EvalPermission(action))
	if err != nil {
		return authorizer.DecisionDeny, "error evaluating access control", err
	}

	if ok {
		return authorizer.DecisionAllow, "", nil
	}

	return authorizer.DecisionDeny, fmt.Sprintf("user %d is not allowed to access verb: %s, resource: %s", signedInUser.UserID, a.GetVerb(), a.GetResource()), nil
}

func mapToAction(verb, resource string) (string, bool) {
	switch resource {
	// TODO: this is an incomplete example
	case "teams":
		switch verb {
		case "get", "list", "watch":
			return accesscontrol.ActionTeamsRead, true
		case "create":
			return accesscontrol.ActionTeamsCreate, true
		case "delete":
			return accesscontrol.ActionTeamsDelete, true
		case "update":
			return accesscontrol.ActionTeamsWrite, true
		}
	}
	return "", false
}
