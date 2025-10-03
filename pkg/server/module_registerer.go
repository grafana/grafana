package server

import (
	"github.com/grafana/grafana/pkg/modules"
)

// ModuleRegisterer is used to inject enterprise dskit modules into
// the target module manager.
type ModuleRegisterer interface {
	RegisterModules(manager modules.Registry)
}

type noopModuleRegisterer struct{}

func (noopModuleRegisterer) RegisterModules(manager modules.Registry) {}

func ProvideNoopModuleRegisterer() ModuleRegisterer {
	return &noopModuleRegisterer{}
}
