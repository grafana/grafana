package clientmiddleware

import (
	"context"

	"github.com/grafana/grafana-plugin-sdk-go/backend"

	"github.com/grafana/grafana/pkg/infra/log"
)

// NewContextualLoggerMiddleware creates a new backend.HandlerMiddleware that adds
// a contextual logger to the request context.
func NewContextualLoggerMiddleware() backend.HandlerMiddleware {
	return backend.HandlerMiddlewareFunc(func(next backend.Handler) backend.Handler {
		return &ContextualLoggerMiddleware{
			BaseHandler: backend.NewBaseHandler(next),
		}
	})
}

type ContextualLoggerMiddleware struct {
	backend.BaseHandler
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
	return m.BaseHandler.QueryData(ctx, req)
}

func (m *ContextualLoggerMiddleware) CallResource(ctx context.Context, req *backend.CallResourceRequest, sender backend.CallResourceResponseSender) error {
	ctx = instrumentContext(ctx, req.PluginContext)
	return m.BaseHandler.CallResource(ctx, req, sender)
}

func (m *ContextualLoggerMiddleware) CheckHealth(ctx context.Context, req *backend.CheckHealthRequest) (*backend.CheckHealthResult, error) {
	ctx = instrumentContext(ctx, req.PluginContext)
	return m.BaseHandler.CheckHealth(ctx, req)
}

func (m *ContextualLoggerMiddleware) CollectMetrics(ctx context.Context, req *backend.CollectMetricsRequest) (*backend.CollectMetricsResult, error) {
	ctx = instrumentContext(ctx, req.PluginContext)
	return m.BaseHandler.CollectMetrics(ctx, req)
}

func (m *ContextualLoggerMiddleware) SubscribeStream(ctx context.Context, req *backend.SubscribeStreamRequest) (*backend.SubscribeStreamResponse, error) {
	ctx = instrumentContext(ctx, req.PluginContext)
	return m.BaseHandler.SubscribeStream(ctx, req)
}

func (m *ContextualLoggerMiddleware) PublishStream(ctx context.Context, req *backend.PublishStreamRequest) (*backend.PublishStreamResponse, error) {
	ctx = instrumentContext(ctx, req.PluginContext)
	return m.BaseHandler.PublishStream(ctx, req)
}

func (m *ContextualLoggerMiddleware) RunStream(ctx context.Context, req *backend.RunStreamRequest, sender *backend.StreamSender) error {
	ctx = instrumentContext(ctx, req.PluginContext)
	return m.BaseHandler.RunStream(ctx, req, sender)
}

// ValidateAdmission implements backend.AdmissionHandler.
func (m *ContextualLoggerMiddleware) ValidateAdmission(ctx context.Context, req *backend.AdmissionRequest) (*backend.ValidationResponse, error) {
	ctx = instrumentContext(ctx, req.PluginContext)
	return m.BaseHandler.ValidateAdmission(ctx, req)
}

// MutateAdmission implements backend.AdmissionHandler.
func (m *ContextualLoggerMiddleware) MutateAdmission(ctx context.Context, req *backend.AdmissionRequest) (*backend.MutationResponse, error) {
	ctx = instrumentContext(ctx, req.PluginContext)
	return m.BaseHandler.MutateAdmission(ctx, req)
}

// ConvertObject implements backend.AdmissionHandler.
func (m *ContextualLoggerMiddleware) ConvertObjects(ctx context.Context, req *backend.ConversionRequest) (*backend.ConversionResponse, error) {
	ctx = instrumentContext(ctx, req.PluginContext)
	return m.BaseHandler.ConvertObjects(ctx, req)
}
