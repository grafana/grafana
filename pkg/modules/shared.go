package modules

import (
	"github.com/gorilla/mux"
	"google.golang.org/grpc"
)

// Dependencies exposes services that the module server's own modules create,
// to modules registered by other builds. A module may only use them from its
// init function, and only if it depends on the module that creates them.
type Dependencies interface {
	// HTTPRouter returns the router of the instrumentation server, which also
	// serves /metrics and the health probes. It is created by
	// InstrumentationServer, and is nil when a target with its own HTTP server
	// (such as all) is running.
	HTTPRouter() *mux.Router

	// GRPCServer returns the gRPC server configured by [grpc_server], which
	// is created by GRPCServer. Register services on it from the module's init
	// function, before it serves.
	GRPCServer() *grpc.Server

	// ReadyNotifier sets the readiness reported by the instrumentation
	// server's /readyz endpoint.
	ReadyNotifier() ReadyNotifier
}

// ReadyNotifier sets a module's readiness.
type ReadyNotifier interface {
	SetReady()
	SetNotReady()
}
