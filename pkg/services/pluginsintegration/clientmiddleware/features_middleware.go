package clientmiddleware

import (
	"context"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
)

func NewFeaturesMiddleware(features *featuremgmt.FeatureManager) plugins.ClientMiddleware {
	return plugins.ClientMiddlewareFunc(func(next plugins.Client) plugins.Client {
		return &FeaturesMiddleware{
			next:     next,
			features: features,
		}
	})
}

type FeaturesMiddleware struct {
	next     plugins.Client
	features *featuremgmt.FeatureManager
}

func (m *FeaturesMiddleware) QueryData(ctx context.Context, req *backend.QueryDataRequest) (*backend.QueryDataResponse, error) {
	if req != nil {
		req.PluginContext.FeatureTogglesEnabled = m.features.GetEnabled(ctx)
	}
	return m.next.QueryData(ctx, req)
}

func (m *FeaturesMiddleware) CallResource(ctx context.Context, req *backend.CallResourceRequest, sender backend.CallResourceResponseSender) error {
	if req != nil {
		req.PluginContext.FeatureTogglesEnabled = m.features.GetEnabled(ctx)
	}
	return m.next.CallResource(ctx, req, sender)
}

func (m *FeaturesMiddleware) CheckHealth(ctx context.Context, req *backend.CheckHealthRequest) (*backend.CheckHealthResult, error) {
	if req != nil {
		req.PluginContext.FeatureTogglesEnabled = m.features.GetEnabled(ctx)
	}
	return m.next.CheckHealth(ctx, req)
}

func (m *FeaturesMiddleware) CollectMetrics(ctx context.Context, req *backend.CollectMetricsRequest) (*backend.CollectMetricsResult, error) {
	if req != nil {
		req.PluginContext.FeatureTogglesEnabled = m.features.GetEnabled(ctx)
	}
	return m.next.CollectMetrics(ctx, req)
}

func (m *FeaturesMiddleware) SubscribeStream(ctx context.Context, req *backend.SubscribeStreamRequest) (*backend.SubscribeStreamResponse, error) {
	if req != nil {
		req.PluginContext.FeatureTogglesEnabled = m.features.GetEnabled(ctx)
	}
	return m.next.SubscribeStream(ctx, req)
}

func (m *FeaturesMiddleware) PublishStream(ctx context.Context, req *backend.PublishStreamRequest) (*backend.PublishStreamResponse, error) {
	if req != nil {
		req.PluginContext.FeatureTogglesEnabled = m.features.GetEnabled(ctx)
	}
	return m.next.PublishStream(ctx, req)
}

func (m *FeaturesMiddleware) RunStream(ctx context.Context, req *backend.RunStreamRequest, sender *backend.StreamSender) error {
	if req != nil {
		req.PluginContext.FeatureTogglesEnabled = m.features.GetEnabled(ctx)
	}
	return m.next.RunStream(ctx, req, sender)
}
