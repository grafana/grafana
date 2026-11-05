package resource

import (
	"google.golang.org/grpc/status"
)

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
	return GRPCStatusError(AsErrorResult(err))
}
