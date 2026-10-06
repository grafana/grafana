package apierrors

import (
	"errors"

	"google.golang.org/grpc/status"
	apierrors "k8s.io/apimachinery/pkg/api/errors"

	"github.com/grafana/grafana/pkg/storage/unified/resource"
)

// Legacy converters already inspect StatusError beneath operation-specific wrappers.
// Recover the equivalent gRPC status here without flattening those wrappers before
// the converters have applied their legacy error mappings.
func storageStatusError(err error) (*apierrors.StatusError, bool) {
	if statusErr, ok := errors.AsType[*apierrors.StatusError](err); ok {
		return statusErr, true
	}
	if st, ok := status.FromError(err); ok {
		return errors.AsType[*apierrors.StatusError](resource.StatusErrorFromResponse(nil, st.Err()))
	}
	return nil, false
}
