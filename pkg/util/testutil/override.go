package testutil

import (
	"reflect"

	"github.com/grafana/grafana/pkg/registry"
)

// OverrideServiceInRegistry allows to override service in a registry, useful to
// run migrations that depend on feature toggle.
func OverrideServiceInRegistry(service registry.Service) {
	overrideServiceFunc := func(descriptor registry.Descriptor) (*registry.Descriptor, bool) {
		if reflect.TypeOf(descriptor.Instance) == reflect.TypeOf(service) {
			return &registry.Descriptor{
				Name:         descriptor.Name,
				Instance:     service,
				InitPriority: descriptor.InitPriority,
			}, true
		}
		return nil, false
	}
	registry.RegisterOverride(overrideServiceFunc)
}
