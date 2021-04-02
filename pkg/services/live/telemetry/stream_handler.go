package telemetry

import (
	"context"
	"fmt"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
)

type testStreamHandler struct {
	cache *Cache
}

func newTelemetryStreamHandler(cache *Cache) *testStreamHandler {
	return &testStreamHandler{
		cache: cache,
	}
}

func (p *testStreamHandler) SubscribeStream(_ context.Context, req *backend.SubscribeStreamRequest) (*backend.SubscribeStreamResponse, error) {
	schema, ok, err := p.cache.Get(req.Path)
	if err != nil {
		return nil, err
	}
	if !ok {
		return nil, fmt.Errorf("schema not found: %v", err)
	}
	return &backend.SubscribeStreamResponse{
		Status: backend.SubscribeStreamStatusOK,
		Data:   schema,
	}, nil
}

func (p *testStreamHandler) PublishStream(_ context.Context, req *backend.PublishStreamRequest) (*backend.PublishStreamResponse, error) {
	return &backend.PublishStreamResponse{
		Status: backend.PublishStreamStatusPermissionDenied,
	}, nil
}

func (p *testStreamHandler) RunStream(ctx context.Context, request *backend.RunStreamRequest, sender backend.StreamPacketSender) error {
	return nil
}
