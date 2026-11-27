package resource

import (
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"

	"github.com/grafana/grafana/pkg/storage/unified/resourceclient/resourceutil"
)

// rpcErrorFrom converts an error raised while serving a call into the error the
// handler returns. A gRPC status (wrapped or not) is returned unchanged so its
// code, message and details aren't flattened; anything else is mapped through
// AsErrorResult into a status with ErrorResult details.
func rpcErrorFrom(err error) error {
	if err == nil {
		return nil
	}
	if st, ok := status.FromError(err); ok && !hidesFailure(st.Code(), err) {
		return err
	}
	return GRPCStatusError(AsErrorResult(err))
}

// hidesFailure reports whether passing err through with code would report a
// joined storage failure as a cancellation. status.FromError picks the first
// status in a joined error, so a canceled branch would otherwise mask the rest.
func hidesFailure(code codes.Code, err error) bool {
	return (code == codes.Canceled || code == codes.DeadlineExceeded) && !resourceutil.OnlyCancellationErrors(err)
}
