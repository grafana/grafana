package plugins

import (
	"context"

	"github.com/grafana/grafana-plugin-sdk-go/backend"

	"github.com/grafana/grafana/pkg/plugins/backendplugin"
)

// Store is the storage for plugins.
type Store interface {
	// Plugin finds a plugin by its ID.
	Plugin(ctx context.Context, pluginID string) (PluginDTO, bool)
	// Plugins returns plugins by their requested type.
	Plugins(ctx context.Context, pluginTypes ...Type) []PluginDTO
}

type UpdateInfo struct {
	PluginZipURL string
}

// Client is used to communicate with backend plugin implementations.
type Client interface {
	backend.QueryDataHandler
	backend.CheckHealthHandler
	backend.StreamHandler
	backend.CallResourceHandler
	backend.CollectMetricsHandler
}

// BackendFactoryProvider provides a backend factory for a provided plugin.
type BackendFactoryProvider interface {
	BackendFactory(ctx context.Context, p *Plugin) backendplugin.PluginFactoryFunc
}

type RendererManager interface {
	// Renderer returns a renderer plugin.
	Renderer() *Plugin
}

type SecretsPluginManager interface {
	// SecretsManager returns a secretsmanager plugin
	SecretsManager() *Plugin
}
