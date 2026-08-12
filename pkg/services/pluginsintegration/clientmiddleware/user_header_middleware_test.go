package clientmiddleware

import (
	"net/http"
	"testing"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/backend/handlertest"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/util/proxyutil"
	"github.com/stretchr/testify/require"
)

func TestUserHeaderMiddleware(t *testing.T) {
	t.Run("When anonymous user in reqContext", func(t *testing.T) {
		req, err := http.NewRequest(http.MethodGet, "/some/thing", nil)
		require.NoError(t, err)

		t.Run("And requests are for a datasource", func(t *testing.T) {
			cdt := handlertest.NewHandlerMiddlewareTest(t,
				WithReqContext(req, &user.SignedInUser{
					IsAnonymous: true,
					Login:       "anonymous"},
				),
				handlertest.WithMiddlewares(NewUserHeaderMiddleware()),
			)

			pluginCtx := backend.PluginContext{
				DataSourceInstanceSettings: &backend.DataSourceInstanceSettings{},
			}

			t.Run("Should not forward user header when calling QueryData", func(t *testing.T) {
				_, err = cdt.MiddlewareHandler.QueryData(req.Context(), &backend.QueryDataRequest{
					PluginContext: pluginCtx,
					Headers:       map[string]string{},
				})
				require.NoError(t, err)
				require.NotNil(t, cdt.QueryDataReq)
				require.Empty(t, cdt.QueryDataReq.Headers)
			})

			t.Run("Should not forward user header when calling CallResource", func(t *testing.T) {
				err = cdt.MiddlewareHandler.CallResource(req.Context(), &backend.CallResourceRequest{
					PluginContext: pluginCtx,
					Headers:       map[string][]string{},
				}, nopCallResourceSender)
				require.NoError(t, err)
				require.NotNil(t, cdt.CallResourceReq)
				require.Empty(t, cdt.CallResourceReq.Headers)
			})

			t.Run("Should not forward user header when calling CheckHealth", func(t *testing.T) {
				_, err = cdt.MiddlewareHandler.CheckHealth(req.Context(), &backend.CheckHealthRequest{
					PluginContext: pluginCtx,
					Headers:       map[string]string{},
				})
				require.NoError(t, err)
				require.NotNil(t, cdt.CheckHealthReq)
				require.Empty(t, cdt.CheckHealthReq.Headers)
			})

			t.Run("Should not forward user header when calling SubscribeStream", func(t *testing.T) {
				_, err = cdt.MiddlewareHandler.SubscribeStream(req.Context(), &backend.SubscribeStreamRequest{
					PluginContext: pluginCtx,
					Headers:       map[string]string{},
				})
				require.NoError(t, err)
				require.NotNil(t, cdt.SubscribeStreamReq)
				require.Empty(t, cdt.SubscribeStreamReq.Headers)
			})

			t.Run("Should not forward user header when calling PublishStream", func(t *testing.T) {
				_, err = cdt.MiddlewareHandler.PublishStream(req.Context(), &backend.PublishStreamRequest{
					PluginContext: pluginCtx,
					Headers:       map[string]string{},
				})
				require.NoError(t, err)
				require.NotNil(t, cdt.PublishStreamReq)
				require.Empty(t, cdt.PublishStreamReq.Headers)
			})

			t.Run("Should not forward user header when calling RunStream", func(t *testing.T) {
				err = cdt.MiddlewareHandler.RunStream(req.Context(), &backend.RunStreamRequest{
					PluginContext: pluginCtx,
					Headers:       map[string]string{},
				}, &backend.StreamSender{})
				require.NoError(t, err)
				require.NotNil(t, cdt.RunStreamReq)
				require.Empty(t, cdt.RunStreamReq.Headers)
			})
		})

		t.Run("And requests are for an app", func(t *testing.T) {
			cdt := handlertest.NewHandlerMiddlewareTest(t,
				WithReqContext(req, &user.SignedInUser{
					IsAnonymous: true,
					Login:       "anonymous"},
				),
				handlertest.WithMiddlewares(NewUserHeaderMiddleware()),
			)

			pluginCtx := backend.PluginContext{
				AppInstanceSettings: &backend.AppInstanceSettings{},
			}

			t.Run("Should not forward user header when calling QueryData", func(t *testing.T) {
				_, err = cdt.MiddlewareHandler.QueryData(req.Context(), &backend.QueryDataRequest{
					PluginContext: pluginCtx,
					Headers:       map[string]string{},
				})
				require.NoError(t, err)
				require.NotNil(t, cdt.QueryDataReq)
				require.Empty(t, cdt.QueryDataReq.Headers)
			})

			t.Run("Should not forward user header when calling CallResource", func(t *testing.T) {
				err = cdt.MiddlewareHandler.CallResource(req.Context(), &backend.CallResourceRequest{
					PluginContext: pluginCtx,
					Headers:       map[string][]string{},
				}, nopCallResourceSender)
				require.NoError(t, err)
				require.NotNil(t, cdt.CallResourceReq)
				require.Empty(t, cdt.CallResourceReq.Headers)
			})

			t.Run("Should not forward user header when calling CheckHealth", func(t *testing.T) {
				_, err = cdt.MiddlewareHandler.CheckHealth(req.Context(), &backend.CheckHealthRequest{
					PluginContext: pluginCtx,
					Headers:       map[string]string{},
				})
				require.NoError(t, err)
				require.NotNil(t, cdt.CheckHealthReq)
				require.Empty(t, cdt.CheckHealthReq.Headers)
			})

			t.Run("Should not forward user header when calling SubscribeStream", func(t *testing.T) {
				_, err = cdt.MiddlewareHandler.SubscribeStream(req.Context(), &backend.SubscribeStreamRequest{
					PluginContext: pluginCtx,
					Headers:       map[string]string{},
				})
				require.NoError(t, err)
				require.NotNil(t, cdt.SubscribeStreamReq)
				require.Empty(t, cdt.SubscribeStreamReq.Headers)
			})

			t.Run("Should not forward user header when calling PublishStream", func(t *testing.T) {
				_, err = cdt.MiddlewareHandler.PublishStream(req.Context(), &backend.PublishStreamRequest{
					PluginContext: pluginCtx,
					Headers:       map[string]string{},
				})
				require.NoError(t, err)
				require.NotNil(t, cdt.PublishStreamReq)
				require.Empty(t, cdt.PublishStreamReq.Headers)
			})

			t.Run("Should not forward user header when calling RunStream", func(t *testing.T) {
				err = cdt.MiddlewareHandler.RunStream(req.Context(), &backend.RunStreamRequest{
					PluginContext: pluginCtx,
					Headers:       map[string]string{},
				}, &backend.StreamSender{})
				require.NoError(t, err)
				require.NotNil(t, cdt.RunStreamReq)
				require.Empty(t, cdt.RunStreamReq.Headers)
			})
		})
	})

	t.Run("When real user in reqContext", func(t *testing.T) {
		req, err := http.NewRequest(http.MethodGet, "/some/thing", nil)
		require.NoError(t, err)

		t.Run("And requests are for a datasource", func(t *testing.T) {
			cdt := handlertest.NewHandlerMiddlewareTest(t,
				WithReqContext(req, &user.SignedInUser{
					Login: "admin",
				}),
				handlertest.WithMiddlewares(NewUserHeaderMiddleware()),
			)

			pluginCtx := backend.PluginContext{
				DataSourceInstanceSettings: &backend.DataSourceInstanceSettings{},
			}

			t.Run("Should forward user header when calling QueryData", func(t *testing.T) {
				_, err = cdt.MiddlewareHandler.QueryData(req.Context(), &backend.QueryDataRequest{
					PluginContext: pluginCtx,
					Headers:       map[string]string{},
				})
				require.NoError(t, err)
				require.NotNil(t, cdt.QueryDataReq)
				require.Len(t, cdt.QueryDataReq.Headers, 1)
				require.Equal(t, "admin", cdt.QueryDataReq.GetHTTPHeader(proxyutil.UserHeaderName))
			})

			t.Run("Should forward user header when calling CallResource", func(t *testing.T) {
				err = cdt.MiddlewareHandler.CallResource(req.Context(), &backend.CallResourceRequest{
					PluginContext: pluginCtx,
					Headers:       map[string][]string{},
				}, nopCallResourceSender)
				require.NoError(t, err)
				require.NotNil(t, cdt.CallResourceReq)
				require.Len(t, cdt.CallResourceReq.Headers, 1)
				require.Equal(t, "admin", cdt.CallResourceReq.GetHTTPHeader(proxyutil.UserHeaderName))
			})

			t.Run("Should forward user header when calling CheckHealth", func(t *testing.T) {
				_, err = cdt.MiddlewareHandler.CheckHealth(req.Context(), &backend.CheckHealthRequest{
					PluginContext: pluginCtx,
					Headers:       map[string]string{},
				})
				require.NoError(t, err)
				require.NotNil(t, cdt.CheckHealthReq)
				require.Len(t, cdt.CheckHealthReq.Headers, 1)
				require.Equal(t, "admin", cdt.CheckHealthReq.GetHTTPHeader(proxyutil.UserHeaderName))
			})

			t.Run("Should forward user header when calling SubscribeStream", func(t *testing.T) {
				_, err = cdt.MiddlewareHandler.SubscribeStream(req.Context(), &backend.SubscribeStreamRequest{
					PluginContext: pluginCtx,
					Headers:       map[string]string{},
				})
				require.NoError(t, err)
				require.NotNil(t, cdt.SubscribeStreamReq)
				require.Len(t, cdt.SubscribeStreamReq.Headers, 1)
				require.Equal(t, "admin", cdt.SubscribeStreamReq.GetHTTPHeader(proxyutil.UserHeaderName))
			})

			t.Run("Should forward user header when calling PublishStream", func(t *testing.T) {
				_, err = cdt.MiddlewareHandler.PublishStream(req.Context(), &backend.PublishStreamRequest{
					PluginContext: pluginCtx,
					Headers:       map[string]string{},
				})
				require.NoError(t, err)
				require.NotNil(t, cdt.PublishStreamReq)
				require.Len(t, cdt.PublishStreamReq.Headers, 1)
				require.Equal(t, "admin", cdt.PublishStreamReq.GetHTTPHeader(proxyutil.UserHeaderName))
			})

			t.Run("Should forward user header when calling RunStream", func(t *testing.T) {
				err = cdt.MiddlewareHandler.RunStream(req.Context(), &backend.RunStreamRequest{
					PluginContext: pluginCtx,
					Headers:       map[string]string{},
				}, &backend.StreamSender{})
				require.NoError(t, err)
				require.NotNil(t, cdt.RunStreamReq)
				require.Len(t, cdt.RunStreamReq.Headers, 1)
				require.Equal(t, "admin", cdt.RunStreamReq.GetHTTPHeader(proxyutil.UserHeaderName))
			})
		})

		t.Run("And requests are for an app", func(t *testing.T) {
			cdt := handlertest.NewHandlerMiddlewareTest(t,
				WithReqContext(req, &user.SignedInUser{
					Login: "admin",
				}),
				handlertest.WithMiddlewares(NewUserHeaderMiddleware()),
			)

			pluginCtx := backend.PluginContext{
				AppInstanceSettings: &backend.AppInstanceSettings{},
			}

			t.Run("Should forward user header when calling QueryData", func(t *testing.T) {
				_, err = cdt.MiddlewareHandler.QueryData(req.Context(), &backend.QueryDataRequest{
					PluginContext: pluginCtx,
					Headers:       map[string]string{},
				})
				require.NoError(t, err)
				require.NotNil(t, cdt.QueryDataReq)
				require.Len(t, cdt.QueryDataReq.Headers, 1)
				require.Equal(t, "admin", cdt.QueryDataReq.GetHTTPHeader(proxyutil.UserHeaderName))
			})

			t.Run("Should forward user header when calling CallResource", func(t *testing.T) {
				err = cdt.MiddlewareHandler.CallResource(req.Context(), &backend.CallResourceRequest{
					PluginContext: pluginCtx,
					Headers:       map[string][]string{},
				}, nopCallResourceSender)
				require.NoError(t, err)
				require.NotNil(t, cdt.CallResourceReq)
				require.Len(t, cdt.CallResourceReq.Headers, 1)
				require.Equal(t, "admin", cdt.CallResourceReq.GetHTTPHeader(proxyutil.UserHeaderName))
			})

			t.Run("Should forward user header when calling CheckHealth", func(t *testing.T) {
				_, err = cdt.MiddlewareHandler.CheckHealth(req.Context(), &backend.CheckHealthRequest{
					PluginContext: pluginCtx,
					Headers:       map[string]string{},
				})
				require.NoError(t, err)
				require.NotNil(t, cdt.CheckHealthReq)
				require.Len(t, cdt.CheckHealthReq.Headers, 1)
				require.Equal(t, "admin", cdt.CheckHealthReq.GetHTTPHeader(proxyutil.UserHeaderName))
			})

			t.Run("Should forward user header when calling SubscribeStream", func(t *testing.T) {
				_, err = cdt.MiddlewareHandler.SubscribeStream(req.Context(), &backend.SubscribeStreamRequest{
					PluginContext: pluginCtx,
					Headers:       map[string]string{},
				})
				require.NoError(t, err)
				require.NotNil(t, cdt.SubscribeStreamReq)
				require.Len(t, cdt.SubscribeStreamReq.Headers, 1)
				require.Equal(t, "admin", cdt.SubscribeStreamReq.GetHTTPHeader(proxyutil.UserHeaderName))
			})

			t.Run("Should forward user header when calling PublishStream", func(t *testing.T) {
				_, err = cdt.MiddlewareHandler.PublishStream(req.Context(), &backend.PublishStreamRequest{
					PluginContext: pluginCtx,
					Headers:       map[string]string{},
				})
				require.NoError(t, err)
				require.NotNil(t, cdt.PublishStreamReq)
				require.Len(t, cdt.PublishStreamReq.Headers, 1)
				require.Equal(t, "admin", cdt.PublishStreamReq.GetHTTPHeader(proxyutil.UserHeaderName))
			})

			t.Run("Should forward user header when calling RunStream", func(t *testing.T) {
				err = cdt.MiddlewareHandler.RunStream(req.Context(), &backend.RunStreamRequest{
					PluginContext: pluginCtx,
					Headers:       map[string]string{},
				}, &backend.StreamSender{})
				require.NoError(t, err)
				require.NotNil(t, cdt.RunStreamReq)
				require.Len(t, cdt.RunStreamReq.Headers, 1)
				require.Equal(t, "admin", cdt.RunStreamReq.GetHTTPHeader(proxyutil.UserHeaderName))
			})
		})
	})
}
