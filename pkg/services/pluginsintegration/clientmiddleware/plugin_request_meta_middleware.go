package clientmiddleware

import (
	"context"

	"github.com/grafana/grafana-plugin-sdk-go/backend"

	"github.com/grafana/grafana/pkg/plugins/pluginrequestmeta"
)

// NewPluginRequestMetaMiddleware returns a new backend.HandlerMiddleware that sets up the default
// values for the plugin request meta in the context.Context. All middlewares that are executed
// after this one are be able to access plugin request meta via the pluginrequestmeta package.
func NewPluginRequestMetaMiddleware() backend.HandlerMiddleware {
	return backend.HandlerMiddlewareFunc(func(next backend.Handler) backend.Handler {
		return &PluginRequestMetaMiddleware{
			BaseHandler:         backend.NewBaseHandler(next),
			defaultStatusSource: pluginrequestmeta.DefaultStatusSource,
		}
	})
}

type PluginRequestMetaMiddleware struct {
	backend.BaseHandler
	defaultStatusSource pluginrequestmeta.StatusSource
}

func (m *PluginRequestMetaMiddleware) withDefaultPluginRequestMeta(ctx context.Context) context.Context {
	// Setup plugin request status source
	ctx = pluginrequestmeta.WithStatusSource(ctx, m.defaultStatusSource)

	return ctx
}

func (m *PluginRequestMetaMiddleware) QueryData(ctx context.Context, req *backend.QueryDataRequest) (*backend.QueryDataResponse, error) {
	ctx = m.withDefaultPluginRequestMeta(ctx)
	return m.BaseHandler.QueryData(ctx, req)
}

func (m *PluginRequestMetaMiddleware) CallResource(ctx context.Context, req *backend.CallResourceRequest, sender backend.CallResourceResponseSender) error {
	ctx = m.withDefaultPluginRequestMeta(ctx)
	return m.BaseHandler.CallResource(ctx, req, sender)
}

func (m *PluginRequestMetaMiddleware) CheckHealth(ctx context.Context, req *backend.CheckHealthRequest) (*backend.CheckHealthResult, error) {
	ctx = m.withDefaultPluginRequestMeta(ctx)
	return m.BaseHandler.CheckHealth(ctx, req)
}

func (m *PluginRequestMetaMiddleware) CollectMetrics(ctx context.Context, req *backend.CollectMetricsRequest) (*backend.CollectMetricsResult, error) {
	ctx = m.withDefaultPluginRequestMeta(ctx)
	return m.BaseHandler.CollectMetrics(ctx, req)
}

func (m *PluginRequestMetaMiddleware) SubscribeStream(ctx context.Context, req *backend.SubscribeStreamRequest) (*backend.SubscribeStreamResponse, error) {
	ctx = m.withDefaultPluginRequestMeta(ctx)
	return m.BaseHandler.SubscribeStream(ctx, req)
}

func (m *PluginRequestMetaMiddleware) PublishStream(ctx context.Context, req *backend.PublishStreamRequest) (*backend.PublishStreamResponse, error) {
	ctx = m.withDefaultPluginRequestMeta(ctx)
	return m.BaseHandler.PublishStream(ctx, req)
}

func (m *PluginRequestMetaMiddleware) RunStream(ctx context.Context, req *backend.RunStreamRequest, sender *backend.StreamSender) error {
	ctx = m.withDefaultPluginRequestMeta(ctx)
	return m.BaseHandler.RunStream(ctx, req, sender)
}

// ValidateAdmission implements backend.AdmissionHandler.
func (m *PluginRequestMetaMiddleware) ValidateAdmission(ctx context.Context, req *backend.AdmissionRequest) (*backend.ValidationResponse, error) {
	ctx = m.withDefaultPluginRequestMeta(ctx)
	return m.BaseHandler.ValidateAdmission(ctx, req)
}

// MutateAdmission implements backend.AdmissionHandler.
func (m *PluginRequestMetaMiddleware) MutateAdmission(ctx context.Context, req *backend.AdmissionRequest) (*backend.MutationResponse, error) {
	ctx = m.withDefaultPluginRequestMeta(ctx)
	return m.BaseHandler.MutateAdmission(ctx, req)
}

// ConvertObject implements backend.AdmissionHandler.
func (m *PluginRequestMetaMiddleware) ConvertObjects(ctx context.Context, req *backend.ConversionRequest) (*backend.ConversionResponse, error) {
	ctx = m.withDefaultPluginRequestMeta(ctx)
	return m.BaseHandler.ConvertObjects(ctx, req)
}
