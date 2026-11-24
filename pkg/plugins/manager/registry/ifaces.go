package registry

import (
	"context"

	"github.com/grafana/grafana/pkg/plugins"
)

// Service is responsible for the internal storing and retrieval of plugins.
type Service interface {
	// Plugin finds a plugin by its ID and version.
	Plugin(ctx context.Context, id, version string) (*plugins.Plugin, bool)
	// Plugins returns all plugins.
	Plugins(ctx context.Context) []*plugins.Plugin
	// Add adds the provided plugin to the registry.
	Add(ctx context.Context, plugin *plugins.Plugin) error
	// Remove deletes the requested plugin from the registry.
	Remove(ctx context.Context, id, version string) error
}

// Notifier reports changes to the registered plugins. Code outside the plugin
// manager should use pluginstore.Notifier instead.
type Notifier interface {
	// Notify returns a channel that receives a value after a plugin is added or
	// removed. Changes are coalesced: a receiver that falls behind gets one value
	// for several changes, so it should read the registered plugins again after
	// each receive. The channel is closed once ctx is done.
	Notify(ctx context.Context) <-chan struct{}
}
