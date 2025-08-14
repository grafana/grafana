package resource

import (
	"errors"
	"net/http"

	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/types"
	"k8s.io/apimachinery/pkg/util/validation/field"

	"github.com/grpc-ecosystem/grpc-gateway/v2/runtime"
	grpcstatus "google.golang.org/grpc/status"

	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
	"github.com/grafana/grafana/pkg/util/scheduler"
)

// Package-level errors.
var (
	ErrOptimisticLockingFailed = errors.New("optimistic locking failed")
	ErrNotImplementedYet       = errors.New("not implemented yet")
)

var (
	ErrResourceAlreadyExists error = &apierrors.StatusError{
		ErrStatus: metav1.Status{
			Status:  metav1.StatusFailure,
			Reason:  metav1.StatusReasonAlreadyExists,
			Message: "the resource already exists",
			Code:    http.StatusConflict,
		},
	}
)

func NewBadRequestError(msg string) *resourcepb.ErrorResult {
	return &resourcepb.ErrorResult{
		Message: msg,
		Code:    http.StatusBadRequest,
		Reason:  string(metav1.StatusReasonBadRequest),
	}
}

func NewNotFoundError(key *resourcepb.ResourceKey) *resourcepb.ErrorResult {
	return &resourcepb.ErrorResult{
		Code: http.StatusNotFound,
		Details: &resourcepb.ErrorDetails{
			Group: key.Group,
			Kind:  key.Resource, // yup, resource as kind same is true in apierrors.NewNotFound()
			Name:  key.Name,
		},
	}
}

func NewTooManyRequestsError(msg string) *resourcepb.ErrorResult {
	return &resourcepb.ErrorResult{
		Message: msg,
		Code:    http.StatusTooManyRequests,
		Reason:  string(metav1.StatusReasonTooManyRequests),
	}
}

func newInvalidFieldError(
	obj utils.GrafanaMetaAccessor,
	detail string,
	path string,
	morePath ...string,
) *resourcepb.ErrorResult {
	gvk := obj.GetGroupVersionKind()
	return &resourcepb.ErrorResult{
		Message: detail,
		Code:    http.StatusUnprocessableEntity,
		Reason:  string(metav1.StatusReasonInvalid),
		Details: &resourcepb.ErrorDetails{
			Name:  obj.GetName(),
			Group: gvk.Group,
			Kind:  gvk.Kind,
			Uid:   string(obj.GetUID()),
			Causes: []*resourcepb.ErrorCause{
				{
					Reason: string(field.ErrorTypeForbidden),
					Field:  field.NewPath(path, morePath...).String(),
				},
			},
		},
	}
}

func newRequiredFieldError(
	obj utils.GrafanaMetaAccessor,
	detail string,
	path string,
	morePath ...string,
) *resourcepb.ErrorResult {
	gvk := obj.GetGroupVersionKind()
	return &resourcepb.ErrorResult{
		Message: detail,
		Code:    http.StatusUnprocessableEntity,
		Reason:  string(metav1.StatusReasonInvalid),
		Details: &resourcepb.ErrorDetails{
			Name:  obj.GetName(),
			Group: gvk.Group,
			Kind:  gvk.Kind,
			Uid:   string(obj.GetUID()),
			Causes: []*resourcepb.ErrorCause{
				{
					Reason: string(field.ErrorTypeRequired),
					Field:  field.NewPath(path, morePath...).String(),
				},
			},
		},
	}
}

// Convert golang errors to status result errors that can be returned to a client
func AsErrorResult(err error) *resourcepb.ErrorResult {
	if err == nil {
		return nil
	}

	var apistatus apierrors.APIStatus
	if errors.As(err, &apistatus) {
		s := apistatus.Status()
		res := &resourcepb.ErrorResult{
			Message: s.Message,
			Reason:  string(s.Reason),
			Code:    s.Code,
		}
		if s.Details != nil {
			res.Details = &resourcepb.ErrorDetails{
				Group:             s.Details.Group,
				Kind:              s.Details.Kind,
				Name:              s.Details.Name,
				Uid:               string(s.Details.UID),
				RetryAfterSeconds: s.Details.RetryAfterSeconds,
			}
			for _, c := range s.Details.Causes {
				res.Details.Causes = append(res.Details.Causes, &resourcepb.ErrorCause{
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

	return &resourcepb.ErrorResult{
		Message: err.Error(),
		Code:    int32(code),
	}
}

func GetError(res *resourcepb.ErrorResult) error {
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

func HandleQueueError[T any](err error, makeResp func(*resourcepb.ErrorResult) *T) (*T, error) {
	if errors.Is(err, scheduler.ErrTenantQueueFull) {
		return makeResp(NewTooManyRequestsError("tenant queue is full, please try again later")), nil
	}
	return makeResp(AsErrorResult(err)), nil
}
