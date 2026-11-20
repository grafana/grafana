package client

import (
	"context"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
)

type routeKey struct{}

type streamRoute struct {
	pluginID string
	pipeline backend.StreamHandler
	remote   backend.StreamHandler
}

// RouteStream selects a remote transport after the plugin client middleware and registry checks.
func RouteStream(pluginID string, pipeline, remote backend.StreamHandler) backend.StreamHandler {
	return &streamRoute{pluginID, pipeline, remote}
}

func (r *streamRoute) SubscribeStream(ctx context.Context, req *backend.SubscribeStreamRequest) (*backend.SubscribeStreamResponse, error) {
	return r.pipeline.SubscribeStream(context.WithValue(ctx, routeKey{}, r), req)
}

func (r *streamRoute) PublishStream(ctx context.Context, req *backend.PublishStreamRequest) (*backend.PublishStreamResponse, error) {
	return r.pipeline.PublishStream(context.WithValue(ctx, routeKey{}, r), req)
}

func (r *streamRoute) RunStream(ctx context.Context, req *backend.RunStreamRequest, sender *backend.StreamSender) error {
	return r.pipeline.RunStream(context.WithValue(ctx, routeKey{}, r), req, sender)
}

func (s *Service) streamHandler(ctx context.Context, pc backend.PluginContext) (backend.StreamHandler, bool) {
	plugin, ok := s.plugin(ctx, pc.PluginID, pc.PluginVersion)
	if !ok {
		return nil, false
	}
	route, ok := ctx.Value(routeKey{}).(*streamRoute)
	if !ok {
		return plugin, true
	}
	if route.pluginID != pc.PluginID || !plugin.IsApp() || !plugin.Backend || !plugin.Streaming || pc.DataSourceInstanceSettings != nil {
		return nil, false
	}
	return route.remote, true
}
