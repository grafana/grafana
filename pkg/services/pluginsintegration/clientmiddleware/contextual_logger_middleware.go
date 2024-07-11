package clientmiddleware

import (
	"context"

	"github.com/grafana/grafana-plugin-sdk-go/backend"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/plugins"
)

// NewContextualLoggerMiddleware creates a new plugins.ClientMiddleware that adds
// a contextual logger to the request context.
func NewContextualLoggerMiddleware() plugins.ClientMiddleware {
	return plugins.ClientMiddlewareFunc(func(next plugins.Client) plugins.Client {
		return &ContextualLoggerMiddleware{
			next: next,
		}
	})
}

type ContextualLoggerMiddleware struct {
	next plugins.Client
}

// instrumentContext adds a contextual logger with plugin and request details to the given context.
func instrumentContext(ctx context.Context, pCtx backend.PluginContext) context.Context {
	p := []any{}

	if ep := backend.EndpointFromContext(ctx); !ep.IsEmpty() {
		p = append(p, "endpoint", string(ep))
	}

	p = append(p, "pluginId", pCtx.PluginID)

	if pCtx.DataSourceInstanceSettings != nil {
		p = append(p, "dsName", pCtx.DataSourceInstanceSettings.Name)
		p = append(p, "dsUID", pCtx.DataSourceInstanceSettings.UID)
	}
	if pCtx.User != nil {
		p = append(p, "uname", pCtx.User.Login)
	}
	return log.WithContextualAttributes(ctx, p)
}

func (m *ContextualLoggerMiddleware) QueryData(ctx context.Context, req *backend.QueryDataRequest) (*backend.QueryDataResponse, error) {
	ctx = instrumentContext(ctx, req.PluginContext)
	return m.next.QueryData(ctx, req)
}

func (m *ContextualLoggerMiddleware) CallResource(ctx context.Context, req *backend.CallResourceRequest, sender backend.CallResourceResponseSender) error {
	ctx = instrumentContext(ctx, req.PluginContext)
	return m.next.CallResource(ctx, req, sender)
}

func (m *ContextualLoggerMiddleware) CheckHealth(ctx context.Context, req *backend.CheckHealthRequest) (*backend.CheckHealthResult, error) {
	ctx = instrumentContext(ctx, req.PluginContext)
	return m.next.CheckHealth(ctx, req)
}

func (m *ContextualLoggerMiddleware) CollectMetrics(ctx context.Context, req *backend.CollectMetricsRequest) (*backend.CollectMetricsResult, error) {
	ctx = instrumentContext(ctx, req.PluginContext)
	return m.next.CollectMetrics(ctx, req)
}

func (m *ContextualLoggerMiddleware) SubscribeStream(ctx context.Context, req *backend.SubscribeStreamRequest) (*backend.SubscribeStreamResponse, error) {
	ctx = instrumentContext(ctx, req.PluginContext)
	return m.next.SubscribeStream(ctx, req)
}

func (m *ContextualLoggerMiddleware) PublishStream(ctx context.Context, req *backend.PublishStreamRequest) (*backend.PublishStreamResponse, error) {
	ctx = instrumentContext(ctx, req.PluginContext)
	return m.next.PublishStream(ctx, req)
}

func (m *ContextualLoggerMiddleware) RunStream(ctx context.Context, req *backend.RunStreamRequest, sender *backend.StreamSender) error {
	ctx = instrumentContext(ctx, req.PluginContext)
	return m.next.RunStream(ctx, req, sender)
}

// ValidateAdmission implements backend.AdmissionHandler.
func (m *ContextualLoggerMiddleware) ValidateAdmission(ctx context.Context, req *backend.AdmissionRequest) (*backend.ValidationResponse, error) {
	ctx = instrumentContext(ctx, req.PluginContext)
	return m.next.ValidateAdmission(ctx, req)
}

// MutateAdmission implements backend.AdmissionHandler.
func (m *ContextualLoggerMiddleware) MutateAdmission(ctx context.Context, req *backend.AdmissionRequest) (*backend.MutationResponse, error) {
	ctx = instrumentContext(ctx, req.PluginContext)
	return m.next.MutateAdmission(ctx, req)
}

// ConvertObject implements backend.AdmissionHandler.
func (m *ContextualLoggerMiddleware) ConvertObject(ctx context.Context, req *backend.ConversionRequest) (*backend.ConversionResponse, error) {
	ctx = instrumentContext(ctx, req.PluginContext)
	return m.next.ConvertObject(ctx, req)
}

func (m *ContextualLoggerMiddleware) MigrateQuery(ctx context.Context, req *backend.QueryMigrationRequest) (*backend.QueryMigrationResponse, error) {
	ctx = instrumentContext(ctx, req.PluginContext)
	return m.next.MigrateQuery(ctx, req)
}
