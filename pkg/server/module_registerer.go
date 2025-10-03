package server

import (
	"github.com/grafana/grafana/pkg/modules"
)

type ModuleRegisterer interface {
	RegisterModules(manager modules.Registry)
}

type noopModuleRegisterer struct{}

func (noopModuleRegisterer) RegisterModules(manager modules.Registry) {
	// No-op
}

func ProvideNoopModuleRegisterer() ModuleRegisterer {
	return &noopModuleRegisterer{}
}
