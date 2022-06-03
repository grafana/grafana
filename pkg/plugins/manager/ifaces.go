package manager

import "context"

type Service interface {
	// Add adds a plugin to the store.
	Add(ctx context.Context, pluginID, version string) error
	// Remove removes a plugin from the store.
	Remove(ctx context.Context, pluginID string) error
}

type Runner interface {
	Run(ctx context.Context, pluginManager Service) error
}
