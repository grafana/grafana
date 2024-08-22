package receiver

import (
	"context"

	"k8s.io/apiserver/pkg/authorization/authorizer"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
)

// AccessControlService provides access control for receivers.
type AccessControlService interface {
	AuthorizeReadSome(ctx context.Context, user identity.Requester) error
	AuthorizeReadByUID(context.Context, identity.Requester, string) error
	AuthorizeCreate(context.Context, identity.Requester) error
	AuthorizeUpdateByUID(context.Context, identity.Requester, string) error
	AuthorizeDeleteByUID(context.Context, identity.Requester, string) error
}

func Authorize(ctx context.Context, ac AccessControlService, attr authorizer.Attributes) (authorized authorizer.Decision, reason string, err error) {
	if attr.GetResource() != resourceInfo.GroupResource().Resource {
		return authorizer.DecisionNoOpinion, "", nil
	}
	user, err := identity.GetRequester(ctx)
	if err != nil {
		return authorizer.DecisionDeny, "valid user is required", err
	}

	uid := attr.GetName()

	switch attr.GetVerb() {
	case "get":
		if uid == "" {
			return authorizer.DecisionDeny, "", nil
		}
		if err := ac.AuthorizeReadByUID(ctx, user, uid); err != nil {
			return authorizer.DecisionDeny, "", err
		}
	case "list":
		if err := ac.AuthorizeReadSome(ctx, user); err != nil { // Preconditions, further checks are done downstream.
			return authorizer.DecisionDeny, "", err
		}
	case "create":
		if err := ac.AuthorizeCreate(ctx, user); err != nil {
			return authorizer.DecisionDeny, "", err
		}
	case "patch":
		fallthrough
	case "update":
		if uid == "" {
			return authorizer.DecisionDeny, "", nil
		}
		if err := ac.AuthorizeUpdateByUID(ctx, user, uid); err != nil {
			return authorizer.DecisionDeny, "", err
		}
	case "delete":
		if uid == "" {
			return authorizer.DecisionDeny, "", nil
		}
		if err := ac.AuthorizeDeleteByUID(ctx, user, uid); err != nil {
			return authorizer.DecisionDeny, "", err
		}
	default:
		return authorizer.DecisionNoOpinion, "", nil
	}

	return authorizer.DecisionAllow, "", nil
}
