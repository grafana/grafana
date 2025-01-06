package coreplugin

import (
	"context"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"go.opentelemetry.io/otel/trace"

	"github.com/grafana/grafana/pkg/plugins"
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
	backend.AdmissionHandler
	backend.ConversionHandler
}

// New returns a new backendplugin.PluginFactoryFunc for creating a core (built-in) backendplugin.Plugin.
func New(opts backend.ServeOpts) backendplugin.PluginFactoryFunc {
	return func(pluginID string, logger log.Logger, _ trace.Tracer, _ func() []string) (backendplugin.Plugin, error) {
		return &corePlugin{
			pluginID:            pluginID,
			logger:              logger,
			CheckHealthHandler:  opts.CheckHealthHandler,
			CallResourceHandler: opts.CallResourceHandler,
			QueryDataHandler:    opts.QueryDataHandler,
			AdmissionHandler:    opts.AdmissionHandler,
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
	return nil, plugins.ErrMethodNotImplemented
}

func (cp *corePlugin) CheckHealth(ctx context.Context, req *backend.CheckHealthRequest) (*backend.CheckHealthResult, error) {
	if cp.CheckHealthHandler != nil {
		ctx = backend.WithGrafanaConfig(ctx, req.PluginContext.GrafanaConfig)
		return cp.CheckHealthHandler.CheckHealth(ctx, req)
	}

	return nil, plugins.ErrMethodNotImplemented
}

func (cp *corePlugin) QueryData(ctx context.Context, req *backend.QueryDataRequest) (*backend.QueryDataResponse, error) {
	if cp.QueryDataHandler != nil {
		ctx = backend.WithGrafanaConfig(ctx, req.PluginContext.GrafanaConfig)
		return cp.QueryDataHandler.QueryData(ctx, req)
	}

	return nil, plugins.ErrMethodNotImplemented
}

func (cp *corePlugin) CallResource(ctx context.Context, req *backend.CallResourceRequest, sender backend.CallResourceResponseSender) error {
	if cp.CallResourceHandler != nil {
		ctx = backend.WithGrafanaConfig(ctx, req.PluginContext.GrafanaConfig)
		return cp.CallResourceHandler.CallResource(ctx, req, sender)
	}

	return plugins.ErrMethodNotImplemented
}

func (cp *corePlugin) SubscribeStream(ctx context.Context, req *backend.SubscribeStreamRequest) (*backend.SubscribeStreamResponse, error) {
	if cp.StreamHandler != nil {
		ctx = backend.WithGrafanaConfig(ctx, req.PluginContext.GrafanaConfig)
		return cp.StreamHandler.SubscribeStream(ctx, req)
	}
	return nil, plugins.ErrMethodNotImplemented
}

func (cp *corePlugin) PublishStream(ctx context.Context, req *backend.PublishStreamRequest) (*backend.PublishStreamResponse, error) {
	if cp.StreamHandler != nil {
		ctx = backend.WithGrafanaConfig(ctx, req.PluginContext.GrafanaConfig)
		return cp.StreamHandler.PublishStream(ctx, req)
	}
	return nil, plugins.ErrMethodNotImplemented
}

func (cp *corePlugin) RunStream(ctx context.Context, req *backend.RunStreamRequest, sender *backend.StreamSender) error {
	if cp.StreamHandler != nil {
		ctx = backend.WithGrafanaConfig(ctx, req.PluginContext.GrafanaConfig)
		return cp.StreamHandler.RunStream(ctx, req, sender)
	}
	return plugins.ErrMethodNotImplemented
}

func (cp *corePlugin) MutateAdmission(ctx context.Context, req *backend.AdmissionRequest) (*backend.MutationResponse, error) {
	if cp.AdmissionHandler != nil {
		ctx = backend.WithGrafanaConfig(ctx, req.PluginContext.GrafanaConfig)
		return cp.AdmissionHandler.MutateAdmission(ctx, req)
	}
	return nil, plugins.ErrMethodNotImplemented
}

func (cp *corePlugin) ValidateAdmission(ctx context.Context, req *backend.AdmissionRequest) (*backend.ValidationResponse, error) {
	if cp.AdmissionHandler != nil {
		ctx = backend.WithGrafanaConfig(ctx, req.PluginContext.GrafanaConfig)
		return cp.AdmissionHandler.ValidateAdmission(ctx, req)
	}
	return nil, plugins.ErrMethodNotImplemented
}

func (cp *corePlugin) ConvertObjects(ctx context.Context, req *backend.ConversionRequest) (*backend.ConversionResponse, error) {
	if cp.ConversionHandler != nil {
		ctx = backend.WithGrafanaConfig(ctx, req.PluginContext.GrafanaConfig)
		return cp.ConversionHandler.ConvertObjects(ctx, req)
	}
	return nil, plugins.ErrMethodNotImplemented
}
