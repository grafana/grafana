package annotation

import (
	"context"
	"errors"

	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
	apierrors "k8s.io/apimachinery/pkg/api/errors"

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
