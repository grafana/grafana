package resource

import (
	"errors"
	"net/http"

	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/types"

	"github.com/grpc-ecosystem/grpc-gateway/v2/runtime"
	grpcstatus "google.golang.org/grpc/status"
)

// Package-level errors.
var (
	ErrOptimisticLockingFailed = errors.New("optimistic locking failed")
	ErrNotImplementedYet       = errors.New("not implemented yet")
)

func NewBadRequestError(msg string) *ErrorResult {
	return &ErrorResult{
		Message: msg,
		Code:    http.StatusBadRequest,
		Reason:  string(metav1.StatusReasonBadRequest),
	}
}

func NewNotFoundError(key *ResourceKey) *ErrorResult {
	return &ErrorResult{
		Code: http.StatusNotFound,
		Details: &ErrorDetails{
			Group: key.Group,
			Kind:  key.Resource, // yup, resource as kind same is true in apierrors.NewNotFound()
			Name:  key.Name,
		},
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

	code := 500

	st, ok := grpcstatus.FromError(err)
	if ok {
		code = runtime.HTTPStatusFromCode(st.Code())
	}

	return &ErrorResult{
		Message: err.Error(),
		Code:    int32(code),
	}
}

func GetError(res *ErrorResult) error {
	if res == nil {
		return nil
	}

	status := &apierrors.StatusError{ErrStatus: metav1.Status{
		Status:  metav1.StatusFailure,
		Code:    res.Code,
		Reason:  metav1.StatusReason(res.Reason),
		Message: res.Message,
	}}
	if res.Details != nil {
		status.ErrStatus.Details = &metav1.StatusDetails{
			Group:             res.Details.Group,
			Kind:              res.Details.Kind,
			Name:              res.Details.Name,
			UID:               types.UID(res.Details.Uid),
			RetryAfterSeconds: res.Details.RetryAfterSeconds,
		}
		for _, c := range res.Details.Causes {
			status.ErrStatus.Details.Causes = append(status.ErrStatus.Details.Causes, metav1.StatusCause{
				Type:    metav1.CauseType(c.Reason),
				Message: c.Message,
				Field:   c.Field,
			})
		}
	}
	return status
}
