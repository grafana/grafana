package clientmiddleware

import (
	"net/http"
	"testing"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/backend/handlertest"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/stretchr/testify/require"
)

func TestTracingHeaderMiddleware(t *testing.T) {
	t.Run("When a request comes in with tracing headers set to empty strings", func(t *testing.T) {
		req, err := http.NewRequest(http.MethodGet, "/some/thing", nil)
		require.NoError(t, err)
		req.Header[`X-Dashboard-Uid`] = []string{}
		req.Header[`X-Datasource-Uid`] = []string{}
		req.Header[`X-Grafana-Org-Id`] = []string{}
		req.Header[`X-Panel-Id`] = []string{}
		req.Header[`X-Query-Group-Id`] = []string{}

		pluginCtx := backend.PluginContext{
			DataSourceInstanceSettings: &backend.DataSourceInstanceSettings{},
		}

		t.Run("tracing headers are not set for query data", func(t *testing.T) {
			cdt := handlertest.NewHandlerMiddlewareTest(t,
				WithReqContext(req, &user.SignedInUser{
					IsAnonymous: true,
					Login:       "anonymous"},
				),
				handlertest.WithMiddlewares(NewTracingHeaderMiddleware()),
			)

			_, err = cdt.MiddlewareHandler.QueryData(req.Context(), &backend.QueryDataRequest{
				PluginContext: pluginCtx,
				Headers:       map[string]string{},
			})
			require.NoError(t, err)

			require.Len(t, cdt.QueryDataReq.GetHTTPHeaders(), 0)
		})

		t.Run("tracing headers are not set for health check", func(t *testing.T) {
			cdt := handlertest.NewHandlerMiddlewareTest(t,
				WithReqContext(req, &user.SignedInUser{
					IsAnonymous: true,
					Login:       "anonymous"},
				),
				handlertest.WithMiddlewares(NewTracingHeaderMiddleware()),
			)

			_, err = cdt.MiddlewareHandler.CheckHealth(req.Context(), &backend.CheckHealthRequest{
				PluginContext: pluginCtx,
				Headers:       map[string]string{},
			})
			require.NoError(t, err)

			require.Len(t, cdt.CheckHealthReq.GetHTTPHeaders(), 0)
		})
	})
	t.Run("When a request comes in with tracing headers empty", func(t *testing.T) {
		req, err := http.NewRequest(http.MethodGet, "/some/thing", nil)
		require.NoError(t, err)

		pluginCtx := backend.PluginContext{
			DataSourceInstanceSettings: &backend.DataSourceInstanceSettings{},
		}

		t.Run("tracing headers are not set for query data", func(t *testing.T) {
			cdt := handlertest.NewHandlerMiddlewareTest(t,
				WithReqContext(req, &user.SignedInUser{
					IsAnonymous: true,
					Login:       "anonymous"},
				),
				handlertest.WithMiddlewares(NewTracingHeaderMiddleware()),
			)

			_, err = cdt.MiddlewareHandler.QueryData(req.Context(), &backend.QueryDataRequest{
				PluginContext: pluginCtx,
				Headers:       map[string]string{},
			})
			require.NoError(t, err)

			require.Len(t, cdt.QueryDataReq.GetHTTPHeaders(), 0)
		})

		t.Run("tracing headers are not set for health check", func(t *testing.T) {
			cdt := handlertest.NewHandlerMiddlewareTest(t,
				WithReqContext(req, &user.SignedInUser{
					IsAnonymous: true,
					Login:       "anonymous"},
				),
				handlertest.WithMiddlewares(NewTracingHeaderMiddleware()),
			)

			_, err = cdt.MiddlewareHandler.CheckHealth(req.Context(), &backend.CheckHealthRequest{
				PluginContext: pluginCtx,
				Headers:       map[string]string{},
			})
			require.NoError(t, err)

			require.Len(t, cdt.CheckHealthReq.GetHTTPHeaders(), 0)
		})
	})
	t.Run("When a request comes in with tracing headers set", func(t *testing.T) {
		req, err := http.NewRequest(http.MethodGet, "/some/thing", nil)
		require.NoError(t, err)

		req.Header[`X-Dashboard-Uid`] = []string{"lN53lOcVk"}
		req.Header[`X-Datasource-Uid`] = []string{"aIyC_OcVz"}
		req.Header[`X-Grafana-Org-Id`] = []string{"1"}
		req.Header[`X-Panel-Id`] = []string{"2"}
		req.Header[`X-Query-Group-Id`] = []string{"d26e337d-cb53-481a-9212-0112537b3c1a"}
		req.Header[`X-Grafana-From-Expr`] = []string{"true"}

		pluginCtx := backend.PluginContext{
			DataSourceInstanceSettings: &backend.DataSourceInstanceSettings{},
		}

		t.Run("tracing headers are set for query data", func(t *testing.T) {
			cdt := handlertest.NewHandlerMiddlewareTest(t,
				WithReqContext(req, &user.SignedInUser{
					IsAnonymous: true,
					Login:       "anonymous"},
				),
				handlertest.WithMiddlewares(NewTracingHeaderMiddleware()),
			)

			_, err = cdt.MiddlewareHandler.QueryData(req.Context(), &backend.QueryDataRequest{
				PluginContext: pluginCtx,
				Headers:       map[string]string{},
			})
			require.NoError(t, err)

			require.Len(t, cdt.QueryDataReq.GetHTTPHeaders(), 6)
			require.Equal(t, `lN53lOcVk`, cdt.QueryDataReq.GetHTTPHeader(`X-Dashboard-Uid`))
			require.Equal(t, `aIyC_OcVz`, cdt.QueryDataReq.GetHTTPHeader(`X-Datasource-Uid`))
			require.Equal(t, `1`, cdt.QueryDataReq.GetHTTPHeader(`X-Grafana-Org-Id`))
			require.Equal(t, `2`, cdt.QueryDataReq.GetHTTPHeader(`X-Panel-Id`))
			require.Equal(t, `d26e337d-cb53-481a-9212-0112537b3c1a`, cdt.QueryDataReq.GetHTTPHeader(`X-Query-Group-Id`))
			require.Equal(t, `true`, cdt.QueryDataReq.GetHTTPHeader(`X-Grafana-From-Expr`))
		})

		t.Run("tracing headers are set for health check", func(t *testing.T) {
			cdt := handlertest.NewHandlerMiddlewareTest(t,
				WithReqContext(req, &user.SignedInUser{
					IsAnonymous: true,
					Login:       "anonymous"},
				),
				handlertest.WithMiddlewares(NewTracingHeaderMiddleware()),
			)

			_, err = cdt.MiddlewareHandler.CheckHealth(req.Context(), &backend.CheckHealthRequest{
				PluginContext: pluginCtx,
				Headers:       map[string]string{},
			})
			require.NoError(t, err)

			require.Len(t, cdt.CheckHealthReq.GetHTTPHeaders(), 6)
			require.Equal(t, `lN53lOcVk`, cdt.CheckHealthReq.GetHTTPHeader(`X-Dashboard-Uid`))
			require.Equal(t, `aIyC_OcVz`, cdt.CheckHealthReq.GetHTTPHeader(`X-Datasource-Uid`))
			require.Equal(t, `1`, cdt.CheckHealthReq.GetHTTPHeader(`X-Grafana-Org-Id`))
			require.Equal(t, `2`, cdt.CheckHealthReq.GetHTTPHeader(`X-Panel-Id`))
			require.Equal(t, `d26e337d-cb53-481a-9212-0112537b3c1a`, cdt.CheckHealthReq.GetHTTPHeader(`X-Query-Group-Id`))
			require.Equal(t, `true`, cdt.CheckHealthReq.GetHTTPHeader(`X-Grafana-From-Expr`))
		})

		t.Run("tracing headers are set for subscribe stream", func(t *testing.T) {
			cdt := handlertest.NewHandlerMiddlewareTest(t,
				WithReqContext(req, &user.SignedInUser{
					IsAnonymous: true,
					Login:       "anonymous"},
				),
				handlertest.WithMiddlewares(NewTracingHeaderMiddleware()),
			)

			_, err = cdt.MiddlewareHandler.SubscribeStream(req.Context(), &backend.SubscribeStreamRequest{
				PluginContext: pluginCtx,
				Headers:       map[string]string{},
			})
			require.NoError(t, err)

			require.Len(t, cdt.SubscribeStreamReq.GetHTTPHeaders(), 6)
			require.Equal(t, `lN53lOcVk`, cdt.SubscribeStreamReq.GetHTTPHeader(`X-Dashboard-Uid`))
			require.Equal(t, `aIyC_OcVz`, cdt.SubscribeStreamReq.GetHTTPHeader(`X-Datasource-Uid`))
			require.Equal(t, `1`, cdt.SubscribeStreamReq.GetHTTPHeader(`X-Grafana-Org-Id`))
			require.Equal(t, `2`, cdt.SubscribeStreamReq.GetHTTPHeader(`X-Panel-Id`))
			require.Equal(t, `d26e337d-cb53-481a-9212-0112537b3c1a`, cdt.SubscribeStreamReq.GetHTTPHeader(`X-Query-Group-Id`))
			require.Equal(t, `true`, cdt.SubscribeStreamReq.GetHTTPHeader(`X-Grafana-From-Expr`))
		})

		t.Run("tracing headers are set for publish stream", func(t *testing.T) {
			cdt := handlertest.NewHandlerMiddlewareTest(t,
				WithReqContext(req, &user.SignedInUser{
					IsAnonymous: true,
					Login:       "anonymous"},
				),
				handlertest.WithMiddlewares(NewTracingHeaderMiddleware()),
			)

			_, err = cdt.MiddlewareHandler.PublishStream(req.Context(), &backend.PublishStreamRequest{
				PluginContext: pluginCtx,
				Headers:       map[string]string{},
			})
			require.NoError(t, err)

			require.Len(t, cdt.PublishStreamReq.GetHTTPHeaders(), 6)
			require.Equal(t, `lN53lOcVk`, cdt.PublishStreamReq.GetHTTPHeader(`X-Dashboard-Uid`))
			require.Equal(t, `aIyC_OcVz`, cdt.PublishStreamReq.GetHTTPHeader(`X-Datasource-Uid`))
			require.Equal(t, `1`, cdt.PublishStreamReq.GetHTTPHeader(`X-Grafana-Org-Id`))
			require.Equal(t, `2`, cdt.PublishStreamReq.GetHTTPHeader(`X-Panel-Id`))
			require.Equal(t, `d26e337d-cb53-481a-9212-0112537b3c1a`, cdt.PublishStreamReq.GetHTTPHeader(`X-Query-Group-Id`))
			require.Equal(t, `true`, cdt.PublishStreamReq.GetHTTPHeader(`X-Grafana-From-Expr`))
		})

		t.Run("tracing headers are set for run stream", func(t *testing.T) {
			cdt := handlertest.NewHandlerMiddlewareTest(t,
				WithReqContext(req, &user.SignedInUser{
					IsAnonymous: true,
					Login:       "anonymous"},
				),
				handlertest.WithMiddlewares(NewTracingHeaderMiddleware()),
			)

			err = cdt.MiddlewareHandler.RunStream(req.Context(), &backend.RunStreamRequest{
				PluginContext: pluginCtx,
				Headers:       map[string]string{},
			}, &backend.StreamSender{})
			require.NoError(t, err)

			require.Len(t, cdt.RunStreamReq.GetHTTPHeaders(), 6)
			require.Equal(t, `lN53lOcVk`, cdt.RunStreamReq.GetHTTPHeader(`X-Dashboard-Uid`))
			require.Equal(t, `aIyC_OcVz`, cdt.RunStreamReq.GetHTTPHeader(`X-Datasource-Uid`))
			require.Equal(t, `1`, cdt.RunStreamReq.GetHTTPHeader(`X-Grafana-Org-Id`))
			require.Equal(t, `2`, cdt.RunStreamReq.GetHTTPHeader(`X-Panel-Id`))
			require.Equal(t, `d26e337d-cb53-481a-9212-0112537b3c1a`, cdt.RunStreamReq.GetHTTPHeader(`X-Query-Group-Id`))
			require.Equal(t, `true`, cdt.RunStreamReq.GetHTTPHeader(`X-Grafana-From-Expr`))
		})

		t.Run("When headers contain invalid characters, they are sanitized", func(t *testing.T) {
			req, err := http.NewRequest(http.MethodGet, "/some/thing", nil)
			require.NoError(t, err)

			// Set headers with control characters that need sanitization
			req.Header[`X-Dashboard-Uid`] = []string{"dashboard\x00uid"}
			req.Header[`X-Datasource-Uid`] = []string{"datasource\tuid"}
			req.Header[`X-Panel-Id`] = []string{"panel\nid"}
			req.Header[`X-Grafana-Org-Id`] = []string{"org\rid"}

			pluginCtx := backend.PluginContext{
				DataSourceInstanceSettings: &backend.DataSourceInstanceSettings{},
			}

			cdt := handlertest.NewHandlerMiddlewareTest(t,
				WithReqContext(req, &user.SignedInUser{
					IsAnonymous: true,
					Login:       "anonymous"},
				),
				handlertest.WithMiddlewares(NewTracingHeaderMiddleware()),
			)

			_, err = cdt.MiddlewareHandler.QueryData(req.Context(), &backend.QueryDataRequest{
				PluginContext: pluginCtx,
				Headers:       map[string]string{},
			})
			require.NoError(t, err)

			// Verify that headers were sanitized (control characters percent-encoded)
			require.Equal(t, `dashboard%00uid`, cdt.QueryDataReq.GetHTTPHeader(`X-Dashboard-Uid`))
			require.Equal(t, `datasource%09uid`, cdt.QueryDataReq.GetHTTPHeader(`X-Datasource-Uid`))
			require.Equal(t, `panel%0Aid`, cdt.QueryDataReq.GetHTTPHeader(`X-Panel-Id`))
			require.Equal(t, `org%0Did`, cdt.QueryDataReq.GetHTTPHeader(`X-Grafana-Org-Id`))
		})
	})
}

