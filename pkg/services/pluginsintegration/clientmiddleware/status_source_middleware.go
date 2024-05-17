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
			baseMiddleware: baseMiddleware{
				next: next,
			},
		}
	})
}

type StatusSourceMiddleware struct {
	baseMiddleware
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
