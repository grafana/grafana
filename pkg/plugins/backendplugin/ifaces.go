package backendplugin

import (
	"context"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/models"
)

// Manager manages backend plugins.
type Manager interface {
	//Register registers a backend plugin
	Register(pluginID string, factory PluginFactoryFunc) error
	// RegisterAndStart registers and starts a backend plugin
	RegisterAndStart(ctx context.Context, pluginID string, factory PluginFactoryFunc) error
	// UnregisterAndStop unregisters and stops a backend plugin
	UnregisterAndStop(ctx context.Context, pluginID string) error
	// IsRegistered checks if a plugin is registered with the manager
	IsRegistered(pluginID string) bool
	// StartPlugin starts a non-managed backend plugin
	StartPlugin(ctx context.Context, pluginID string) error
	// CollectMetrics collects metrics from a registered backend plugin.
	CollectMetrics(ctx context.Context, pluginID string) (*backend.CollectMetricsResult, error)
	// CheckHealth checks the health of a registered backend plugin.
	CheckHealth(ctx context.Context, pCtx backend.PluginContext) (*backend.CheckHealthResult, error)
	// QueryData query data from a registered backend plugin.
	QueryData(ctx context.Context, req *backend.QueryDataRequest) (*backend.QueryDataResponse, error)
	// CallResource calls a plugin resource.
	CallResource(pluginConfig backend.PluginContext, ctx *models.ReqContext, path string)
	// Get plugin by its ID.
	Get(pluginID string) (Plugin, bool)
}

// Plugin is the backend plugin interface.
type Plugin interface {
	PluginID() string
	Logger() log.Logger
	Start(ctx context.Context) error
	Stop(ctx context.Context) error
	IsManaged() bool
	Exited() bool
	Decommission() error
	IsDecommissioned() bool
	backend.CollectMetricsHandler
	backend.CheckHealthHandler
	backend.QueryDataHandler
	backend.CallResourceHandler
	backend.StreamHandler
}
