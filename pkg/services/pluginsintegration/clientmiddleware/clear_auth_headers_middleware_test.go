package clientmiddleware

import (
	"bytes"
	"io"
	"net/http"
	"testing"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/backend/httpclient"
	"github.com/grafana/grafana/pkg/infra/httpclient/httpclientprovider"
	"github.com/grafana/grafana/pkg/plugins/manager/client/clienttest"
	"github.com/grafana/grafana/pkg/services/contexthandler"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/stretchr/testify/require"
)

func TestClearAuthHeadersMiddleware(t *testing.T) {
	const otherHeader = "test"

	t.Run("When no auth headers in reqContext", func(t *testing.T) {
		req, err := http.NewRequest(http.MethodGet, "/some/thing", nil)
		require.NoError(t, err)

		req.Header.Set(otherHeader, "test")

		t.Run("And requests are for a datasource", func(t *testing.T) {
			cdt := clienttest.NewClientDecoratorTest(t,
				clienttest.WithReqContext(req, &user.SignedInUser{}),
				clienttest.WithMiddlewares(NewClearAuthHeadersMiddleware()),
			)

			pluginCtx := backend.PluginContext{
				DataSourceInstanceSettings: &backend.DataSourceInstanceSettings{},
			}

			t.Run("Should not attach delete headers middleware when calling QueryData", func(t *testing.T) {
				_, err = cdt.Decorator.QueryData(req.Context(), &backend.QueryDataRequest{
					PluginContext: pluginCtx,
					Headers:       map[string]string{otherHeader: "test"},
				})
				require.NoError(t, err)
				require.NotNil(t, cdt.QueryDataReq)
				require.Len(t, cdt.QueryDataReq.Headers, 1)

				middlewares := httpclient.ContextualMiddlewareFromContext(cdt.QueryDataCtx)
				require.Len(t, middlewares, 0)
			})

			t.Run("Should not attach delete headers middleware when calling CallResource", func(t *testing.T) {
				err = cdt.Decorator.CallResource(req.Context(), &backend.CallResourceRequest{
					PluginContext: pluginCtx,
					Headers:       map[string][]string{otherHeader: {"test"}},
				}, nopCallResourceSender)
				require.NoError(t, err)
				require.NotNil(t, cdt.CallResourceReq)
				require.Len(t, cdt.CallResourceReq.Headers, 1)

				middlewares := httpclient.ContextualMiddlewareFromContext(cdt.CallResourceCtx)
				require.Len(t, middlewares, 0)
			})

			t.Run("Should not attach delete headers middleware when calling CheckHealth", func(t *testing.T) {
				_, err = cdt.Decorator.CheckHealth(req.Context(), &backend.CheckHealthRequest{
					PluginContext: pluginCtx,
					Headers:       map[string]string{otherHeader: "test"},
				})
				require.NoError(t, err)
				require.NotNil(t, cdt.CheckHealthReq)
				require.Len(t, cdt.CheckHealthReq.Headers, 1)

				middlewares := httpclient.ContextualMiddlewareFromContext(cdt.CheckHealthCtx)
				require.Len(t, middlewares, 0)
			})
		})

		t.Run("And requests are for an app", func(t *testing.T) {
			cdt := clienttest.NewClientDecoratorTest(t,
				clienttest.WithReqContext(req, &user.SignedInUser{}),
				clienttest.WithMiddlewares(NewClearAuthHeadersMiddleware()),
			)

			pluginCtx := backend.PluginContext{
				AppInstanceSettings: &backend.AppInstanceSettings{},
			}

			t.Run("Should not attach delete headers middleware when calling QueryData", func(t *testing.T) {
				_, err = cdt.Decorator.QueryData(req.Context(), &backend.QueryDataRequest{
					PluginContext: pluginCtx,
					Headers:       map[string]string{otherHeader: "test"},
				})
				require.NoError(t, err)
				require.NotNil(t, cdt.QueryDataReq)
				require.Len(t, cdt.QueryDataReq.Headers, 1)

				middlewares := httpclient.ContextualMiddlewareFromContext(cdt.QueryDataCtx)
				require.Len(t, middlewares, 0)
			})

			t.Run("Should not attach delete headers middleware when calling CallResource", func(t *testing.T) {
				err = cdt.Decorator.CallResource(req.Context(), &backend.CallResourceRequest{
					PluginContext: pluginCtx,
					Headers:       map[string][]string{otherHeader: {"test"}},
				}, nopCallResourceSender)
				require.NoError(t, err)
				require.NotNil(t, cdt.CallResourceReq)
				require.Len(t, cdt.CallResourceReq.Headers, 1)

				middlewares := httpclient.ContextualMiddlewareFromContext(cdt.CallResourceCtx)
				require.Len(t, middlewares, 0)
			})

			t.Run("Should not attach delete headers middleware when calling CheckHealth", func(t *testing.T) {
				_, err = cdt.Decorator.CheckHealth(req.Context(), &backend.CheckHealthRequest{
					PluginContext: pluginCtx,
					Headers:       map[string]string{otherHeader: "test"},
				})
				require.NoError(t, err)
				require.NotNil(t, cdt.CheckHealthReq)
				require.Len(t, cdt.CheckHealthReq.Headers, 1)

				middlewares := httpclient.ContextualMiddlewareFromContext(cdt.CheckHealthCtx)
				require.Len(t, middlewares, 0)
			})
		})
	})

	t.Run("When auth headers in reqContext", func(t *testing.T) {
		req, err := http.NewRequest(http.MethodGet, "/some/thing", nil)
		require.NoError(t, err)

		t.Run("And requests are for a datasource", func(t *testing.T) {
			cdt := clienttest.NewClientDecoratorTest(t,
				clienttest.WithReqContext(req, &user.SignedInUser{}),
				clienttest.WithMiddlewares(NewClearAuthHeadersMiddleware()),
			)

			const customHeader = "X-Custom"
			req.Header.Set(customHeader, "val")
			ctx := contexthandler.WithAuthHTTPHeader(req.Context(), customHeader)
			req = req.WithContext(ctx)

			const otherHeader = "X-Other"
			req.Header.Set(otherHeader, "test")

			pluginCtx := backend.PluginContext{
				DataSourceInstanceSettings: &backend.DataSourceInstanceSettings{},
			}

			t.Run("Should attach delete headers middleware when calling QueryData", func(t *testing.T) {
				_, err = cdt.Decorator.QueryData(req.Context(), &backend.QueryDataRequest{
					PluginContext: pluginCtx,
					Headers:       map[string]string{otherHeader: "test"},
				})
				require.NoError(t, err)
				require.NotNil(t, cdt.QueryDataReq)
				require.Len(t, cdt.QueryDataReq.Headers, 1)

				middlewares := httpclient.ContextualMiddlewareFromContext(cdt.QueryDataCtx)
				require.Len(t, middlewares, 1)
				require.Equal(t, httpclientprovider.DeleteHeadersMiddlewareName, middlewares[0].(httpclient.MiddlewareName).MiddlewareName())

				reqClone := req.Clone(req.Context())
				res, err := middlewares[0].CreateMiddleware(httpclient.Options{}, finalRoundTripper).RoundTrip(reqClone)
				require.NoError(t, err)
				require.NoError(t, res.Body.Close())
				require.Len(t, reqClone.Header, 1)
				require.Empty(t, reqClone.Header[customHeader])
				require.Equal(t, "test", reqClone.Header.Get(otherHeader))
			})

			t.Run("Should attach delete headers middleware when calling CallResource", func(t *testing.T) {
				err = cdt.Decorator.CallResource(req.Context(), &backend.CallResourceRequest{
					PluginContext: pluginCtx,
					Headers:       map[string][]string{otherHeader: {"test"}},
				}, nopCallResourceSender)
				require.NoError(t, err)
				require.NotNil(t, cdt.CallResourceReq)
				require.Len(t, cdt.CallResourceReq.Headers, 1)

				middlewares := httpclient.ContextualMiddlewareFromContext(cdt.CallResourceCtx)
				require.Len(t, middlewares, 1)
				require.Equal(t, httpclientprovider.DeleteHeadersMiddlewareName, middlewares[0].(httpclient.MiddlewareName).MiddlewareName())

				reqClone := req.Clone(req.Context())
				res, err := middlewares[0].CreateMiddleware(httpclient.Options{}, finalRoundTripper).RoundTrip(reqClone)
				require.NoError(t, err)
				require.NoError(t, res.Body.Close())
				require.Len(t, reqClone.Header, 1)
				require.Empty(t, reqClone.Header[customHeader])
				require.Equal(t, "test", reqClone.Header.Get(otherHeader))
			})

			t.Run("Should attach delete headers middleware when calling CheckHealth", func(t *testing.T) {
				_, err = cdt.Decorator.CheckHealth(req.Context(), &backend.CheckHealthRequest{
					PluginContext: pluginCtx,
					Headers:       map[string]string{otherHeader: "test"},
				})
				require.NoError(t, err)
				require.NotNil(t, cdt.CheckHealthReq)
				require.Len(t, cdt.CheckHealthReq.Headers, 1)

				middlewares := httpclient.ContextualMiddlewareFromContext(cdt.CheckHealthCtx)
				require.Len(t, middlewares, 1)
				require.Equal(t, httpclientprovider.DeleteHeadersMiddlewareName, middlewares[0].(httpclient.MiddlewareName).MiddlewareName())

				reqClone := req.Clone(req.Context())
				res, err := middlewares[0].CreateMiddleware(httpclient.Options{}, finalRoundTripper).RoundTrip(reqClone)
				require.NoError(t, err)
				require.NoError(t, res.Body.Close())
				require.Len(t, reqClone.Header, 1)
				require.Empty(t, reqClone.Header[customHeader])
				require.Equal(t, "test", reqClone.Header.Get(otherHeader))
			})
		})

		t.Run("And requests are for an app", func(t *testing.T) {
			cdt := clienttest.NewClientDecoratorTest(t,
				clienttest.WithReqContext(req, &user.SignedInUser{}),
				clienttest.WithMiddlewares(NewClearAuthHeadersMiddleware()),
			)

			const customHeader = "X-Custom"
			req.Header.Set(customHeader, "val")
			ctx := contexthandler.WithAuthHTTPHeader(req.Context(), customHeader)
			req = req.WithContext(ctx)

			const otherHeader = "X-Other"
			req.Header.Set(otherHeader, "test")

			pluginCtx := backend.PluginContext{
				AppInstanceSettings: &backend.AppInstanceSettings{},
			}

			t.Run("Should attach delete headers middleware when calling QueryData", func(t *testing.T) {
				_, err = cdt.Decorator.QueryData(req.Context(), &backend.QueryDataRequest{
					PluginContext: pluginCtx,
					Headers:       map[string]string{otherHeader: "test"},
				})
				require.NoError(t, err)
				require.NotNil(t, cdt.QueryDataReq)
				require.Len(t, cdt.QueryDataReq.Headers, 1)

				middlewares := httpclient.ContextualMiddlewareFromContext(cdt.QueryDataCtx)
				require.Len(t, middlewares, 1)
				require.Equal(t, httpclientprovider.DeleteHeadersMiddlewareName, middlewares[0].(httpclient.MiddlewareName).MiddlewareName())

				reqClone := req.Clone(req.Context())
				res, err := middlewares[0].CreateMiddleware(httpclient.Options{}, finalRoundTripper).RoundTrip(reqClone)
				require.NoError(t, err)
				require.NoError(t, res.Body.Close())
				require.Len(t, reqClone.Header, 1)
				require.Empty(t, reqClone.Header[customHeader])
				require.Equal(t, "test", reqClone.Header.Get(otherHeader))
			})

			t.Run("Should attach delete headers middleware when calling CallResource", func(t *testing.T) {
				err = cdt.Decorator.CallResource(req.Context(), &backend.CallResourceRequest{
					PluginContext: pluginCtx,
					Headers:       map[string][]string{otherHeader: {"test"}},
				}, nopCallResourceSender)
				require.NoError(t, err)
				require.NotNil(t, cdt.CallResourceReq)
				require.Len(t, cdt.CallResourceReq.Headers, 1)

				middlewares := httpclient.ContextualMiddlewareFromContext(cdt.CallResourceCtx)
				require.Len(t, middlewares, 1)
				require.Equal(t, httpclientprovider.DeleteHeadersMiddlewareName, middlewares[0].(httpclient.MiddlewareName).MiddlewareName())

				reqClone := req.Clone(req.Context())
				res, err := middlewares[0].CreateMiddleware(httpclient.Options{}, finalRoundTripper).RoundTrip(reqClone)
				require.NoError(t, err)
				require.NoError(t, res.Body.Close())
				require.Len(t, reqClone.Header, 1)
				require.Empty(t, reqClone.Header[customHeader])
				require.Equal(t, "test", reqClone.Header.Get(otherHeader))
			})

			t.Run("Should attach delete headers middleware when calling CheckHealth", func(t *testing.T) {
				_, err = cdt.Decorator.CheckHealth(req.Context(), &backend.CheckHealthRequest{
					PluginContext: pluginCtx,
					Headers:       map[string]string{otherHeader: "test"},
				})
				require.NoError(t, err)
				require.NotNil(t, cdt.CheckHealthReq)
				require.Len(t, cdt.CheckHealthReq.Headers, 1)

				middlewares := httpclient.ContextualMiddlewareFromContext(cdt.CheckHealthCtx)
				require.Len(t, middlewares, 1)
				require.Equal(t, httpclientprovider.DeleteHeadersMiddlewareName, middlewares[0].(httpclient.MiddlewareName).MiddlewareName())

				reqClone := req.Clone(req.Context())
				res, err := middlewares[0].CreateMiddleware(httpclient.Options{}, finalRoundTripper).RoundTrip(reqClone)
				require.NoError(t, err)
				require.NoError(t, res.Body.Close())
				require.Len(t, reqClone.Header, 1)
				require.Empty(t, reqClone.Header[customHeader])
				require.Equal(t, "test", reqClone.Header.Get(otherHeader))
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
