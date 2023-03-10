package coreplugin

import (
	"context"

	"github.com/grafana/grafana-plugin-sdk-go/backend"

	"github.com/grafana/grafana/pkg/plugins/backendplugin"
	"github.com/grafana/grafana/pkg/plugins/log"
)

// corePlugin represents a plugin that's part of Grafana core.
type corePlugin struct {
	pluginID string
	logger   log.Logger
	backend.CheckHealthHandler
	backend.CallResourceHandler
	backend.QueryDataHandler
	backend.StreamHandler
}

// New returns a new backendplugin.PluginFactoryFunc for creating a core (built-in) backendplugin.Plugin.
func New(opts backend.ServeOpts) backendplugin.PluginFactoryFunc {
	return func(pluginID string, logger log.Logger, env []string) (backendplugin.Plugin, error) {
		return &corePlugin{
			pluginID:            pluginID,
			logger:              logger,
			CheckHealthHandler:  opts.CheckHealthHandler,
			CallResourceHandler: opts.CallResourceHandler,
			QueryDataHandler:    opts.QueryDataHandler,
			StreamHandler:       opts.StreamHandler,
		}, nil
	}
}

func (cp *corePlugin) PluginID() string {
	return cp.pluginID
}

func (cp *corePlugin) Logger() log.Logger {
	return cp.logger
}

func (cp *corePlugin) Start(ctx context.Context) error {
	return nil
}

func (cp *corePlugin) Stop(ctx context.Context) error {
	return nil
}

func (cp *corePlugin) IsManaged() bool {
	return true
}

func (cp *corePlugin) Exited() bool {
	return false
}

func (cp *corePlugin) Decommission() error {
	return nil
}

func (cp *corePlugin) IsDecommissioned() bool {
	return false
}

func (cp *corePlugin) Target() backendplugin.Target {
	return backendplugin.TargetInMemory
}

func (cp *corePlugin) CollectMetrics(_ context.Context, _ *backend.CollectMetricsRequest) (*backend.CollectMetricsResult, error) {
	return nil, backendplugin.ErrMethodNotImplemented
}

func (cp *corePlugin) CheckHealth(ctx context.Context, req *backend.CheckHealthRequest) (*backend.CheckHealthResult, error) {
	if cp.CheckHealthHandler != nil {
		return cp.CheckHealthHandler.CheckHealth(ctx, req)
	}

	return nil, backendplugin.ErrMethodNotImplemented
}

func (cp *corePlugin) QueryData(ctx context.Context, req *backend.QueryDataRequest) (*backend.QueryDataResponse, error) {
	if cp.QueryDataHandler != nil {
		return cp.QueryDataHandler.QueryData(ctx, req)
	}

	return nil, backendplugin.ErrMethodNotImplemented
}

func (cp *corePlugin) CallResource(ctx context.Context, req *backend.CallResourceRequest, sender backend.CallResourceResponseSender) error {
	if cp.CallResourceHandler != nil {
		return cp.CallResourceHandler.CallResource(ctx, req, sender)
	}

	return backendplugin.ErrMethodNotImplemented
}

func (cp *corePlugin) SubscribeStream(ctx context.Context, req *backend.SubscribeStreamRequest) (*backend.SubscribeStreamResponse, error) {
	if cp.StreamHandler != nil {
		return cp.StreamHandler.SubscribeStream(ctx, req)
	}
	return nil, backendplugin.ErrMethodNotImplemented
}

func (cp *corePlugin) PublishStream(ctx context.Context, req *backend.PublishStreamRequest) (*backend.PublishStreamResponse, error) {
	if cp.StreamHandler != nil {
		return cp.StreamHandler.PublishStream(ctx, req)
	}
	return nil, backendplugin.ErrMethodNotImplemented
}

func (cp *corePlugin) RunStream(ctx context.Context, req *backend.RunStreamRequest, sender *backend.StreamSender) error {
	if cp.StreamHandler != nil {
		return cp.StreamHandler.RunStream(ctx, req, sender)
	}
	return backendplugin.ErrMethodNotImplemented
}
