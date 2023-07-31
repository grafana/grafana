package clientmiddleware

import (
	"net/http"
	"testing"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana/pkg/plugins/manager/client/clienttest"
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
			cdt := clienttest.NewClientDecoratorTest(t,
				clienttest.WithReqContext(req, &user.SignedInUser{
					IsAnonymous: true,
					Login:       "anonymous"},
				),
				clienttest.WithMiddlewares(NewTracingHeaderMiddleware()),
			)

			_, err = cdt.Decorator.QueryData(req.Context(), &backend.QueryDataRequest{
				PluginContext: pluginCtx,
				Headers:       map[string]string{},
			})
			require.NoError(t, err)

			require.Len(t, cdt.QueryDataReq.GetHTTPHeaders(), 0)
		})

		t.Run("tracing headers are not set for health check", func(t *testing.T) {
			cdt := clienttest.NewClientDecoratorTest(t,
				clienttest.WithReqContext(req, &user.SignedInUser{
					IsAnonymous: true,
					Login:       "anonymous"},
				),
				clienttest.WithMiddlewares(NewTracingHeaderMiddleware()),
			)

			_, err = cdt.Decorator.CheckHealth(req.Context(), &backend.CheckHealthRequest{
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
			cdt := clienttest.NewClientDecoratorTest(t,
				clienttest.WithReqContext(req, &user.SignedInUser{
					IsAnonymous: true,
					Login:       "anonymous"},
				),
				clienttest.WithMiddlewares(NewTracingHeaderMiddleware()),
			)

			_, err = cdt.Decorator.QueryData(req.Context(), &backend.QueryDataRequest{
				PluginContext: pluginCtx,
				Headers:       map[string]string{},
			})
			require.NoError(t, err)

			require.Len(t, cdt.QueryDataReq.GetHTTPHeaders(), 0)
		})

		t.Run("tracing headers are not set for health check", func(t *testing.T) {
			cdt := clienttest.NewClientDecoratorTest(t,
				clienttest.WithReqContext(req, &user.SignedInUser{
					IsAnonymous: true,
					Login:       "anonymous"},
				),
				clienttest.WithMiddlewares(NewTracingHeaderMiddleware()),
			)

			_, err = cdt.Decorator.CheckHealth(req.Context(), &backend.CheckHealthRequest{
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
			cdt := clienttest.NewClientDecoratorTest(t,
				clienttest.WithReqContext(req, &user.SignedInUser{
					IsAnonymous: true,
					Login:       "anonymous"},
				),
				clienttest.WithMiddlewares(NewTracingHeaderMiddleware()),
			)

			_, err = cdt.Decorator.QueryData(req.Context(), &backend.QueryDataRequest{
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
			cdt := clienttest.NewClientDecoratorTest(t,
				clienttest.WithReqContext(req, &user.SignedInUser{
					IsAnonymous: true,
					Login:       "anonymous"},
				),
				clienttest.WithMiddlewares(NewTracingHeaderMiddleware()),
			)

			_, err = cdt.Decorator.CheckHealth(req.Context(), &backend.CheckHealthRequest{
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
	})
}
