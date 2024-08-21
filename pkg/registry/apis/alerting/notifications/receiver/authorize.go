package receiver

import (
	"context"

	"k8s.io/apiserver/pkg/authorization/authorizer"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
)

// AccessControlService provides access control for receivers.
type AccessControlService interface {
	AuthorizeReadPreconditions(ctx context.Context, user identity.Requester) error
	AuthorizeCreatePreconditions(ctx context.Context, user identity.Requester) error
	AuthorizeUpdatePreconditions(ctx context.Context, user identity.Requester) error
	AuthorizeDeletePreconditions(ctx context.Context, user identity.Requester) error
}

type authorizeFn func(context.Context, identity.Requester) error

func Authorize(ctx context.Context, ac AccessControlService, attr authorizer.Attributes) (authorized authorizer.Decision, reason string, err error) {
	if attr.GetResource() != resourceInfo.GroupResource().Resource {
		return authorizer.DecisionNoOpinion, "", nil
	}
	user, err := identity.GetRequester(ctx)
	if err != nil {
		return authorizer.DecisionDeny, "valid user is required", err
	}

	var authorize authorizeFn
	switch attr.GetVerb() {
	case "create":
		authorize = ac.AuthorizeCreatePreconditions
	case "patch":
		fallthrough
	case "update":
		authorize = ac.AuthorizeUpdatePreconditions
	case "deletecollection":
		fallthrough
	case "delete":
		authorize = ac.AuthorizeDeletePreconditions
	default:
		authorize = ac.AuthorizeReadPreconditions
	}

	if err := authorize(ctx, user); err != nil {
		return authorizer.DecisionDeny, "", err
	}
	return authorizer.DecisionAllow, "", nil
}
