package server

import (
	"github.com/grafana/grafana/pkg/modules"
)

// ModuleRegisterer is used to inject enterprise dskit modules into
// the module manager. This abstraction allows other builds (e.g. enterprise) to register
// additional modules while keeping the core server decoupled from build-specific dependencies.
type ModuleRegisterer interface {
	RegisterModules(manager modules.Registry)
}

type noopModuleRegisterer struct{}

func (noopModuleRegisterer) RegisterModules(manager modules.Registry) {}

func ProvideNoopModuleRegisterer() ModuleRegisterer {
	return &noopModuleRegisterer{}
}
