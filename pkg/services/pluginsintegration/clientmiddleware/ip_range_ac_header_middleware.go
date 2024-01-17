package clientmiddleware

import (
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"slices"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/services/contexthandler"
	"github.com/grafana/grafana/pkg/services/signingkeys"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/web"
)

const IPRangeHeaderName = "X-Grafana-IP-Range-AC"

// NewIPRangeACHeaderMiddleware creates a new plugins.ClientMiddleware that will
// populate the X-Real-IP header for external requests
// and set X-Grafana-Internal-Request header for plugin requests originating from Grafana.
func NewIPRangeACHeaderMiddleware(cfg *setting.Cfg) plugins.ClientMiddleware {
	return plugins.ClientMiddlewareFunc(func(next plugins.Client) plugins.Client {
		return &IPRangeACHeaderMiddleware{
			next: next,
			log:  log.New("ip_header_middleware"),
			cfg:  cfg,
		}
	})
}

type IPRangeACHeaderMiddleware struct {
	next   plugins.Client
	keySvc signingkeys.Service
	log    log.Logger
	cfg    *setting.Cfg
}

func (m *IPRangeACHeaderMiddleware) applyRemoteAddressHeader(ctx context.Context, pCtx backend.PluginContext, h backend.ForwardHTTPHeaders) {
	// if request is not for a datasource, skip the middleware
	if h == nil || pCtx.DataSourceInstanceSettings == nil {
		return
	}

	// Check if the request is for a datasource that is allowed to have the header
	url := pCtx.DataSourceInstanceSettings.URL
	if !slices.Contains(m.cfg.IPRangeACAllowedURLs, url) {
		return
	}

	reqCtx := contexthandler.FromContext(ctx)

	hmac := hmac.New(sha256.New, []byte(m.cfg.IPRangeACSecretKey))
	toSign := ""
	if reqCtx != nil && reqCtx.Req != nil {
		toSign = web.RemoteAddr(reqCtx.Req)
	} else {
		toSign = "internal"
	}

	_, err := hmac.Write([]byte(toSign))
	if err != nil {
		m.log.Error("Failed to sign IP range access control header", "error", err)
		return
	}
	signedIPRangeInfo := hex.EncodeToString(hmac.Sum(nil))
	h.SetHTTPHeader(IPRangeHeaderName, signedIPRangeInfo)
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
