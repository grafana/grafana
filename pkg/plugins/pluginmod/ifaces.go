package pluginmod

import (
	"context"

	"github.com/grafana/grafana/pkg/plugins"
)

type PluginManager interface {
	// Add adds a new plugin.
	Add(ctx context.Context, pluginID, version string, opts plugins.CompatOpts) error
	// Remove removes an existing plugin.
	Remove(ctx context.Context, pluginID string) error
}
