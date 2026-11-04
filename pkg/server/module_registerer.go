package server

import (
	"github.com/gorilla/mux"
	"google.golang.org/grpc"

	"github.com/grafana/grafana/pkg/modules"
)

// ModuleRegisterer is used to inject enterprise dskit modules into
// the module manager. This abstraction allows other builds (e.g. enterprise) to register
// additional modules while keeping the core server decoupled from build-specific dependencies.
type ModuleRegisterer interface {
	// RegisterModules registers modules on manager. Their init functions can
	// use the services in deps that the modules they depend on create.
	RegisterModules(manager modules.Registry, deps modules.Dependencies)
}

var _ modules.Dependencies = (*ModuleServer)(nil)

// HTTPRouter implements modules.Dependencies.
func (s *ModuleServer) HTTPRouter() *mux.Router {
	return s.httpServerRouter
}

// GRPCServer implements modules.Dependencies.
func (s *ModuleServer) GRPCServer() *grpc.Server {
	if s.grpcService == nil {
		return nil
	}
	return s.grpcService.GetServer()
}

// ReadyNotifier implements modules.Dependencies.
func (s *ModuleServer) ReadyNotifier() modules.ReadyNotifier {
	return s.healthNotifier
}

type noopModuleRegisterer struct{}

func (noopModuleRegisterer) RegisterModules(modules.Registry, modules.Dependencies) {}

func ProvideNoopModuleRegisterer() ModuleRegisterer {
	return &noopModuleRegisterer{}
}
