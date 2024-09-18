package clientmiddleware

import (
	"context"

	"github.com/grafana/grafana-plugin-sdk-go/backend"

	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/util/proxyutil"
)

// NewResourceResponseMiddleware creates a new plugins.ClientMiddleware
// that will enforce HTTP header rules for backend.CallResourceResponse's.
func NewResourceResponseMiddleware() plugins.ClientMiddleware {
	return plugins.ClientMiddlewareFunc(func(next plugins.Client) plugins.Client {
		return &ResourceResponseMiddleware{
			baseMiddleware: baseMiddleware{
				next: next,
			},
		}
	})
}

type ResourceResponseMiddleware struct {
	baseMiddleware
}

func (m *ResourceResponseMiddleware) QueryData(ctx context.Context, req *backend.QueryDataRequest) (*backend.QueryDataResponse, error) {
	return m.next.QueryData(ctx, req)
}

func (m *ResourceResponseMiddleware) CallResource(ctx context.Context, req *backend.CallResourceRequest, sender backend.CallResourceResponseSender) error {
	if req == nil || sender == nil {
		return m.next.CallResource(ctx, req, sender)
	}

	processedStreams := 0
	wrappedSender := callResourceResponseSenderFunc(func(res *backend.CallResourceResponse) error {
		if processedStreams == 0 {
			if res.Headers == nil {
				res.Headers = map[string][]string{}
			}

			proxyutil.SetProxyResponseHeaders(res.Headers)
		}

		processedStreams++
		return sender.Send(res)
	})

	return m.next.CallResource(ctx, req, wrappedSender)
}
