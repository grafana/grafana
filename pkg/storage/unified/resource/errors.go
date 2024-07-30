package resource

import (
	"errors"
	"net/http"

	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

// Package-level errors.
var (
	ErrNotFound                 = errors.New("resource not found")
	ErrOptimisticLockingFailed  = errors.New("optimistic locking failed")
	ErrUserNotFoundInContext    = errors.New("user not found in context")
	ErrUnableToReadResourceJSON = errors.New("unable to read resource json")
	ErrNotImplementedYet        = errors.New("not implemented yet")
)

func NewBadRequestError(msg string) *ErrorResult {
	return &ErrorResult{
		Message: msg,
		Code:    http.StatusBadRequest,
		Reason:  string(metav1.StatusReasonBadRequest),
	}
}

// Convert golang errors to status result errors that can be returned to a client
func AsErrorResult(err error) *ErrorResult {
	if err == nil {
		return nil
	}
	apistatus, ok := err.(apierrors.APIStatus)
	if ok {
		s := apistatus.Status()
		res := &ErrorResult{
			Message: s.Message,
			Reason:  string(s.Reason),
			Code:    s.Code,
		}
		if s.Details != nil {
			res.Details = &ErrorDetails{
				Group:             s.Details.Group,
				Kind:              s.Details.Kind,
				Name:              s.Details.Name,
				Uid:               string(s.Details.UID),
				RetryAfterSeconds: s.Details.RetryAfterSeconds,
			}
			for _, c := range s.Details.Causes {
				res.Details.Causes = append(res.Details.Causes, &ErrorCause{
					Reason:  string(c.Type),
					Message: c.Message,
					Field:   c.Field,
				})
			}
		}
		return res
	}

	// TODO... better conversion??
	return &ErrorResult{
		Message: err.Error(),
		Code:    500,
	}
}
