package clientmiddleware

import (
	"context"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/signingkeys"
	"github.com/grafana/grafana/pkg/web"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/services/contexthandler"
)

const IPHeaderName = "X-Real-IP"
const InternalRequestHeaderName = "X-Grafana-Internal-Request"

// NewIPRangeACHeaderMiddleware creates a new plugins.ClientMiddleware that will
// populate the X-Real-IP header for external requests
// and set X-Grafana-Internal-Request header for plugin requests originating from Grafana.
func NewIPRangeACHeaderMiddleware() plugins.ClientMiddleware {
	return plugins.ClientMiddlewareFunc(func(next plugins.Client) plugins.Client {
		return &IPRangeACHeaderMiddleware{
			next: next,
			log:  log.New("ip_header_middleware"),
		}
	})
}

type IPRangeACHeaderMiddleware struct {
	next   plugins.Client
	keySvc signingkeys.Service
	log    log.Logger
}

func (m *IPRangeACHeaderMiddleware) applyRemoteAddressHeader(ctx context.Context, pCtx backend.PluginContext, h backend.ForwardHTTPHeaders) {
	// if request is not for a datasource, skip the middleware
	if h == nil || pCtx.DataSourceInstanceSettings == nil {
		return
	}
	reqCtx := contexthandler.FromContext(ctx)

	// TODO sign the headers or add some other security measure to prevent spoofing
	if reqCtx != nil && reqCtx.Req != nil {
		remoteAddress := web.RemoteAddr(reqCtx.Req)
		h.SetHTTPHeader(IPHeaderName, remoteAddress)
		return
	}

	h.SetHTTPHeader(InternalRequestHeaderName, "true")
}

func (m *IPRangeACHeaderMiddleware) QueryData(ctx context.Context, req *backend.QueryDataRequest) (*backend.QueryDataResponse, error) {
	if req == nil {
		return m.next.QueryData(ctx, req)
	}

	m.applyRemoteAddressHeader(ctx, req.PluginContext, req)

	return m.next.QueryData(ctx, req)
}

func (m *IPRangeACHeaderMiddleware) CallResource(ctx context.Context, req *backend.CallResourceRequest, sender backend.CallResourceResponseSender) error {
	if req == nil {
		return m.next.CallResource(ctx, req, sender)
	}

	m.applyRemoteAddressHeader(ctx, req.PluginContext, req)

	return m.next.CallResource(ctx, req, sender)
}

func (m *IPRangeACHeaderMiddleware) CheckHealth(ctx context.Context, req *backend.CheckHealthRequest) (*backend.CheckHealthResult, error) {
	if req == nil {
		return m.next.CheckHealth(ctx, req)
	}

	m.applyRemoteAddressHeader(ctx, req.PluginContext, req)

	return m.next.CheckHealth(ctx, req)
}

// TODO check what all of these do and whether we need to apply the header for all of them
func (m *IPRangeACHeaderMiddleware) CollectMetrics(ctx context.Context, req *backend.CollectMetricsRequest) (*backend.CollectMetricsResult, error) {
	return m.next.CollectMetrics(ctx, req)
}

func (m *IPRangeACHeaderMiddleware) SubscribeStream(ctx context.Context, req *backend.SubscribeStreamRequest) (*backend.SubscribeStreamResponse, error) {
	return m.next.SubscribeStream(ctx, req)
}

func (m *IPRangeACHeaderMiddleware) PublishStream(ctx context.Context, req *backend.PublishStreamRequest) (*backend.PublishStreamResponse, error) {
	return m.next.PublishStream(ctx, req)
}

func (m *IPRangeACHeaderMiddleware) RunStream(ctx context.Context, req *backend.RunStreamRequest, sender *backend.StreamSender) error {
	return m.next.RunStream(ctx, req, sender)
}
