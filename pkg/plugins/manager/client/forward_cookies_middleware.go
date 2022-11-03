package client

import (
	"context"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/backend/httpclient"
	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/infra/httpclient/httpclientprovider"
	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/services/contexthandler"
	"github.com/grafana/grafana/pkg/services/datasources"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/util/proxyutil"
)

func NewForwardCookiesMiddleware(cfg *setting.Cfg) plugins.ClientMiddleware {
	return plugins.ClientMiddlewareFunc(func(next plugins.Client) plugins.Client {
		return &ForwardCookiesMiddleware{
			next: next,
			cfg:  cfg,
		}
	})
}

type ForwardCookiesMiddleware struct {
	next plugins.Client
	cfg  *setting.Cfg
}

func (m *ForwardCookiesMiddleware) applyCookies(ctx context.Context, pCtx backend.PluginContext, req interface{}) (context.Context, error) {
	reqCtx := contexthandler.FromContext(ctx)
	// if request not for a datasource or no HTTP request context skip middleware
	if req == nil || pCtx.DataSourceInstanceSettings == nil || reqCtx == nil || reqCtx.Req == nil {
		return nil, nil
	}

	settings := pCtx.DataSourceInstanceSettings

	// need oauth pass through set defined in the SDK, for now just dummy
	opts, err := settings.HTTPClientOptions()
	if err != nil {
		return nil, err
	}

	jsonData := backend.JSONDataFromHTTPClientOptions(opts)
	ds := &datasources.DataSource{
		Id:       settings.ID,
		OrgId:    pCtx.OrgID,
		JsonData: simplejson.NewFromAny(jsonData),
		Updated:  settings.Updated,
	}

	skipCookiesNames := []string{m.cfg.LoginCookieName}
	proxyutil.ClearCookieHeader(reqCtx.Req, ds.AllowedCookies(), skipCookiesNames)
	if cookieStr := reqCtx.Req.Header.Get("Cookie"); cookieStr != "" {
		switch t := req.(type) {
		case *backend.QueryDataRequest:
		case *backend.CheckHealthRequest:
			t.Headers["Cookie"] = cookieStr
		case *backend.CallResourceRequest:
			t.Headers["Cookie"] = []string{cookieStr}
		}
	}

	ctx = httpclient.WithContextualMiddleware(ctx, httpclientprovider.ForwardedCookiesMiddleware(reqCtx.Req.Cookies(), ds.AllowedCookies(), skipCookiesNames))

	return ctx, nil
}

func (m *ForwardCookiesMiddleware) QueryData(ctx context.Context, req *backend.QueryDataRequest) (*backend.QueryDataResponse, error) {
	newCtx, err := m.applyCookies(ctx, req.PluginContext, req)
	if err != nil {
		return nil, err
	}

	return m.next.QueryData(newCtx, req)
}

func (m *ForwardCookiesMiddleware) CallResource(ctx context.Context, req *backend.CallResourceRequest, sender backend.CallResourceResponseSender) error {
	newCtx, err := m.applyCookies(ctx, req.PluginContext, req)
	if err != nil {
		return err
	}

	return m.next.CallResource(newCtx, req, sender)
}

func (m *ForwardCookiesMiddleware) CollectMetrics(ctx context.Context, req *backend.CollectMetricsRequest) (*backend.CollectMetricsResult, error) {
	return m.next.CollectMetrics(ctx, req)
}

func (m *ForwardCookiesMiddleware) CheckHealth(ctx context.Context, req *backend.CheckHealthRequest) (*backend.CheckHealthResult, error) {
	newCtx, err := m.applyCookies(ctx, req.PluginContext, req)
	if err != nil {
		return nil, err
	}

	return m.next.CheckHealth(newCtx, req)
}

func (m *ForwardCookiesMiddleware) SubscribeStream(ctx context.Context, req *backend.SubscribeStreamRequest) (*backend.SubscribeStreamResponse, error) {
	return m.next.SubscribeStream(ctx, req)
}

func (m *ForwardCookiesMiddleware) PublishStream(ctx context.Context, req *backend.PublishStreamRequest) (*backend.PublishStreamResponse, error) {
	return m.next.PublishStream(ctx, req)
}

func (m *ForwardCookiesMiddleware) RunStream(ctx context.Context, req *backend.RunStreamRequest, sender *backend.StreamSender) error {
	return m.next.RunStream(ctx, req, sender)
}
