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

	req, err := http.NewRequest(http.MethodGet, "/some/thing", nil)
	require.NoError(t, err)

	t.Run("When requests are for a datasource", func(t *testing.T) {
		cfg := setting.NewCfg()
		cdt := handlertest.NewHandlerMiddlewareTest(t,
			WithReqContext(req, &user.SignedInUser{}),
			withAuthHTTPHeaders(req, cfg, setting.AuthJWTSettings{}),
			handlertest.WithMiddlewares(NewClearAuthHeadersMiddleware()),
		)

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

	t.Run("When requests are for an app", func(t *testing.T) {
		cfg := setting.NewCfg()
		cdt := handlertest.NewHandlerMiddlewareTest(t,
			WithReqContext(req, &user.SignedInUser{}),
			withAuthHTTPHeaders(req, cfg, setting.AuthJWTSettings{}),
			handlertest.WithMiddlewares(NewClearAuthHeadersMiddleware()),
		)

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

	t.Run("Clears the JWT header captured in the request-start snapshot", func(t *testing.T) {
		cfg := setting.NewCfg()
		jwtAuth := setting.AuthJWTSettings{Enabled: true, HeaderName: "X-Frozen-JWT"}

		cdt := handlertest.NewHandlerMiddlewareTest(t,
			WithReqContext(req, &user.SignedInUser{}),
			withAuthHTTPHeaders(req, cfg, jwtAuth),
			handlertest.WithMiddlewares(NewClearAuthHeadersMiddleware()),
		)

		_, err = cdt.MiddlewareHandler.QueryData(req.Context(), &backend.QueryDataRequest{
			PluginContext: backend.PluginContext{DataSourceInstanceSettings: &backend.DataSourceInstanceSettings{}},
			Headers: map[string]string{
				otherHeader:    "test",
				"X-Frozen-JWT": "secret",
			},
		})
		require.NoError(t, err)
		require.NotNil(t, cdt.QueryDataReq)
		require.Empty(t, cdt.QueryDataReq.Headers["X-Frozen-JWT"])
		require.Equal(t, "test", cdt.QueryDataReq.Headers[otherHeader])
	})

	t.Run("Fails closed and strips baseline auth headers when no snapshot is present", func(t *testing.T) {
		cdt := handlertest.NewHandlerMiddlewareTest(t,
			WithReqContext(req, &user.SignedInUser{}),
			handlertest.WithMiddlewares(NewClearAuthHeadersMiddleware()),
		)

		_, err = cdt.MiddlewareHandler.QueryData(req.Context(), &backend.QueryDataRequest{
			PluginContext: backend.PluginContext{DataSourceInstanceSettings: &backend.DataSourceInstanceSettings{}},
			Headers: map[string]string{
				otherHeader:           "test",
				"Authorization":       "secret",
				"X-Grafana-Device-Id": "secret",
			},
		})
		require.NoError(t, err)
		require.NotNil(t, cdt.QueryDataReq)
		require.Empty(t, cdt.QueryDataReq.Headers["Authorization"])
		require.Empty(t, cdt.QueryDataReq.Headers["X-Grafana-Device-Id"])
		require.Equal(t, "test", cdt.QueryDataReq.Headers[otherHeader])
	})
}

// withAuthHTTPHeaders seeds the request context with the auth-header snapshot
// that contexthandler freezes at request start, which the middleware consumes.
func withAuthHTTPHeaders(req *http.Request, cfg *setting.Cfg, jwtAuth setting.AuthJWTSettings) handlertest.HandlerMiddlewareTestOption {
	return handlertest.HandlerMiddlewareTestOption(func(*handlertest.HandlerMiddlewareTest) {
		ctx := contexthandler.WithAuthHTTPHeaders(req.Context(), cfg, jwtAuth)
		*req = *req.WithContext(ctx)
	})
}
