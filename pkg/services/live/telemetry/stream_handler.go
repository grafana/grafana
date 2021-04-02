package telemetry

import (
	"context"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
)

type testStreamHandler struct {
	cache *Cache2
}

func newTelemetryStreamHandler(cache *Cache2) *testStreamHandler {
	return &testStreamHandler{
		cache: cache,
	}
}

func (p *testStreamHandler) SubscribeStream(_ context.Context, req *backend.SubscribeStreamRequest) (*backend.SubscribeStreamResponse, error) {
	logger.Info("subscribe", "XXX", req.PluginContext)
	cache := p.cache.GetOrCreate("aaa")

	schema, ok, err := cache.Get(req.Path)
	if err != nil {
		return nil, err
	}
	response := &backend.SubscribeStreamResponse{
		Status: backend.SubscribeStreamStatusOK,
	}
	if ok {
		response.Data = schema
	}
	return response, nil
}

func (p *testStreamHandler) PublishStream(_ context.Context, req *backend.PublishStreamRequest) (*backend.PublishStreamResponse, error) {
	return &backend.PublishStreamResponse{
		Status: backend.PublishStreamStatusPermissionDenied,
	}, nil
}

func (p *testStreamHandler) RunStream(ctx context.Context, request *backend.RunStreamRequest, sender backend.StreamPacketSender) error {
	return nil
}
