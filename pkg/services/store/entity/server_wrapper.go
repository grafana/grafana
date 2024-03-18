package entity

import context "context"

// EntityStoreServerWrapper wraps the gRPC server with utility methods to
// control execution.
type EntityStoreServerWrapper interface {
	EntityStoreServer
	Stop(context.Context) error
}
