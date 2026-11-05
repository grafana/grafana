package resource

import (
	"google.golang.org/grpc/status"

	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
)

// rpcError returns the error a server handler reports for a failed call
// described by res: a gRPC status carrying res as a detail, so clients keep
// the HTTP code, reason and causes. Returns nil for nil.
func rpcError(res *resourcepb.ErrorResult) error {
	return GRPCStatusError(res)
}

// rpcErrorFrom converts an error raised while serving a call into the error the
// handler returns. A gRPC status (wrapped or not) is returned unchanged so its
// code, message and details aren't flattened; anything else is mapped through
// AsErrorResult like a response-embedded error used to be.
func rpcErrorFrom(err error) error {
	if err == nil {
		return nil
	}
	if _, ok := status.FromError(err); ok {
		return err
	}
	return rpcError(AsErrorResult(err))
}
