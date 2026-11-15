package modules

import (
	"github.com/gorilla/mux"
	"google.golang.org/grpc"

	"github.com/grafana/grafana/pkg/infra/nats"
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

	// NATSPublisher returns the NATS publisher created by NATS, configured by
	// [nats]. It is nil unless the NATS module has initialized, and when [nats]
	// is disabled it reports Enabled() == false. The NATS module owns the
	// connection and drains it on shutdown, after the modules that depend on it
	// have stopped.
	NATSPublisher() nats.Publisher

	// ReadyNotifier sets the readiness reported by the instrumentation
	// server's /readyz endpoint.
	ReadyNotifier() ReadyNotifier
}

// ReadyNotifier sets a module's readiness.
type ReadyNotifier interface {
	SetReady()
	SetNotReady()
}
