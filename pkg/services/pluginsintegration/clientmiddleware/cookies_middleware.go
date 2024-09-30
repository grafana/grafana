package clientmiddleware

import (
	"context"

	"github.com/grafana/grafana-plugin-sdk-go/backend"

	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/services/contexthandler"
	"github.com/grafana/grafana/pkg/services/datasources"
	"github.com/grafana/grafana/pkg/util/proxyutil"
)

const cookieHeaderName = "Cookie"

// NewCookiesMiddleware creates a new backend.HandlerMiddleware that will
// forward incoming HTTP request Cookies to outgoing backend.Handler requests
// if the datasource has enabled forwarding of cookies (keepCookies).
func NewCookiesMiddleware(skipCookiesNames []string) backend.HandlerMiddleware {
	return backend.HandlerMiddlewareFunc(func(next backend.Handler) backend.Handler {
		return &CookiesMiddleware{
			BaseHandler:      backend.NewBaseHandler(next),
			skipCookiesNames: skipCookiesNames,
		}
	})
}

type CookiesMiddleware struct {
	backend.BaseHandler
	skipCookiesNames []string
}

func (m *CookiesMiddleware) applyCookies(ctx context.Context, pCtx backend.PluginContext, req any) error {
	reqCtx := contexthandler.FromContext(ctx)
	allowedCookies := []string{}
	// if no HTTP request context skip middleware
	if req == nil || reqCtx == nil || reqCtx.Req == nil {
		return nil
	}

	if pCtx.DataSourceInstanceSettings != nil {
		settings := pCtx.DataSourceInstanceSettings
		jsonDataBytes, err := simplejson.NewJson(settings.JSONData)
		if err != nil {
			return err
		}

		ds := &datasources.DataSource{
			ID:       settings.ID,
			OrgID:    pCtx.OrgID,
			JsonData: jsonDataBytes,
			Updated:  settings.Updated,
		}

		allowedCookies = ds.AllowedCookies()
	}

	proxyutil.ClearCookieHeader(reqCtx.Req, allowedCookies, m.skipCookiesNames)

	cookieStr := reqCtx.Req.Header.Get(cookieHeaderName)
	switch t := req.(type) {
	case *backend.QueryDataRequest:
		if cookieStr == "" {
			delete(t.Headers, cookieHeaderName)
		} else {
			t.Headers[cookieHeaderName] = cookieStr
		}
	case *backend.CheckHealthRequest:
		if cookieStr == "" {
			delete(t.Headers, cookieHeaderName)
		} else {
			t.Headers[cookieHeaderName] = cookieStr
		}
	case *backend.CallResourceRequest:
		if cookieStr == "" {
			delete(t.Headers, cookieHeaderName)
		} else {
			t.Headers[cookieHeaderName] = []string{cookieStr}
		}
	}

	return nil
}

func (m *CookiesMiddleware) QueryData(ctx context.Context, req *backend.QueryDataRequest) (*backend.QueryDataResponse, error) {
	if req == nil {
		return m.BaseHandler.QueryData(ctx, req)
	}

	err := m.applyCookies(ctx, req.PluginContext, req)
	if err != nil {
		return nil, err
	}

	return m.BaseHandler.QueryData(ctx, req)
}

func (m *CookiesMiddleware) CallResource(ctx context.Context, req *backend.CallResourceRequest, sender backend.CallResourceResponseSender) error {
	if req == nil {
		return m.BaseHandler.CallResource(ctx, req, sender)
	}

	err := m.applyCookies(ctx, req.PluginContext, req)
	if err != nil {
		return err
	}

	return m.BaseHandler.CallResource(ctx, req, sender)
}

func (m *CookiesMiddleware) CheckHealth(ctx context.Context, req *backend.CheckHealthRequest) (*backend.CheckHealthResult, error) {
	if req == nil {
		return m.BaseHandler.CheckHealth(ctx, req)
	}

	err := m.applyCookies(ctx, req.PluginContext, req)
	if err != nil {
		return nil, err
	}

	return m.BaseHandler.CheckHealth(ctx, req)
}
