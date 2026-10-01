package resourceutil

import (
	"errors"
	"fmt"
	"net/http"

	"github.com/grpc-ecosystem/grpc-gateway/v2/runtime"
	grpccodes "google.golang.org/grpc/codes"
	grpcstatus "google.golang.org/grpc/status"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/types"

	claims "github.com/grafana/authlib/types"

	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
)

func NewResourceVersionExpiredError(rv int64) error {
	result := &resourcepb.ErrorResult{
		Message: fmt.Sprintf("too old resource version: %d", rv),
		Code:    http.StatusGone,
		Reason:  string(metav1.StatusReasonExpired),
	}
	st := grpcstatus.New(grpccodes.OutOfRange, result.Message)
	if withDetails, err := st.WithDetails(result); err == nil {
		st = withDetails
	}
	return st.Err()
}

func IsResourceVersionExpired(err error) bool {
	if err == nil {
		return false
	}
	if apierrors.IsResourceExpired(err) || apierrors.IsGone(err) {
		return true
	}
	if res := ErrorResultFromGRPCDetails(err); res != nil {
		return res.Code == http.StatusGone || res.Reason == string(metav1.StatusReasonExpired)
	}
	return false
}

// IsConflict reports whether err is a storage conflict, whether it arrived as a typed
// Kubernetes error or as a gRPC status whose ErrorResult apierrors cannot inspect.
func IsConflict(err error) bool {
	if apierrors.IsConflict(err) {
		return true
	}
	return apierrors.IsConflict(GetError(ErrorResultFromGRPCDetails(err)))
}

// ErrorFromResponse resolves the outcome of a unified storage call — which
// reports failure either through a transport error or through a response that
// embeds an ErrorResult — into a single error, so callers need one error
// branch. The transport error is returned untouched to keep its gRPC status,
// cancellation semantics and errors.Is/As chain intact; a response-embedded
// result is converted to a typed Kubernetes error. Callers that need an ErrorResult
// representation for status checks can convert the returned error with AsErrorResult.
// Attached or response-embedded details are preserved when available.
// Returns nil only when the call fully succeeded.
func ErrorFromResponse(respErr *resourcepb.ErrorResult, err error) error {
	if err != nil {
		return err
	}
	return GetError(respErr)
}

// ErrorResultFromGRPCDetails returns the ErrorResult attached to a gRPC status error, or nil.
func ErrorResultFromGRPCDetails(err error) *resourcepb.ErrorResult {
	st, ok := grpcstatus.FromError(err)
	if !ok || st == nil {
		return nil
	}
	for _, detail := range st.Details() {
		if res, ok := detail.(*resourcepb.ErrorResult); ok {
			return res
		}
	}
	return nil
}

// AsErrorResult converts golang errors to status result errors that can be returned to a client.
// Returns the first status details entity that matches the resourcepb.ErrorResult type, if given. If multiple entries
// are given in the status details array, only the first matching one is used; all others are discarded.
func AsErrorResult(err error) *resourcepb.ErrorResult {
	if err == nil {
		return nil
	}

	// Without this a namespace mismatch falls through
	// to the generic 500 below, which is incorrect as it raises error budgets.
	if errors.Is(err, claims.ErrNamespaceMismatch) {
		return &resourcepb.ErrorResult{
			Message: claims.ErrNamespaceMismatch.Error(),
			Reason:  string(metav1.StatusReasonForbidden),
			Code:    http.StatusForbidden,
		}
	}

	// Structured results attached to a gRPC error keep their reason/code across
	// the wire, so prefer them over the generic mapping below.
	if res := ErrorResultFromGRPCDetails(err); res != nil {
		return res
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
