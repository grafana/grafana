package clientmiddleware_test

import (
	"context"
	"testing"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/plugins/manager/client"
	"github.com/grafana/grafana/pkg/plugins/manager/pluginfakes"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/clientmiddleware"
)

type routedSubscribeFunc func(context.Context, *backend.SubscribeStreamRequest) (*backend.SubscribeStreamResponse, error)

type routedSubscribe struct {
	backend.StreamHandler
	routedSubscribeFunc
}

func (r routedSubscribe) SubscribeStream(ctx context.Context, req *backend.SubscribeStreamRequest) (*backend.SubscribeStreamResponse, error) {
	return r.routedSubscribeFunc(ctx, req)
}

func TestRoutedStreamRunsClientMiddlewareAndChecksRegistration(t *testing.T) {
	ctx := identity.WithRequester(context.Background(), &identity.StaticRequester{IDToken: "middleware-identity"})
	registry := pluginfakes.NewFakePluginRegistry()
	terminal := client.ProvideService(registry)
	req := &backend.SubscribeStreamRequest{PluginContext: backend.PluginContext{PluginID: "test-app"}}
	pipeline := clientmiddleware.NewForwardIDMiddleware(nil).CreateHandlerMiddleware(terminal)
	calls := 0
	remote := routedSubscribe{routedSubscribeFunc: func(_ context.Context, req *backend.SubscribeStreamRequest) (*backend.SubscribeStreamResponse, error) {
		require.Equal(t, "middleware-identity", req.GetHTTPHeader("X-Grafana-Id"))
		calls++
		return &backend.SubscribeStreamResponse{}, nil
	}}
	route := client.RouteStream("test-app", pipeline, remote)
	_, err := route.SubscribeStream(ctx, req)
	require.ErrorIs(t, err, plugins.ErrPluginNotRegistered)
	p := &plugins.Plugin{JSONData: plugins.JSONData{ID: "test-app", Type: plugins.TypeApp, Backend: true, Streaming: true}}
	require.NoError(t, registry.Add(ctx, p))
	_, err = route.SubscribeStream(ctx, req)
	require.NoError(t, err)
	req.PluginContext.DataSourceInstanceSettings = &backend.DataSourceInstanceSettings{}
	_, err = route.SubscribeStream(ctx, req)
	require.ErrorIs(t, err, plugins.ErrPluginNotRegistered)
	require.Equal(t, 1, calls)
}
