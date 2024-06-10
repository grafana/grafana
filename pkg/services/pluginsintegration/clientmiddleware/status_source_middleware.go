package clientmiddleware

import (
	"context"
	"fmt"

	"github.com/grafana/grafana-plugin-sdk-go/backend"

	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/plugins/pluginrequestmeta"
)

// NewStatusSourceMiddleware returns a new plugins.ClientMiddleware that sets the status source in the
// plugin request meta stored in the context.Context, according to the query data responses returned by QueryError.
// If at least one query data response has a "downstream" status source and there isn't one with a "plugin" status source,
// the plugin request meta in the context is set to "downstream".
func NewStatusSourceMiddleware() plugins.ClientMiddleware {
	return plugins.ClientMiddlewareFunc(func(next plugins.Client) plugins.Client {
		return &StatusSourceMiddleware{
			next: next,
		}
	})
}

type StatusSourceMiddleware struct {
	next plugins.Client
}

func (m *StatusSourceMiddleware) QueryData(ctx context.Context, req *backend.QueryDataRequest) (*backend.QueryDataResponse, error) {
	resp, err := m.next.QueryData(ctx, req)
	if resp == nil || len(resp.Responses) == 0 {
		return resp, err
	}

	// Set downstream status source in the context if there's at least one response with downstream status source,
	// and if there's no plugin error
	var hasPluginError bool
	var hasDownstreamError bool
	for _, r := range resp.Responses {
		if r.Error == nil {
			continue
		}
		if r.ErrorSource == backend.ErrorSourceDownstream {
			hasDownstreamError = true
		} else {
			hasPluginError = true
		}
	}

	// A plugin error has higher priority than a downstream error,
	// so set to downstream only if there's no plugin error
	if hasDownstreamError && !hasPluginError {
		if err := pluginrequestmeta.WithDownstreamStatusSource(ctx); err != nil {
			return resp, fmt.Errorf("failed to set downstream status source: %w", err)
		}
	}

	return resp, err
}

func (m *StatusSourceMiddleware) CallResource(ctx context.Context, req *backend.CallResourceRequest, sender backend.CallResourceResponseSender) error {
	return m.next.CallResource(ctx, req, sender)
}

func (m *StatusSourceMiddleware) CheckHealth(ctx context.Context, req *backend.CheckHealthRequest) (*backend.CheckHealthResult, error) {
	return m.next.CheckHealth(ctx, req)
}

func (m *StatusSourceMiddleware) CollectMetrics(ctx context.Context, req *backend.CollectMetricsRequest) (*backend.CollectMetricsResult, error) {
	return m.next.CollectMetrics(ctx, req)
}

func (m *StatusSourceMiddleware) SubscribeStream(ctx context.Context, req *backend.SubscribeStreamRequest) (*backend.SubscribeStreamResponse, error) {
	return m.next.SubscribeStream(ctx, req)
}

func (m *StatusSourceMiddleware) PublishStream(ctx context.Context, req *backend.PublishStreamRequest) (*backend.PublishStreamResponse, error) {
	return m.next.PublishStream(ctx, req)
}

func (m *StatusSourceMiddleware) RunStream(ctx context.Context, req *backend.RunStreamRequest, sender *backend.StreamSender) error {
	return m.next.RunStream(ctx, req, sender)
}
