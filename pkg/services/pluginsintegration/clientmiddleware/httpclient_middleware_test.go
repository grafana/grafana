package clientmiddleware

import (
	"bytes"
	"io"
	"net/http"
	"testing"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/backend/httpclient"
	"github.com/grafana/grafana/pkg/plugins/manager/client/clienttest"
	ngalertmodels "github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/util/proxyutil"
	"github.com/stretchr/testify/require"
)

func TestHTTPClientMiddleware(t *testing.T) {
	const otherHeader = "test"

	t.Run("When no http headers in plugin request", func(t *testing.T) {
		req, err := http.NewRequest(http.MethodGet, "/some/thing", nil)
		require.NoError(t, err)

		t.Run("And requests are for a datasource", func(t *testing.T) {
			cdt := clienttest.NewClientDecoratorTest(t,
				clienttest.WithReqContext(req, &user.SignedInUser{}),
				clienttest.WithMiddlewares(NewHTTPClientMiddleware()),
			)

			pluginCtx := backend.PluginContext{
				DataSourceInstanceSettings: &backend.DataSourceInstanceSettings{},
			}

			t.Run("Should not forward headers when calling QueryData", func(t *testing.T) {
				_, err = cdt.Decorator.QueryData(req.Context(), &backend.QueryDataRequest{
					PluginContext: pluginCtx,
					Headers:       map[string]string{otherHeader: "val"},
				})
				require.NoError(t, err)
				require.NotNil(t, cdt.QueryDataReq)
				require.Len(t, cdt.QueryDataReq.Headers, 1)

				middlewares := httpclient.ContextualMiddlewareFromContext(cdt.QueryDataCtx)
				require.Len(t, middlewares, 1)
				require.Equal(t, forwardPluginRequestHTTPHeaders, middlewares[0].(httpclient.MiddlewareName).MiddlewareName())

				reqClone := req.Clone(req.Context())
				res, err := middlewares[0].CreateMiddleware(httpclient.Options{}, finalRoundTripper).RoundTrip(reqClone)
				require.NoError(t, err)
				require.NoError(t, res.Body.Close())
				require.Len(t, reqClone.Header, 0)
			})

			t.Run("Should not forward headers when calling CallResource", func(t *testing.T) {
				err = cdt.Decorator.CallResource(req.Context(), &backend.CallResourceRequest{
					PluginContext: pluginCtx,
					Headers:       map[string][]string{otherHeader: {"val"}},
				}, nopCallResourceSender)
				require.NoError(t, err)
				require.NotNil(t, cdt.CallResourceReq)
				require.Len(t, cdt.CallResourceReq.Headers, 1)

				middlewares := httpclient.ContextualMiddlewareFromContext(cdt.QueryDataCtx)
				require.Len(t, middlewares, 1)
				require.Equal(t, forwardPluginRequestHTTPHeaders, middlewares[0].(httpclient.MiddlewareName).MiddlewareName())

				reqClone := req.Clone(req.Context())
				res, err := middlewares[0].CreateMiddleware(httpclient.Options{}, finalRoundTripper).RoundTrip(reqClone)
				require.NoError(t, err)
				require.NoError(t, res.Body.Close())
				require.Len(t, reqClone.Header, 0)
			})

			t.Run("Should not forward headers when calling CheckHealth", func(t *testing.T) {
				_, err = cdt.Decorator.CheckHealth(req.Context(), &backend.CheckHealthRequest{
					PluginContext: pluginCtx,
					Headers:       map[string]string{otherHeader: "val"},
				})
				require.NoError(t, err)
				require.NotNil(t, cdt.CheckHealthReq)
				require.Len(t, cdt.CheckHealthReq.Headers, 1)

				middlewares := httpclient.ContextualMiddlewareFromContext(cdt.QueryDataCtx)
				require.Len(t, middlewares, 1)
				require.Equal(t, forwardPluginRequestHTTPHeaders, middlewares[0].(httpclient.MiddlewareName).MiddlewareName())

				reqClone := req.Clone(req.Context())
				res, err := middlewares[0].CreateMiddleware(httpclient.Options{}, finalRoundTripper).RoundTrip(reqClone)
				require.NoError(t, err)
				require.NoError(t, res.Body.Close())
				require.Len(t, reqClone.Header, 0)
			})
		})

		t.Run("And requests are for an app", func(t *testing.T) {
			cdt := clienttest.NewClientDecoratorTest(t,
				clienttest.WithReqContext(req, &user.SignedInUser{}),
				clienttest.WithMiddlewares(NewHTTPClientMiddleware()),
			)

			pluginCtx := backend.PluginContext{
				AppInstanceSettings: &backend.AppInstanceSettings{},
			}

			t.Run("Should not forward headers when calling QueryData", func(t *testing.T) {
				_, err = cdt.Decorator.QueryData(req.Context(), &backend.QueryDataRequest{
					PluginContext: pluginCtx,
					Headers:       map[string]string{},
				})
				require.NoError(t, err)
				require.NotNil(t, cdt.QueryDataReq)
				require.Len(t, cdt.QueryDataReq.Headers, 0)

				middlewares := httpclient.ContextualMiddlewareFromContext(cdt.QueryDataCtx)
				require.Len(t, middlewares, 1)
				require.Equal(t, forwardPluginRequestHTTPHeaders, middlewares[0].(httpclient.MiddlewareName).MiddlewareName())

				reqClone := req.Clone(req.Context())
				res, err := middlewares[0].CreateMiddleware(httpclient.Options{}, finalRoundTripper).RoundTrip(reqClone)
				require.NoError(t, err)
				require.NoError(t, res.Body.Close())
				require.Len(t, reqClone.Header, 0)
			})

			t.Run("Should not forward headers when calling CallResource", func(t *testing.T) {
				err = cdt.Decorator.CallResource(req.Context(), &backend.CallResourceRequest{
					PluginContext: pluginCtx,
					Headers:       map[string][]string{},
				}, nopCallResourceSender)
				require.NoError(t, err)
				require.NotNil(t, cdt.CallResourceReq)
				require.Len(t, cdt.CallResourceReq.Headers, 0)

				middlewares := httpclient.ContextualMiddlewareFromContext(cdt.QueryDataCtx)
				require.Len(t, middlewares, 1)
				require.Equal(t, forwardPluginRequestHTTPHeaders, middlewares[0].(httpclient.MiddlewareName).MiddlewareName())

				reqClone := req.Clone(req.Context())
				res, err := middlewares[0].CreateMiddleware(httpclient.Options{}, finalRoundTripper).RoundTrip(reqClone)
				require.NoError(t, err)
				require.NoError(t, res.Body.Close())
				require.Len(t, reqClone.Header, 0)
			})

			t.Run("Should not forward headers when calling CheckHealth", func(t *testing.T) {
				_, err = cdt.Decorator.CheckHealth(req.Context(), &backend.CheckHealthRequest{
					PluginContext: pluginCtx,
					Headers:       map[string]string{},
				})
				require.NoError(t, err)
				require.NotNil(t, cdt.CheckHealthReq)
				require.Len(t, cdt.CheckHealthReq.Headers, 0)

				middlewares := httpclient.ContextualMiddlewareFromContext(cdt.QueryDataCtx)
				require.Len(t, middlewares, 1)
				require.Equal(t, forwardPluginRequestHTTPHeaders, middlewares[0].(httpclient.MiddlewareName).MiddlewareName())

				reqClone := req.Clone(req.Context())
				res, err := middlewares[0].CreateMiddleware(httpclient.Options{}, finalRoundTripper).RoundTrip(reqClone)
				require.NoError(t, err)
				require.NoError(t, res.Body.Close())
				require.Len(t, reqClone.Header, 0)
			})
		})
	})

	t.Run("When HTTP headers in plugin request", func(t *testing.T) {
		req, err := http.NewRequest(http.MethodGet, "/some/thing", nil)
		require.NoError(t, err)

		headers := map[string]string{
			ngalertmodels.FromAlertHeaderName:      "true",
			backend.OAuthIdentityTokenHeaderName:   "bearer token",
			backend.OAuthIdentityIDTokenHeaderName: "id-token",
			"http_" + proxyutil.UserHeaderName:     "uname",
			backend.CookiesHeaderName:              "cookie1=; cookie2=; cookie3=",
			otherHeader:                            "val",
		}

		crHeaders := map[string][]string{}
		for k, v := range headers {
			crHeaders[k] = []string{v}
		}

		t.Run("And requests are for a datasource", func(t *testing.T) {
			cdt := clienttest.NewClientDecoratorTest(t,
				clienttest.WithReqContext(req, &user.SignedInUser{}),
				clienttest.WithMiddlewares(NewHTTPClientMiddleware()),
			)

			pluginCtx := backend.PluginContext{
				DataSourceInstanceSettings: &backend.DataSourceInstanceSettings{},
			}

			t.Run("Should forward headers when calling QueryData", func(t *testing.T) {
				_, err = cdt.Decorator.QueryData(req.Context(), &backend.QueryDataRequest{
					PluginContext: pluginCtx,
					Headers:       headers,
				})
				require.NoError(t, err)
				require.NotNil(t, cdt.QueryDataReq)
				require.Len(t, cdt.QueryDataReq.Headers, 6)

				middlewares := httpclient.ContextualMiddlewareFromContext(cdt.QueryDataCtx)
				require.Len(t, middlewares, 1)
				require.Equal(t, forwardPluginRequestHTTPHeaders, middlewares[0].(httpclient.MiddlewareName).MiddlewareName())

				reqClone := req.Clone(req.Context())
				res, err := middlewares[0].CreateMiddleware(httpclient.Options{}, finalRoundTripper).RoundTrip(reqClone)
				require.NoError(t, err)
				require.NoError(t, res.Body.Close())
				require.Len(t, reqClone.Header, 5)
				require.Equal(t, "true", reqClone.Header.Get(ngalertmodels.FromAlertHeaderName))
				require.Equal(t, "bearer token", reqClone.Header.Get(backend.OAuthIdentityTokenHeaderName))
				require.Equal(t, "id-token", reqClone.Header.Get(backend.OAuthIdentityIDTokenHeaderName))
				require.Equal(t, "uname", reqClone.Header.Get(proxyutil.UserHeaderName))
				require.Len(t, reqClone.Cookies(), 3)
				require.Equal(t, "cookie1", reqClone.Cookies()[0].Name)
				require.Equal(t, "cookie2", reqClone.Cookies()[1].Name)
				require.Equal(t, "cookie3", reqClone.Cookies()[2].Name)
			})

			t.Run("Should forward headers when calling CallResource", func(t *testing.T) {
				err = cdt.Decorator.CallResource(req.Context(), &backend.CallResourceRequest{
					PluginContext: pluginCtx,
					Headers:       crHeaders,
				}, nopCallResourceSender)
				require.NoError(t, err)
				require.NotNil(t, cdt.CallResourceReq)
				require.Len(t, cdt.CallResourceReq.Headers, 6)

				middlewares := httpclient.ContextualMiddlewareFromContext(cdt.QueryDataCtx)
				require.Len(t, middlewares, 1)
				require.Equal(t, forwardPluginRequestHTTPHeaders, middlewares[0].(httpclient.MiddlewareName).MiddlewareName())

				reqClone := req.Clone(req.Context())
				res, err := middlewares[0].CreateMiddleware(httpclient.Options{}, finalRoundTripper).RoundTrip(reqClone)
				require.NoError(t, err)
				require.NoError(t, res.Body.Close())
				require.Len(t, reqClone.Header, 5)
				require.Equal(t, "true", reqClone.Header.Get(ngalertmodels.FromAlertHeaderName))
				require.Equal(t, "bearer token", reqClone.Header.Get(backend.OAuthIdentityTokenHeaderName))
				require.Equal(t, "id-token", reqClone.Header.Get(backend.OAuthIdentityIDTokenHeaderName))
				require.Equal(t, "uname", reqClone.Header.Get(proxyutil.UserHeaderName))
				require.Len(t, reqClone.Cookies(), 3)
				require.Equal(t, "cookie1", reqClone.Cookies()[0].Name)
				require.Equal(t, "cookie2", reqClone.Cookies()[1].Name)
				require.Equal(t, "cookie3", reqClone.Cookies()[2].Name)
			})

			t.Run("Should forward headers when calling CheckHealth", func(t *testing.T) {
				_, err = cdt.Decorator.CheckHealth(req.Context(), &backend.CheckHealthRequest{
					PluginContext: pluginCtx,
					Headers:       headers,
				})
				require.NoError(t, err)
				require.NotNil(t, cdt.CheckHealthReq)
				require.Len(t, cdt.CheckHealthReq.Headers, 6)

				middlewares := httpclient.ContextualMiddlewareFromContext(cdt.QueryDataCtx)
				require.Len(t, middlewares, 1)
				require.Equal(t, forwardPluginRequestHTTPHeaders, middlewares[0].(httpclient.MiddlewareName).MiddlewareName())

				reqClone := req.Clone(req.Context())
				res, err := middlewares[0].CreateMiddleware(httpclient.Options{}, finalRoundTripper).RoundTrip(reqClone)
				require.NoError(t, err)
				require.NoError(t, res.Body.Close())
				require.Len(t, reqClone.Header, 5)
				require.Equal(t, "true", reqClone.Header.Get(ngalertmodels.FromAlertHeaderName))
				require.Equal(t, "bearer token", reqClone.Header.Get(backend.OAuthIdentityTokenHeaderName))
				require.Equal(t, "id-token", reqClone.Header.Get(backend.OAuthIdentityIDTokenHeaderName))
				require.Equal(t, "uname", reqClone.Header.Get(proxyutil.UserHeaderName))
				require.Len(t, reqClone.Cookies(), 3)
				require.Equal(t, "cookie1", reqClone.Cookies()[0].Name)
				require.Equal(t, "cookie2", reqClone.Cookies()[1].Name)
				require.Equal(t, "cookie3", reqClone.Cookies()[2].Name)
			})
		})
	})
}

var finalRoundTripper = httpclient.RoundTripperFunc(func(req *http.Request) (*http.Response, error) {
	return &http.Response{
		StatusCode: http.StatusOK,
		Request:    req,
		Body:       io.NopCloser(bytes.NewBufferString("")),
	}, nil
})
