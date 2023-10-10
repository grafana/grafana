package clientmiddleware

import (
	"context"
	"errors"

	"github.com/grafana/grafana-plugin-sdk-go/backend"

	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/util/errutil"
)

// errQueryDataDownstreamError is an returned when a plugin QueryData request has
// failed with at least one QueryData response having statusSource = "downstream".
var errQueryDataDownstreamError = errutil.Internal(
	"plugin.queryDataDownstreamError",
	errutil.WithPublicMessage("Plugin QueryData downstream error"),
	errutil.WithDownstream(),
)

// NewQueryDataErrorSourceMiddleware creates a new plugins.ClientMiddleware
// that will wrap QueryDataResponse error source as errors returned by QueryData.
// This is used by [MetricsMiddleware] and [LoggerMiddleware] to correctly identify
// plugin downstream errors.
func NewQueryDataErrorSourceMiddleware() plugins.ClientMiddleware {
	return plugins.ClientMiddlewareFunc(func(next plugins.Client) plugins.Client {
		return &QueryDataErrorSourceMiddleware{
			next: next,
		}
	})
}

type QueryDataErrorSourceMiddleware struct {
	next plugins.Client
}

func (m *QueryDataErrorSourceMiddleware) QueryData(ctx context.Context, req *backend.QueryDataRequest) (*backend.QueryDataResponse, error) {
	resp, err := m.next.QueryData(ctx, req)

	// Aggregate all errors whose ErrorSource is backend.ErrorSourceDownstream.
	var queryDataResponseErr error
	for _, r := range resp.Responses {
		if r.Error == nil {
			continue
		}
		if r.ErrorSource == backend.ErrorSourceDownstream {
			queryDataResponseErr = errors.Join(queryDataResponseErr, r.Error)
		} else {
			// Other error source, this has higher priority, return the original
			// error immediately.
			return resp, err
		}
	}
	if queryDataResponseErr != nil {
		// If we have at least one downstream error, wrap the downstream errors and the original one in
		// a errQueryDataDownstreamError.
		return resp, errQueryDataDownstreamError.Errorf("query data downstream error: %w: %w", queryDataResponseErr, err)
	}
	return resp, err
}

func (m *QueryDataErrorSourceMiddleware) CallResource(ctx context.Context, req *backend.CallResourceRequest, sender backend.CallResourceResponseSender) error {
	return m.next.CallResource(ctx, req, sender)
}

func (m *QueryDataErrorSourceMiddleware) CheckHealth(ctx context.Context, req *backend.CheckHealthRequest) (*backend.CheckHealthResult, error) {
	return m.next.CheckHealth(ctx, req)
}

func (m *QueryDataErrorSourceMiddleware) CollectMetrics(ctx context.Context, req *backend.CollectMetricsRequest) (*backend.CollectMetricsResult, error) {
	return m.next.CollectMetrics(ctx, req)
}

func (m *QueryDataErrorSourceMiddleware) SubscribeStream(ctx context.Context, req *backend.SubscribeStreamRequest) (*backend.SubscribeStreamResponse, error) {
	return m.next.SubscribeStream(ctx, req)
}

func (m *QueryDataErrorSourceMiddleware) PublishStream(ctx context.Context, req *backend.PublishStreamRequest) (*backend.PublishStreamResponse, error) {
	return m.next.PublishStream(ctx, req)
}

func (m *QueryDataErrorSourceMiddleware) RunStream(ctx context.Context, req *backend.RunStreamRequest, sender *backend.StreamSender) error {
	return m.next.RunStream(ctx, req, sender)
}
