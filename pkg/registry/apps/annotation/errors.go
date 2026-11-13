package annotation

import (
	"context"
	"errors"

	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	"github.com/grafana/grafana/pkg/apimachinery/errutil"
)

// isCanceledErr reports whether err is caused by the caller abandoning the request.
// gRPC status errors do not wrap context.Canceled, so the code is checked too, as is a
// 499 a downstream service already mapped.
//
// The request context is deliberately not consulted: work started for a request can
// outlive the caller, so a canceled context says nothing about whether this error is a
// cancellation or a genuine failure.
func isCanceledErr(err error) bool {
	var apiStatus apierrors.APIStatus
	if errors.As(err, &apiStatus) && apiStatus.Status().Code == errutil.HTTPStatusClientClosedRequest {
		return true
	}
	return errors.Is(err, context.Canceled) || status.Code(err) == codes.Canceled
}

// canceledStatusError is the 499 for a request the caller abandoned. Built by hand
// because 499 is an nginx extension, so apierrors has no constructor for it.
func canceledStatusError() error {
	return &apierrors.StatusError{ErrStatus: metav1.Status{
		Status:  metav1.StatusFailure,
		Code:    errutil.HTTPStatusClientClosedRequest,
		Reason:  "ClientClosedRequest",
		Message: "Request canceled",
	}}
}
