package clientmiddleware

import (
	"net/http"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana/pkg/plugins/manager/client/clienttest"
	"github.com/grafana/grafana/pkg/services/user"
)

func TestDatasourceAuthorizationMiddleware(t *testing.T) {

	req, err := http.NewRequest(http.MethodGet, "/some/thing", nil)
	require.NoError(t, err)

	req.Header.Set("X-Ds-Authorization", "Bearer Token")

	t.Run("Requests are for a datasource", func(t *testing.T) {
		cdt := clienttest.NewClientDecoratorTest(t,
			clienttest.WithReqContext(req, &user.SignedInUser{}),
			clienttest.WithMiddlewares(
				NewClearAuthHeadersMiddleware(),
				NewDatasourceAuthorizationMiddleware(),
			),
		)

		pluginCtx := backend.PluginContext{
			DataSourceInstanceSettings: &backend.DataSourceInstanceSettings{},
		}

		t.Run("Should contain datasource authorization header when calling QueryData", func(t *testing.T) {
			_, err = cdt.Decorator.QueryData(req.Context(), &backend.QueryDataRequest{
				PluginContext: pluginCtx,
			})
			require.NoError(t, err)
			require.NotNil(t, cdt.QueryDataReq)
			require.Len(t, cdt.QueryDataReq.Headers, 1)
			require.Equal(t, "Bearer Token", cdt.QueryDataReq.GetHTTPHeader("X-Ds-Authorization"))
		})

		t.Run("Should contain datasource authorization header when calling CallResource", func(t *testing.T) {
			err = cdt.Decorator.CallResource(req.Context(), &backend.CallResourceRequest{
				PluginContext: pluginCtx,
			}, nopCallResourceSender)
			require.NoError(t, err)
			require.NotNil(t, cdt.CallResourceReq)
			require.Len(t, cdt.CallResourceReq.Headers, 1)
			require.Equal(t, "Bearer Token", cdt.QueryDataReq.GetHTTPHeader("X-Ds-Authorization"))
		})

		t.Run("Should contain datasource authorization header when calling CheckHealth", func(t *testing.T) {
			_, err = cdt.Decorator.CheckHealth(req.Context(), &backend.CheckHealthRequest{
				PluginContext: pluginCtx,
			})
			require.NoError(t, err)
			require.NotNil(t, cdt.CheckHealthReq)
			require.Len(t, cdt.CheckHealthReq.Headers, 1)
			require.Equal(t, "Bearer Token", cdt.QueryDataReq.GetHTTPHeader("X-Ds-Authorization"))
		})
	})

	t.Run("Requests are for an app", func(t *testing.T) {
		cdt := clienttest.NewClientDecoratorTest(t,
			clienttest.WithReqContext(req, &user.SignedInUser{}),
			clienttest.WithMiddlewares(
				NewClearAuthHeadersMiddleware(),
				NewDatasourceAuthorizationMiddleware(),
			),
		)

		pluginCtx := backend.PluginContext{
			AppInstanceSettings: &backend.AppInstanceSettings{},
		}

		t.Run("Should contain datasource authorization header when calling QueryData", func(t *testing.T) {
			_, err = cdt.Decorator.QueryData(req.Context(), &backend.QueryDataRequest{
				PluginContext: pluginCtx,
			})
			require.NoError(t, err)
			require.NotNil(t, cdt.QueryDataReq)
			require.Len(t, cdt.QueryDataReq.Headers, 1)
			require.Equal(t, "Bearer Token", cdt.QueryDataReq.GetHTTPHeader("X-Ds-Authorization"))
		})

		t.Run("Should contain datasource authorization header when calling CallResource", func(t *testing.T) {
			err = cdt.Decorator.CallResource(req.Context(), &backend.CallResourceRequest{
				PluginContext: pluginCtx,
			}, nopCallResourceSender)
			require.NoError(t, err)
			require.NotNil(t, cdt.CallResourceReq)
			require.Len(t, cdt.CallResourceReq.Headers, 1)
			require.Equal(t, "Bearer Token", cdt.QueryDataReq.GetHTTPHeader("X-Ds-Authorization"))
		})

		t.Run("Should contain datasource authorization header when calling CheckHealth", func(t *testing.T) {
			_, err = cdt.Decorator.CheckHealth(req.Context(), &backend.CheckHealthRequest{
				PluginContext: pluginCtx,
			})
			require.NoError(t, err)
			require.NotNil(t, cdt.CheckHealthReq)
			require.Len(t, cdt.CheckHealthReq.Headers, 1)
			require.Equal(t, "Bearer Token", cdt.QueryDataReq.GetHTTPHeader("X-Ds-Authorization"))
		})
	})
}
