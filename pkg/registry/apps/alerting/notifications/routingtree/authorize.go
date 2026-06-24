package routingtree

import (
	"context"
	"errors"
	"fmt"

	"k8s.io/apiserver/pkg/authorization/authorizer"

	"github.com/grafana/grafana/pkg/apimachinery/errutil"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	ngac "github.com/grafana/grafana/pkg/services/ngalert/accesscontrol"
)

// AccessControlService provides per-resource access control for routing trees.
type AccessControlService interface {
	AuthorizeReadSome(ctx context.Context, user identity.Requester) error
	AuthorizeReadByUID(ctx context.Context, user identity.Requester, uid string) error
	AuthorizeCreate(ctx context.Context, user identity.Requester) error
	AuthorizeUpdateByUID(ctx context.Context, user identity.Requester, uid string) error
	AuthorizeDeleteByUID(ctx context.Context, user identity.Requester, uid string) error
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
			if errors.Is(err, ngac.ErrAuthorizationBase) {
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
		// Always allow listing; results are filtered downstream via FilterRead.
		if err := ac.AuthorizeReadSome(ctx, user); err != nil {
			return deny(err)
		}
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
	case "deletecollection":
		fallthrough
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
