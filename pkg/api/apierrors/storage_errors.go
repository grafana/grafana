package apierrors

import (
	"errors"

	"google.golang.org/grpc/status"
	apierrors "k8s.io/apimachinery/pkg/api/errors"

	"github.com/grafana/grafana/pkg/storage/unified/resource"
)

// storageStatusError normalizes wrapped Kubernetes and gRPC errors for HTTP status and reason checks.
// Callers retain the original error for legacy sentinel matching and logging.
func storageStatusError(err error) *apierrors.StatusError {
	if statusErr, ok := errors.AsType[*apierrors.StatusError](err); ok {
		return statusErr
	}
	var grpcErr interface{ GRPCStatus() *status.Status }
	if errors.As(err, &grpcErr) {
		if st := grpcErr.GRPCStatus(); st != nil {
			statusErr, _ := errors.AsType[*apierrors.StatusError](resource.StatusErrorFromResponse(nil, st.Err()))
			return statusErr
		}
	}
	return nil
}
