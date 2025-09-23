package receiver

import (
	"context"
	"errors"
	"fmt"

	"k8s.io/apiserver/pkg/authorization/authorizer"

	"github.com/grafana/grafana/pkg/apimachinery/errutil"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/services/ngalert/accesscontrol"
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
	if attr.GetResource() != ResourceInfo.GroupResource().Resource {
		return authorizer.DecisionNoOpinion, "", nil
	}
	user, err := identity.GetRequester(ctx)
	if err != nil {
		return authorizer.DecisionDeny, "valid user is required", err
	}

	uid := attr.GetName()

	deny := func(err error) (authorizer.Decision, string, error) {
		var utilErr errutil.Error
		if errors.As(err, &utilErr) && utilErr.Reason.Status() == errutil.StatusForbidden {
			if errors.Is(err, accesscontrol.ErrAuthorizationBase) {
				return authorizer.DecisionDeny, fmt.Sprintf("required permissions: %s", utilErr.PublicPayload["permissions"]), nil
			}
			return authorizer.DecisionDeny, utilErr.PublicMessage, nil
		}

		return authorizer.DecisionDeny, "", err
	}

	switch attr.GetVerb() {
	case "get":
		if uid == "" {
			return authorizer.DecisionDeny, "", nil
		}
		if err := ac.AuthorizeReadByUID(ctx, user, uid); err != nil {
			return deny(err)
		}
	case "list":
		return authorizer.DecisionAllow, "", nil // Always allow listing, receivers are filtered downstream.
	case "create":
		if err := ac.AuthorizeCreate(ctx, user); err != nil {
			return deny(err)
		}
	case "patch":
		fallthrough
	case "update":
		if uid == "" {
			return deny(err)
		}
		if err := ac.AuthorizeUpdateByUID(ctx, user, uid); err != nil {
			return deny(err)
		}
	case "delete":
		if uid == "" {
			return deny(err)
		}
		if err := ac.AuthorizeDeleteByUID(ctx, user, uid); err != nil {
			return deny(err)
		}
	default:
		return authorizer.DecisionNoOpinion, "", nil
	}

	return authorizer.DecisionAllow, "", nil
}
