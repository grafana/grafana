package manager

import "context"

type Service interface {
	// Add adds a new plugin to the manager.
	Add(ctx context.Context, pluginID, version string) error
	// Remove removes a plugin from the manager.
	Remove(ctx context.Context, pluginID string) error
}

type Runner interface {
	// Run uses the Service to execute some workload
	Run(ctx context.Context, pluginManager Service) error
}
