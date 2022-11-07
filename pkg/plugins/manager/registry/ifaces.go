package registry

import (
	"context"

	"github.com/grafana/grafana/pkg/plugins"
)

// Service is responsible for the internal storing and retrieval of plugins.
type Service interface {
	// Plugin finds a plugin by its ID.
	Plugin(ctx context.Context, id string) (*plugins.Plugin, bool)
	// Plugins returns all plugins.
	Plugins(ctx context.Context) []*plugins.Plugin
	// Add adds the provided plugin to the registry.
	Add(ctx context.Context, plugin *plugins.Plugin) error
	// Remove deletes the requested plugin from the registry.
	Remove(ctx context.Context, id string) error
}
