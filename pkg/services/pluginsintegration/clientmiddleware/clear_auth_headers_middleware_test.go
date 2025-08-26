package clientmiddleware

import (
	"net/http"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/backend/handlertest"
	"github.com/grafana/grafana/pkg/services/contexthandler"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/setting"
)

func TestClearAuthHeadersMiddleware(t *testing.T) {
	const otherHeader = "test"

	t.Run("When no auth headers in reqContext", func(t *testing.T) {
		req, err := http.NewRequest(http.MethodGet, "/some/thing", nil)
		require.NoError(t, err)

		req.Header.Set(otherHeader, "test")

		t.Run("And requests are for a datasource", func(t *testing.T) {
			cdt := handlertest.NewHandlerMiddlewareTest(t,
				WithReqContext(req, &user.SignedInUser{}),
				handlertest.WithMiddlewares(NewClearAuthHeadersMiddleware()),
			)

			pluginCtx := backend.PluginContext{
				DataSourceInstanceSettings: &backend.DataSourceInstanceSettings{},
			}

			t.Run("No auth headers to clear when calling QueryData", func(t *testing.T) {
				_, err = cdt.MiddlewareHandler.QueryData(req.Context(), &backend.QueryDataRequest{
					PluginContext: pluginCtx,
					Headers:       map[string]string{otherHeader: "test"},
				})
				require.NoError(t, err)
				require.NotNil(t, cdt.QueryDataReq)
				require.Len(t, cdt.QueryDataReq.Headers, 1)
				require.Empty(t, cdt.QueryDataReq.GetHTTPHeaders())
			})

			t.Run("No auth headers to clear when calling CallResource", func(t *testing.T) {
				err = cdt.MiddlewareHandler.CallResource(req.Context(), &backend.CallResourceRequest{
					PluginContext: pluginCtx,
					Headers:       map[string][]string{otherHeader: {"test"}},
				}, nopCallResourceSender)
				require.NoError(t, err)
				require.NotNil(t, cdt.CallResourceReq)
				require.Len(t, cdt.CallResourceReq.Headers, 1)
				require.Equal(t, http.Header{http.CanonicalHeaderKey(otherHeader): {"test"}}, cdt.CallResourceReq.GetHTTPHeaders())
			})

			t.Run("No auth headers to clear when calling CheckHealth", func(t *testing.T) {
				_, err = cdt.MiddlewareHandler.CheckHealth(req.Context(), &backend.CheckHealthRequest{
					PluginContext: pluginCtx,
					Headers:       map[string]string{otherHeader: "test"},
				})
				require.NoError(t, err)
				require.NotNil(t, cdt.CheckHealthReq)
				require.Len(t, cdt.CheckHealthReq.Headers, 1)
				require.Empty(t, cdt.CheckHealthReq.GetHTTPHeaders())
			})

			t.Run("No auth headers to clear when calling SubscribeStream", func(t *testing.T) {
				_, err = cdt.MiddlewareHandler.SubscribeStream(req.Context(), &backend.SubscribeStreamRequest{
					PluginContext: pluginCtx,
					Headers:       map[string]string{otherHeader: "test"},
				})
				require.NoError(t, err)
				require.NotNil(t, cdt.SubscribeStreamReq)
				require.Len(t, cdt.SubscribeStreamReq.Headers, 1)
				require.Empty(t, cdt.SubscribeStreamReq.GetHTTPHeaders())
			})

			t.Run("No auth headers to clear when calling PublishStream", func(t *testing.T) {
				_, err = cdt.MiddlewareHandler.PublishStream(req.Context(), &backend.PublishStreamRequest{
					PluginContext: pluginCtx,
					Headers:       map[string]string{otherHeader: "test"},
				})
				require.NoError(t, err)
				require.NotNil(t, cdt.PublishStreamReq)
				require.Len(t, cdt.PublishStreamReq.Headers, 1)
				require.Empty(t, cdt.PublishStreamReq.GetHTTPHeaders())
			})

			t.Run("No auth headers to clear when calling RunStream", func(t *testing.T) {
				err = cdt.MiddlewareHandler.RunStream(req.Context(), &backend.RunStreamRequest{
					PluginContext: pluginCtx,
					Headers:       map[string]string{otherHeader: "test"},
				}, &backend.StreamSender{})
				require.NoError(t, err)
				require.NotNil(t, cdt.RunStreamReq)
				require.Len(t, cdt.RunStreamReq.Headers, 1)
				require.Empty(t, cdt.RunStreamReq.GetHTTPHeaders())
			})
		})

		t.Run("And requests are for an app", func(t *testing.T) {
			cdt := handlertest.NewHandlerMiddlewareTest(t,
				WithReqContext(req, &user.SignedInUser{}),
				handlertest.WithMiddlewares(NewClearAuthHeadersMiddleware()),
			)

			pluginCtx := backend.PluginContext{
				AppInstanceSettings: &backend.AppInstanceSettings{},
			}

			t.Run("No auth headers to clear when calling QueryData", func(t *testing.T) {
				_, err = cdt.MiddlewareHandler.QueryData(req.Context(), &backend.QueryDataRequest{
					PluginContext: pluginCtx,
					Headers:       map[string]string{otherHeader: "test"},
				})
				require.NoError(t, err)
				require.NotNil(t, cdt.QueryDataReq)
				require.Len(t, cdt.QueryDataReq.Headers, 1)
				require.Equal(t, "test", cdt.QueryDataReq.Headers[otherHeader])
				require.Empty(t, cdt.QueryDataReq.GetHTTPHeaders())
			})

			t.Run("No auth headers to clear when calling CallResource", func(t *testing.T) {
				err = cdt.MiddlewareHandler.CallResource(req.Context(), &backend.CallResourceRequest{
					PluginContext: pluginCtx,
					Headers:       map[string][]string{otherHeader: {"test"}},
				}, nopCallResourceSender)
				require.NoError(t, err)
				require.NotNil(t, cdt.CallResourceReq)
				require.Len(t, cdt.CallResourceReq.Headers, 1)
				require.Equal(t, []string{"test"}, cdt.CallResourceReq.Headers[otherHeader])
				require.Equal(t, http.Header{http.CanonicalHeaderKey(otherHeader): {"test"}}, cdt.CallResourceReq.GetHTTPHeaders())
			})

			t.Run("No auth headers to clear when calling CheckHealth", func(t *testing.T) {
				_, err = cdt.MiddlewareHandler.CheckHealth(req.Context(), &backend.CheckHealthRequest{
					PluginContext: pluginCtx,
					Headers:       map[string]string{otherHeader: "test"},
				})
				require.NoError(t, err)
				require.NotNil(t, cdt.CheckHealthReq)
				require.Len(t, cdt.CheckHealthReq.Headers, 1)
				require.Equal(t, "test", cdt.CheckHealthReq.Headers[otherHeader])
				require.Empty(t, cdt.CheckHealthReq.GetHTTPHeaders())
			})

			t.Run("No auth headers to clear when calling SubscribeStream", func(t *testing.T) {
				_, err = cdt.MiddlewareHandler.SubscribeStream(req.Context(), &backend.SubscribeStreamRequest{
					PluginContext: pluginCtx,
					Headers:       map[string]string{otherHeader: "test"},
				})
				require.NoError(t, err)
				require.NotNil(t, cdt.SubscribeStreamReq)
				require.Len(t, cdt.SubscribeStreamReq.Headers, 1)
				require.Equal(t, "test", cdt.SubscribeStreamReq.Headers[otherHeader])
				require.Empty(t, cdt.SubscribeStreamReq.GetHTTPHeaders())
			})

			t.Run("No auth headers to clear when calling PublishStream", func(t *testing.T) {
				_, err = cdt.MiddlewareHandler.PublishStream(req.Context(), &backend.PublishStreamRequest{
					PluginContext: pluginCtx,
					Headers:       map[string]string{otherHeader: "test"},
				})
				require.NoError(t, err)
				require.NotNil(t, cdt.PublishStreamReq)
				require.Len(t, cdt.PublishStreamReq.Headers, 1)
				require.Equal(t, "test", cdt.PublishStreamReq.Headers[otherHeader])
				require.Empty(t, cdt.PublishStreamReq.GetHTTPHeaders())
			})

			t.Run("No auth headers to clear when calling RunStream", func(t *testing.T) {
				err = cdt.MiddlewareHandler.RunStream(req.Context(), &backend.RunStreamRequest{
					PluginContext: pluginCtx,
					Headers:       map[string]string{otherHeader: "test"},
				}, &backend.StreamSender{})
				require.NoError(t, err)
				require.NotNil(t, cdt.RunStreamReq)
				require.Len(t, cdt.RunStreamReq.Headers, 1)
				require.Equal(t, "test", cdt.RunStreamReq.Headers[otherHeader])
				require.Empty(t, cdt.RunStreamReq.GetHTTPHeaders())
			})
		})
	})

	t.Run("When auth headers in reqContext", func(t *testing.T) {
		req, err := http.NewRequest(http.MethodGet, "/some/thing", nil)
		require.NoError(t, err)

		t.Run("And requests are for a datasource", func(t *testing.T) {
			cdt := handlertest.NewHandlerMiddlewareTest(t,
				WithReqContext(req, &user.SignedInUser{}),
				handlertest.WithMiddlewares(NewClearAuthHeadersMiddleware()),
			)

			req := req.WithContext(contexthandler.WithAuthHTTPHeaders(req.Context(), setting.NewCfg()))

			pluginCtx := backend.PluginContext{
				DataSourceInstanceSettings: &backend.DataSourceInstanceSettings{},
			}

			t.Run("Should clear auth headers when calling QueryData", func(t *testing.T) {
				_, err = cdt.MiddlewareHandler.QueryData(req.Context(), &backend.QueryDataRequest{
					PluginContext: pluginCtx,
					Headers: map[string]string{
						otherHeader:           "test",
						"Authorization":       "secret",
						"X-Grafana-Device-Id": "secret",
					},
				})
				require.NoError(t, err)
				require.NotNil(t, cdt.QueryDataReq)
				require.Len(t, cdt.QueryDataReq.Headers, 1)
				require.Equal(t, "test", cdt.QueryDataReq.Headers[otherHeader])
				require.Empty(t, cdt.QueryDataReq.GetHTTPHeaders())
			})

			t.Run("Should clear auth headers when calling CallResource", func(t *testing.T) {
				err = cdt.MiddlewareHandler.CallResource(req.Context(), &backend.CallResourceRequest{
					PluginContext: pluginCtx,
					Headers: map[string][]string{
						otherHeader:           {"test"},
						"Authorization":       {"secret"},
						"X-Grafana-Device-Id": {"secret"},
					},
				}, nopCallResourceSender)
				require.NoError(t, err)
				require.NotNil(t, cdt.CallResourceReq)
				require.Len(t, cdt.CallResourceReq.Headers, 1)
				require.Equal(t, []string{"test"}, cdt.CallResourceReq.Headers[otherHeader])
				require.Equal(t, "test", cdt.CallResourceReq.GetHTTPHeader(otherHeader))
			})

			t.Run("Should clear auth headers when calling CheckHealth", func(t *testing.T) {
				_, err = cdt.MiddlewareHandler.CheckHealth(req.Context(), &backend.CheckHealthRequest{
					PluginContext: pluginCtx,
					Headers: map[string]string{
						otherHeader:           "test",
						"Authorization":       "secret",
						"X-Grafana-Device-Id": "secret",
					},
				})
				require.NoError(t, err)
				require.NotNil(t, cdt.CheckHealthReq)
				require.Len(t, cdt.CheckHealthReq.Headers, 1)
				require.Equal(t, "test", cdt.CheckHealthReq.Headers[otherHeader])
				require.Empty(t, cdt.CheckHealthReq.GetHTTPHeaders())
			})

			t.Run("Should clear auth headers when calling SubscribeStream", func(t *testing.T) {
				_, err = cdt.MiddlewareHandler.SubscribeStream(req.Context(), &backend.SubscribeStreamRequest{
					PluginContext: pluginCtx,
					Headers: map[string]string{
						otherHeader:           "test",
						"Authorization":       "secret",
						"X-Grafana-Device-Id": "secret",
					},
				})
				require.NoError(t, err)
				require.NotNil(t, cdt.SubscribeStreamReq)
				require.Len(t, cdt.SubscribeStreamReq.Headers, 1)
				require.Equal(t, "test", cdt.SubscribeStreamReq.Headers[otherHeader])
				require.Empty(t, cdt.SubscribeStreamReq.GetHTTPHeaders())
			})

			t.Run("Should clear auth headers when calling PublishStream", func(t *testing.T) {
				_, err = cdt.MiddlewareHandler.PublishStream(req.Context(), &backend.PublishStreamRequest{
					PluginContext: pluginCtx,
					Headers: map[string]string{
						otherHeader:           "test",
						"Authorization":       "secret",
						"X-Grafana-Device-Id": "secret",
					},
				})
				require.NoError(t, err)
				require.NotNil(t, cdt.PublishStreamReq)
				require.Len(t, cdt.PublishStreamReq.Headers, 1)
				require.Equal(t, "test", cdt.PublishStreamReq.Headers[otherHeader])
				require.Empty(t, cdt.PublishStreamReq.GetHTTPHeaders())
			})

			t.Run("Should clear auth headers when calling RunStream", func(t *testing.T) {
				err = cdt.MiddlewareHandler.RunStream(req.Context(), &backend.RunStreamRequest{
					PluginContext: pluginCtx,
					Headers: map[string]string{
						otherHeader:           "test",
						"Authorization":       "secret",
						"X-Grafana-Device-Id": "secret",
					},
				}, &backend.StreamSender{})
				require.NoError(t, err)
				require.NotNil(t, cdt.RunStreamReq)
				require.Len(t, cdt.RunStreamReq.Headers, 1)
				require.Equal(t, "test", cdt.RunStreamReq.Headers[otherHeader])
				require.Empty(t, cdt.RunStreamReq.GetHTTPHeaders())
			})
		})

		t.Run("And requests are for an app", func(t *testing.T) {
			cdt := handlertest.NewHandlerMiddlewareTest(t,
				WithReqContext(req, &user.SignedInUser{}),
				handlertest.WithMiddlewares(NewClearAuthHeadersMiddleware()),
			)

			req := req.WithContext(contexthandler.WithAuthHTTPHeaders(req.Context(), setting.NewCfg()))
			req.Header.Set("Authorization", "val")

			const otherHeader = "x-Other"
			req.Header.Set(otherHeader, "test")

			pluginCtx := backend.PluginContext{
				AppInstanceSettings: &backend.AppInstanceSettings{},
			}

			t.Run("Should clear auth headers when calling QueryData", func(t *testing.T) {
				_, err = cdt.MiddlewareHandler.QueryData(req.Context(), &backend.QueryDataRequest{
					PluginContext: pluginCtx,
					Headers: map[string]string{
						otherHeader:           "test",
						"Authorization":       "secret",
						"X-Grafana-Device-Id": "secret",
					},
				})
				require.NoError(t, err)
				require.NotNil(t, cdt.QueryDataReq)
				require.Len(t, cdt.QueryDataReq.Headers, 1)
				require.Equal(t, "test", cdt.QueryDataReq.Headers[otherHeader])
				require.Empty(t, cdt.QueryDataReq.GetHTTPHeaders())
			})

			t.Run("Should clear auth headers when calling CallResource", func(t *testing.T) {
				err = cdt.MiddlewareHandler.CallResource(req.Context(), &backend.CallResourceRequest{
					PluginContext: pluginCtx,
					Headers: map[string][]string{
						otherHeader:           {"test"},
						"Authorization":       {"secret"},
						"X-Grafana-Device-Id": {"secret"},
					},
				}, nopCallResourceSender)
				require.NoError(t, err)
				require.NotNil(t, cdt.CallResourceReq)
				require.Len(t, cdt.CallResourceReq.Headers, 1)
				require.Equal(t, []string{"test"}, cdt.CallResourceReq.Headers[otherHeader])
				require.Equal(t, "test", cdt.CallResourceReq.GetHTTPHeader(otherHeader))
			})

			t.Run("Should clear auth headers when calling CheckHealth", func(t *testing.T) {
				_, err = cdt.MiddlewareHandler.CheckHealth(req.Context(), &backend.CheckHealthRequest{
					PluginContext: pluginCtx,
					Headers: map[string]string{
						otherHeader:           "test",
						"Authorization":       "secret",
						"X-Grafana-Device-Id": "secret",
					},
				})
				require.NoError(t, err)
				require.NotNil(t, cdt.CheckHealthReq)
				require.Len(t, cdt.CheckHealthReq.Headers, 1)
				require.Equal(t, "test", cdt.CheckHealthReq.Headers[otherHeader])
				require.Empty(t, cdt.CheckHealthReq.GetHTTPHeaders())
			})

			t.Run("Should clear auth headers when calling SubscribeStream", func(t *testing.T) {
				_, err = cdt.MiddlewareHandler.SubscribeStream(req.Context(), &backend.SubscribeStreamRequest{
					PluginContext: pluginCtx,
					Headers: map[string]string{
						otherHeader:           "test",
						"Authorization":       "secret",
						"X-Grafana-Device-Id": "secret",
					},
				})
				require.NoError(t, err)
				require.NotNil(t, cdt.SubscribeStreamReq)
				require.Len(t, cdt.SubscribeStreamReq.Headers, 1)
				require.Equal(t, "test", cdt.SubscribeStreamReq.Headers[otherHeader])
				require.Empty(t, cdt.SubscribeStreamReq.GetHTTPHeaders())
			})

			t.Run("Should clear auth headers when calling PublishStream", func(t *testing.T) {
				_, err = cdt.MiddlewareHandler.PublishStream(req.Context(), &backend.PublishStreamRequest{
					PluginContext: pluginCtx,
					Headers: map[string]string{
						otherHeader:           "test",
						"Authorization":       "secret",
						"X-Grafana-Device-Id": "secret",
					},
				})
				require.NoError(t, err)
				require.NotNil(t, cdt.PublishStreamReq)
				require.Len(t, cdt.PublishStreamReq.Headers, 1)
				require.Equal(t, "test", cdt.PublishStreamReq.Headers[otherHeader])
				require.Empty(t, cdt.PublishStreamReq.GetHTTPHeaders())
			})

			t.Run("Should clear auth headers when calling RunStream", func(t *testing.T) {
				err = cdt.MiddlewareHandler.RunStream(req.Context(), &backend.RunStreamRequest{
					PluginContext: pluginCtx,
					Headers: map[string]string{
						otherHeader:           "test",
						"Authorization":       "secret",
						"X-Grafana-Device-Id": "secret",
					},
				}, &backend.StreamSender{})
				require.NoError(t, err)
				require.NotNil(t, cdt.RunStreamReq)
				require.Len(t, cdt.RunStreamReq.Headers, 1)
				require.Equal(t, "test", cdt.RunStreamReq.Headers[otherHeader])
				require.Empty(t, cdt.RunStreamReq.GetHTTPHeaders())
			})
		})
	})
}
