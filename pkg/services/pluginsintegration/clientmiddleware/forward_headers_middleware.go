package clientmiddleware

import (
	"context"
	"net/textproto"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/open-feature/go-sdk/openfeature"

	datasourcesV0 "github.com/grafana/grafana/pkg/apis/datasource/v0alpha1"
	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/services/contexthandler"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/util/proxyutil"
)

var forwardHeadersFlagClient = openfeature.NewDefaultClient()

// NewForwardHeadersMiddleware creates a new backend.HandlerMiddleware that
// forwards HTTP request headers from the incoming Grafana HTTP request onto
// outgoing backend.Handler requests, subject to a per-datasource allow-list
// (`jsonData.allowedHeaders`) and the instance-wide deny-list configured in
// the [datasource_forward_headers] section of grafana.ini.
//
// The middleware writes the surviving header values onto req.Headers on the
// plugin request. The existing HTTPClientMiddleware then propagates them onto
// outbound HTTP requests made through the Grafana SDK HTTP client, so
// datasources that use it automatically forward the headers downstream.
//
// This mirrors the shape of the cookie pass-through (`keepCookies`) feature.
// The behavior depends on the `grafana.datasourceForwardHeaders` feature
// toggle; when the toggle is disabled the middleware is a no-op.
func NewForwardHeadersMiddleware(denyList []string) backend.HandlerMiddleware {
	return backend.HandlerMiddlewareFunc(func(next backend.Handler) backend.Handler {
		return &ForwardHeadersMiddleware{
			BaseHandler: backend.NewBaseHandler(next),
			denyList:    denyList,
		}
	})
}

type ForwardHeadersMiddleware struct {
	backend.BaseHandler
	denyList []string
}

func (m *ForwardHeadersMiddleware) enabled(ctx context.Context) bool {
	return forwardHeadersFlagClient.Boolean(ctx, featuremgmt.FlagGrafanaDatasourceForwardHeaders, false, openfeature.TransactionContext(ctx))
}

func (m *ForwardHeadersMiddleware) applyHeaders(ctx context.Context, pCtx backend.PluginContext, req any) error {
	if !m.enabled(ctx) || req == nil {
		return nil
	}
	reqCtx := contexthandler.FromContext(ctx)
	if reqCtx == nil || reqCtx.Req == nil || pCtx.DataSourceInstanceSettings == nil {
		return nil
	}

	settings := pCtx.DataSourceInstanceSettings
	jsonDataBytes, err := simplejson.NewJson(settings.JSONData)
	if err != nil {
		return err
	}
	ds := datasourcesV0.DataSource{
		Spec: datasourcesV0.UnstructuredSpec{
			Object: map[string]any{"jsonData": jsonDataBytes.MustMap()},
		},
	}
	allowList := ds.Spec.AllowedHeaders()
	if len(allowList) == 0 {
		return nil
	}

	names := proxyutil.FilterAllowedHeaders(reqCtx.Req.Header, allowList, m.denyList)
	if len(names) == 0 {
		return nil
	}

	for _, name := range names {
		canon := textproto.CanonicalMIMEHeaderKey(name)
		values := reqCtx.Req.Header.Values(canon)
		if len(values) == 0 {
			continue
		}
		joined := joinHeaderValues(values)
		switch t := req.(type) {
		case *backend.QueryDataRequest:
			// Do not override headers Grafana's own middleware has already set.
			if _, exists := t.Headers[canon]; !exists {
				t.Headers[canon] = joined
			}
		case *backend.QueryChunkedDataRequest:
			if _, exists := t.Headers[canon]; !exists {
				t.Headers[canon] = joined
			}
		case *backend.CheckHealthRequest:
			if _, exists := t.Headers[canon]; !exists {
				t.Headers[canon] = joined
			}
		case *backend.CallResourceRequest:
			if _, exists := t.Headers[canon]; !exists {
				t.Headers[canon] = append([]string(nil), values...)
			}
		}
	}
	return nil
}

// joinHeaderValues joins repeated header values with ", " per RFC 9110 5.3
// for the string-valued Headers maps on QueryData/CheckHealth requests. The
// map-of-slice Headers on CallResourceRequest keeps values separate.
func joinHeaderValues(values []string) string {
	if len(values) == 1 {
		return values[0]
	}
	out := values[0]
	for _, v := range values[1:] {
		out += ", " + v
	}
	return out
}

func (m *ForwardHeadersMiddleware) QueryData(ctx context.Context, req *backend.QueryDataRequest) (*backend.QueryDataResponse, error) {
	if req == nil {
		return m.BaseHandler.QueryData(ctx, req)
	}
	if err := m.applyHeaders(ctx, req.PluginContext, req); err != nil {
		return nil, err
	}
	return m.BaseHandler.QueryData(ctx, req)
}

func (m *ForwardHeadersMiddleware) QueryChunkedData(ctx context.Context, req *backend.QueryChunkedDataRequest, w backend.ChunkedDataWriter) error {
	if req == nil {
		return m.BaseHandler.QueryChunkedData(ctx, req, w)
	}
	if err := m.applyHeaders(ctx, req.PluginContext, req); err != nil {
		return err
	}
	return m.BaseHandler.QueryChunkedData(ctx, req, w)
}

func (m *ForwardHeadersMiddleware) CallResource(ctx context.Context, req *backend.CallResourceRequest, sender backend.CallResourceResponseSender) error {
	if req == nil {
		return m.BaseHandler.CallResource(ctx, req, sender)
	}
	if err := m.applyHeaders(ctx, req.PluginContext, req); err != nil {
		return err
	}
	return m.BaseHandler.CallResource(ctx, req, sender)
}

func (m *ForwardHeadersMiddleware) CheckHealth(ctx context.Context, req *backend.CheckHealthRequest) (*backend.CheckHealthResult, error) {
	if req == nil {
		return m.BaseHandler.CheckHealth(ctx, req)
	}
	if err := m.applyHeaders(ctx, req.PluginContext, req); err != nil {
		return nil, err
	}
	return m.BaseHandler.CheckHealth(ctx, req)
}
