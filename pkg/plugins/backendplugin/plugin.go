package backendplugin

import (
	"context"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana/pkg/infra/log"
)

// Plugin backend plugin interface.
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
}

// PluginFactoryFunc factory for creating a Plugin.
type PluginFactoryFunc func(pluginID string, logger log.Logger, env []string) (Plugin, error)

// CallResourceClientResponseStream is used for receiving resource call responses.
type CallResourceClientResponseStream interface {
	Recv() (*backend.CallResourceResponse, error)
	Close() error
}
