package backendplugin

import (
	"context"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/models"
)

// Manager manages backend plugins.
type Manager interface {
	// Register registers a backend plugin
	Register(pluginID string, factory PluginFactoryFunc) error
	// Unregister unregisters a backend plugin
	Unregister(pluginID string) error
	// StartPlugin starts a non-managed backend plugin
	StartPlugin(ctx context.Context, pluginID string) error
	// CollectMetrics collects metrics from a registered backend plugin.
	CollectMetrics(ctx context.Context, pluginID string) (*backend.CollectMetricsResult, error)
	// CheckHealth checks the health of a registered backend plugin.
	CheckHealth(ctx context.Context, pCtx backend.PluginContext) (*backend.CheckHealthResult, error)
	// CallResource calls a plugin resource.
	CallResource(pluginConfig backend.PluginContext, ctx *models.ReqContext, path string)
	// Get plugin by its ID.
	Get(pluginID string) (Plugin, bool)
	// GetDataPlugin gets a DataPlugin with a certain ID or nil if it doesn't exist.
	// TODO: interface{} is the return type in order to break a dependency cycle. Should be plugins.DataPlugin.
	GetDataPlugin(pluginID string) interface{}
}

// Plugin is the backend plugin interface.
type Plugin interface {
	PluginID() string
	Logger() log.Logger
	Start(ctx context.Context) error
	Stop(ctx context.Context) error
	IsManaged() bool
	Exited() bool
	backend.CollectMetricsHandler
	backend.CheckHealthHandler
	backend.CallResourceHandler
	backend.StreamHandler
}
