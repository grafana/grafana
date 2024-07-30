package accesscontrol

import (
	"context"
	"fmt"

	"github.com/grafana/grafana/pkg/apimachinery/errutil"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	ac "github.com/grafana/grafana/pkg/services/accesscontrol"
)

var (
	ErrAuthorizationBase = errutil.Forbidden("alerting.unauthorized")
)

func NewAuthorizationErrorWithPermissions(action string, eval ac.Evaluator) error {
	msg := fmt.Sprintf("user is not authorized to %s", action)
	err := ErrAuthorizationBase.Errorf(msg)
	err.PublicMessage = msg
	if eval != nil {
		err.PublicPayload = map[string]any{
			"permissions": eval.GoString(),
		}
	}
	return err
}

func NewAuthorizationErrorGeneric(action string) error {
	return NewAuthorizationErrorWithPermissions(action, nil)
}

// actionAccess is a helper struct that provides common access control methods for a specific resource type and action.
type actionAccess[T any] struct {
	genericService

	// authorizeSome evaluates to true if user has access to some (any) resources.
	// This is used as a precondition check, if this evaluates to false then user does not have access to any resources.
	authorizeSome ac.Evaluator

	// authorizeAll evaluates to true if user has access to all resources.
	authorizeAll ac.Evaluator

	// authorizeOne returns an evaluator that checks if user has access to a specific resource.
	authorizeOne func(T) ac.Evaluator

	// action is the action that user is trying to perform on the resource. Used in error messages.
	action string

	// resource is the name of the resource. Used in error messages.
	resource string
}

// Filter filters the given list of resources based on access control permissions of the user.
// This method is preferred when many resources need to be checked.
func (s actionAccess[T]) Filter(ctx context.Context, user identity.Requester, resources ...T) ([]T, error) {
	canAll, err := s.authorizePreConditions(ctx, user)
	if err != nil {
		return nil, err
	}
	if canAll {
		return resources, nil
	}
	result := make([]T, 0, len(resources))
	for _, r := range resources {
		if hasAccess := s.authorize(ctx, user, r); hasAccess == nil {
			result = append(result, r)
		}
	}
	return result, nil
}

// Authorize checks if user has access to a resource. Returns an error if user does not have access.
func (s actionAccess[T]) Authorize(ctx context.Context, user identity.Requester, resource T) error {
	canAll, err := s.authorizePreConditions(ctx, user)
	if canAll || err != nil { // Return early if user can either access all or there is an error.
		return err
	}

	return s.authorize(ctx, user, resource)
}

// Has checks if user has access to a resource. Returns false if user does not have access.
func (s actionAccess[T]) Has(ctx context.Context, user identity.Requester, resource T) (bool, error) {
	canAll, err := s.authorizePreConditions(ctx, user)
	if canAll || err != nil { // Return early if user can either access all or there is an error.
		return canAll, err
	}

	return s.has(ctx, user, resource)
}

// authorizePreConditions checks necessary preconditions for resources. Returns true if user has access for all
// resources. Returns error if user does not have access to on any resources.
func (s actionAccess[T]) authorizePreConditions(ctx context.Context, user identity.Requester) (bool, error) {
	canAll, err := s.HasAccess(ctx, user, s.authorizeAll)
	if canAll || err != nil { // Return early if user can either access all or there is an error.
		return canAll, err
	}

	can, err := s.HasAccess(ctx, user, s.authorizeSome)
	if err != nil {
		return false, err
	}
	if !can { // User does not have any resource permissions at all.
		return false, NewAuthorizationErrorWithPermissions(fmt.Sprintf("%s any %s", s.action, s.resource), s.authorizeSome)
	}
	return false, nil
}

// authorize checks if user has access to a specific resource given precondition checks have already passed. Returns an error if user does not have access.
func (s actionAccess[T]) authorize(ctx context.Context, user identity.Requester, resource T) error {
	return s.HasAccessOrError(ctx, user, s.authorizeOne(resource), func() string {
		return fmt.Sprintf("%s %s", s.action, s.resource)
	})
}

// has checks if user has access to a specific resource given precondition checks have already passed. Returns false if user does not have access.
func (s actionAccess[T]) has(ctx context.Context, user identity.Requester, resource T) (bool, error) {
	return s.HasAccess(ctx, user, s.authorizeOne(resource))
}
