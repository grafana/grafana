package integrationtypeschema

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
}

func Authorize(ctx context.Context, ac AccessControlService, attr authorizer.Attributes) (authorized authorizer.Decision, reason string, err error) {
	if attr.GetResource() != ResourceInfo.GroupResource().Resource {
		return authorizer.DecisionNoOpinion, "", nil
	}
	user, err := identity.GetRequester(ctx)
	if err != nil {
		return authorizer.DecisionDeny, "valid user is required", err
	}

	if err := ac.AuthorizeReadSome(ctx, user); err != nil {
		var utilErr errutil.Error
		if errors.As(err, &utilErr) && utilErr.Reason.Status() == errutil.StatusForbidden {
			if errors.Is(err, accesscontrol.ErrAuthorizationBase) {
				return authorizer.DecisionDeny, fmt.Sprintf("required permissions: %s", utilErr.PublicPayload["permissions"]), nil
			}
			return authorizer.DecisionDeny, utilErr.PublicMessage, nil
		}

		return authorizer.DecisionDeny, "", err
	}

	if attr.GetVerb() != "list" && attr.GetVerb() != "get" {
		return authorizer.DecisionDeny, "only reading integration type schemas is allowed", nil
	}

	return authorizer.DecisionAllow, "", nil
}
