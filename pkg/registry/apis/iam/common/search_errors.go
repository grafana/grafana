package common

import (
	"errors"
	"net/http"

	"google.golang.org/grpc/status"
	apierrors "k8s.io/apimachinery/pkg/api/errors"

	"github.com/grafana/grafana/pkg/storage/unified/resource"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
)

// SearchStatusError preserves structured search errors without exposing unstructured
// server-side gRPC messages in HTTP responses.
func SearchStatusError(respErr *resourcepb.ErrorResult, err error) error {
	converted := resource.StatusErrorFromResponse(respErr, err)
	if err == nil {
		return converted
	}
	st, ok := status.FromError(err)
	if !ok {
		return converted
	}
	for _, detail := range st.Details() {
		if _, ok := detail.(*resourcepb.ErrorResult); ok {
			return converted
		}
	}
	var statusErr *apierrors.StatusError
	if !errors.As(converted, &statusErr) || statusErr.ErrStatus.Code < http.StatusInternalServerError {
		return converted
	}
	statusErr.ErrStatus.Message = http.StatusText(int(statusErr.ErrStatus.Code))
	return &safeSearchError{StatusError: statusErr, cause: err}
}

type safeSearchError struct {
	*apierrors.StatusError
	cause error
}

func (e *safeSearchError) Unwrap() error { return e.cause }
