package backendplugin

import (
	"context"

	datasourceV1 "github.com/grafana/grafana-plugin-model/go/datasource"
	rendererV1 "github.com/grafana/grafana-plugin-model/go/renderer"
	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/backend/grpcplugin"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/plugins/backendplugin/pluginextensionv2"
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
	CallResourceClientHandler
	// backend.QueryDataHandler
}

// PluginFactoryFunc factory for creating a Plugin.
type PluginFactoryFunc func(pluginID string, logger log.Logger, env []string) (Plugin, error)

// CallResourceClientResponseStream is used for receiving resource call responses.
type CallResourceClientResponseStream interface {
	Recv() (*backend.CallResourceResponse, error)
	Close() error
}

// CallResourceClientHandler handles client resource calls.
type CallResourceClientHandler interface {
	CallResource(ctx context.Context, req *backend.CallResourceRequest) (CallResourceClientResponseStream, error)
}

// CallResourceClientHandlerFunc is an adapter to allow the use of
// ordinary functions as backend.CallResourceClientHandler. If f is a function
// with the appropriate signature, CallResourceClientHandlerFunc(f) is a
// Handler that calls f.
type CallResourceClientHandlerFunc func(ctx context.Context, req *backend.CallResourceRequest) (CallResourceClientResponseStream, error)

// CallResource calls fn(ctx, req, sender).
func (fn CallResourceClientHandlerFunc) CallResource(ctx context.Context, req *backend.CallResourceRequest) (CallResourceClientResponseStream, error) {
	return fn(ctx, req)
}

type DiagnosticsPlugin interface {
	grpcplugin.DiagnosticsClient
}

type ResourcePlugin interface {
	grpcplugin.ResourceClient
}

type DataPlugin interface {
	grpcplugin.DataClient
}

type TransformPlugin interface {
	grpcplugin.TransformClient
}

// LegacyClient client for communicating with a plugin using the old plugin protocol.
type LegacyClient struct {
	DatasourcePlugin datasourceV1.DatasourcePlugin
	RendererPlugin   rendererV1.RendererPlugin
}

// Client client for communicating with a plugin using the current plugin protocol.
type Client struct {
	DataPlugin      DataPlugin
	TransformPlugin TransformPlugin
	RendererPlugin  pluginextensionv2.RendererPlugin
}
