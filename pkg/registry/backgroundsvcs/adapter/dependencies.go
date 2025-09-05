package adapter

import "github.com/grafana/grafana/pkg/modules"

const (
	// BackgroundServices is an alias for any background service that is not explicitly listed in the dependency map.
	// This includes most background services in the BackgroundServiceRegistry.
	BackgroundServices = "background-services"

	// Core is an alias for a set of services that must be running before most other services can start.
	Core = "core"
)

// dependencyMap returns the module dependency relationships for the background service system.
// It defines the startup order and dependencies between different module groups.
// Background services are automatically added as dependencies to the BackgroundServices module
// unless they are explicitly listed in this map with custom dependencies.
func dependencyMap() map[string][]string {
	return map[string][]string{
		modules.GrafanaAPIServer: {},
		Core:                     {modules.GrafanaAPIServer},
		BackgroundServices:       {Core},
	}
}
