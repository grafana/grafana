package clientmiddleware

import (
	"context"

	"github.com/grafana/grafana-plugin-sdk-go/backend"

	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/plugins/pluginrequestmeta"
)

// NewPluginRequestMetaMiddleware returns a new plugins.ClientMiddleware that sets up the default
// values for the plugin request meta in the context.Context. All middlewares that are executed
// after this one are be able to access plugin request meta via the pluginrequestmeta package.
func NewPluginRequestMetaMiddleware() plugins.ClientMiddleware {
	return plugins.ClientMiddlewareFunc(func(next plugins.Client) plugins.Client {
		return &PluginRequestMetaMiddleware{
			next:                next,
			defaultStatusSource: pluginrequestmeta.DefaultStatusSource,
		}
	})
}

type PluginRequestMetaMiddleware struct {
	next                plugins.Client
	defaultStatusSource pluginrequestmeta.StatusSource
}

func (m *PluginRequestMetaMiddleware) withDefaultPluginRequestMeta(ctx context.Context) context.Context {
	// Setup plugin request status source
	ctx = pluginrequestmeta.WithStatusSource(ctx, m.defaultStatusSource)

	return ctx
}

func (m *PluginRequestMetaMiddleware) QueryData(ctx context.Context, req *backend.QueryDataRequest) (*backend.QueryDataResponse, error) {
	ctx = m.withDefaultPluginRequestMeta(ctx)
	return m.next.QueryData(ctx, req)
}

func (m *PluginRequestMetaMiddleware) CallResource(ctx context.Context, req *backend.CallResourceRequest, sender backend.CallResourceResponseSender) error {
	ctx = m.withDefaultPluginRequestMeta(ctx)
	return m.next.CallResource(ctx, req, sender)
}

func (m *PluginRequestMetaMiddleware) CheckHealth(ctx context.Context, req *backend.CheckHealthRequest) (*backend.CheckHealthResult, error) {
	ctx = m.withDefaultPluginRequestMeta(ctx)
	return m.next.CheckHealth(ctx, req)
}

func (m *PluginRequestMetaMiddleware) CollectMetrics(ctx context.Context, req *backend.CollectMetricsRequest) (*backend.CollectMetricsResult, error) {
	ctx = m.withDefaultPluginRequestMeta(ctx)
	return m.next.CollectMetrics(ctx, req)
}

func (m *PluginRequestMetaMiddleware) SubscribeStream(ctx context.Context, req *backend.SubscribeStreamRequest) (*backend.SubscribeStreamResponse, error) {
	ctx = m.withDefaultPluginRequestMeta(ctx)
	return m.next.SubscribeStream(ctx, req)
}

func (m *PluginRequestMetaMiddleware) PublishStream(ctx context.Context, req *backend.PublishStreamRequest) (*backend.PublishStreamResponse, error) {
	ctx = m.withDefaultPluginRequestMeta(ctx)
	return m.next.PublishStream(ctx, req)
}

func (m *PluginRequestMetaMiddleware) RunStream(ctx context.Context, req *backend.RunStreamRequest, sender *backend.StreamSender) error {
	ctx = m.withDefaultPluginRequestMeta(ctx)
	return m.next.RunStream(ctx, req, sender)
}
