package accesscontrol

import (
	"context"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
)

type genericService struct {
	ac accesscontrol.AccessControl
}

// HasAccess returns true if the identity.Requester has all permissions specified by the evaluator. Returns error if access control backend could not evaluate permissions
func (r genericService) HasAccess(ctx context.Context, user identity.Requester, evaluator accesscontrol.Evaluator) (bool, error) {
	return r.ac.Evaluate(ctx, user, evaluator)
}

// HasAccessOrError returns nil if the identity.Requester has enough permissions to pass the accesscontrol.Evaluator. Otherwise, returns authorization error that contains action that was performed
func (r genericService) HasAccessOrError(ctx context.Context, user identity.Requester, evaluator accesscontrol.Evaluator, action func() string) error {
	has, err := r.HasAccess(ctx, user, evaluator)
	if err != nil {
		return err
	}
	if !has {
		return NewAuthorizationErrorWithPermissions(action(), evaluator)
	}
	return nil
}