func TestSanitizeHTTPHeaderValueForGRPC(t *testing.T) {
	testCases := []struct {
		name     string
		input    string
		expected string
	}{
		{
			name:     "Valid printable ASCII characters remain unchanged",
			input:    "Hello World! 123 @#$%^&*()",
			expected: "Hello World! 123 @#$%^&*()",
		},
		{
			name:     "Extended characters remain unchanged",
			input:    "café résumé naïve",
			expected: "café résumé naïve",
		},
		{
			name:     "Control characters are percent-encoded",
			input:    "hello\x00\x01\x1Fworld",
			expected: "hello%00%01%1Fworld",
		},
		{
			name:     "Tab character is percent-encoded",
			input:    "hello\tworld",
			expected: "hello%09world",
		},
		{
			name:     "Newline character is percent-encoded",
			input:    "hello\nworld",
			expected: "hello%0Aworld",
		},
		{
			name:     "Carriage return is percent-encoded",
			input:    "hello\rworld",
			expected: "hello%0Dworld",
		},
		{
			name:     "Mixed valid and invalid characters",
			input:    "Valid text\x00invalid\x1Fmore valid 🚀",
			expected: "Valid text%00invalid%1Fmore valid 🚀",
		},
		{
			name:     "Empty string remains empty",
			input:    "",
			expected: "",
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			result := sanitizeHTTPHeaderValueForGRPC(tc.input)
			require.Equal(t, tc.expected, result)
		})
	}
}
