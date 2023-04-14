package clientmiddleware

import (
	"net/http"
	"testing"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana/pkg/plugins/manager/client/clienttest"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/util/proxyutil"
	"github.com/stretchr/testify/require"
)

func TestUserHeaderMiddleware(t *testing.T) {
	t.Run("When anononymous user in reqContext", func(t *testing.T) {
		req, err := http.NewRequest(http.MethodGet, "/some/thing", nil)
		require.NoError(t, err)

		t.Run("And requests are for a datasource", func(t *testing.T) {
			cdt := clienttest.NewClientDecoratorTest(t,
				clienttest.WithReqContext(req, &user.SignedInUser{
					IsAnonymous: true,
					Login:       "anonymous"},
				),
				clienttest.WithMiddlewares(NewUserHeaderMiddleware()),
			)

			pluginCtx := backend.PluginContext{
				DataSourceInstanceSettings: &backend.DataSourceInstanceSettings{},
			}

			t.Run("Should not forward user header when calling QueryData", func(t *testing.T) {
				_, err = cdt.Decorator.QueryData(req.Context(), &backend.QueryDataRequest{
					PluginContext: pluginCtx,
					Headers:       map[string]string{},
				})
				require.NoError(t, err)
				require.NotNil(t, cdt.QueryDataReq)
				require.Empty(t, cdt.QueryDataReq.Headers)
			})

			t.Run("Should not forward user header when calling CallResource", func(t *testing.T) {
				err = cdt.Decorator.CallResource(req.Context(), &backend.CallResourceRequest{
					PluginContext: pluginCtx,
					Headers:       map[string][]string{},
				}, nopCallResourceSender)
				require.NoError(t, err)
				require.NotNil(t, cdt.CallResourceReq)
				require.Empty(t, cdt.CallResourceReq.Headers)
			})

			t.Run("Should not forward user header when calling CheckHealth", func(t *testing.T) {
				_, err = cdt.Decorator.CheckHealth(req.Context(), &backend.CheckHealthRequest{
					PluginContext: pluginCtx,
					Headers:       map[string]string{},
				})
				require.NoError(t, err)
				require.NotNil(t, cdt.CheckHealthReq)
				require.Empty(t, cdt.CheckHealthReq.Headers)
			})
		})

		t.Run("And requests are for an app", func(t *testing.T) {
			cdt := clienttest.NewClientDecoratorTest(t,
				clienttest.WithReqContext(req, &user.SignedInUser{
					IsAnonymous: true,
					Login:       "anonymous"},
				),
				clienttest.WithMiddlewares(NewUserHeaderMiddleware()),
			)

			pluginCtx := backend.PluginContext{
				AppInstanceSettings: &backend.AppInstanceSettings{},
			}

			t.Run("Should not forward user header when calling QueryData", func(t *testing.T) {
				_, err = cdt.Decorator.QueryData(req.Context(), &backend.QueryDataRequest{
					PluginContext: pluginCtx,
					Headers:       map[string]string{},
				})
				require.NoError(t, err)
				require.NotNil(t, cdt.QueryDataReq)
				require.Empty(t, cdt.QueryDataReq.Headers)
			})

			t.Run("Should not forward user header when calling CallResource", func(t *testing.T) {
				err = cdt.Decorator.CallResource(req.Context(), &backend.CallResourceRequest{
					PluginContext: pluginCtx,
					Headers:       map[string][]string{},
				}, nopCallResourceSender)
				require.NoError(t, err)
				require.NotNil(t, cdt.CallResourceReq)
				require.Empty(t, cdt.CallResourceReq.Headers)
			})

			t.Run("Should not forward user header when calling CheckHealth", func(t *testing.T) {
				_, err = cdt.Decorator.CheckHealth(req.Context(), &backend.CheckHealthRequest{
					PluginContext: pluginCtx,
					Headers:       map[string]string{},
				})
				require.NoError(t, err)
				require.NotNil(t, cdt.CheckHealthReq)
				require.Empty(t, cdt.CheckHealthReq.Headers)
			})
		})
	})

	t.Run("When real user in reqContext", func(t *testing.T) {
		req, err := http.NewRequest(http.MethodGet, "/some/thing", nil)
		require.NoError(t, err)

		t.Run("And requests are for a datasource", func(t *testing.T) {
			cdt := clienttest.NewClientDecoratorTest(t,
				clienttest.WithReqContext(req, &user.SignedInUser{
					Login: "admin",
				}),
				clienttest.WithMiddlewares(NewUserHeaderMiddleware()),
			)

			pluginCtx := backend.PluginContext{
				DataSourceInstanceSettings: &backend.DataSourceInstanceSettings{},
			}

			t.Run("Should forward user header when calling QueryData", func(t *testing.T) {
				_, err = cdt.Decorator.QueryData(req.Context(), &backend.QueryDataRequest{
					PluginContext: pluginCtx,
					Headers:       map[string]string{},
				})
				require.NoError(t, err)
				require.NotNil(t, cdt.QueryDataReq)
				require.Len(t, cdt.QueryDataReq.Headers, 1)
				require.Equal(t, "admin", cdt.QueryDataReq.GetHTTPHeader(proxyutil.UserHeaderName))
			})

			t.Run("Should forward user header when calling CallResource", func(t *testing.T) {
				err = cdt.Decorator.CallResource(req.Context(), &backend.CallResourceRequest{
					PluginContext: pluginCtx,
					Headers:       map[string][]string{},
				}, nopCallResourceSender)
				require.NoError(t, err)
				require.NotNil(t, cdt.CallResourceReq)
				require.Len(t, cdt.CallResourceReq.Headers, 1)
				require.Equal(t, "admin", cdt.CallResourceReq.GetHTTPHeader(proxyutil.UserHeaderName))
			})

			t.Run("Should forward user header when calling CheckHealth", func(t *testing.T) {
				_, err = cdt.Decorator.CheckHealth(req.Context(), &backend.CheckHealthRequest{
					PluginContext: pluginCtx,
					Headers:       map[string]string{},
				})
				require.NoError(t, err)
				require.NotNil(t, cdt.CheckHealthReq)
				require.Len(t, cdt.CheckHealthReq.Headers, 1)
				require.Equal(t, "admin", cdt.CheckHealthReq.GetHTTPHeader(proxyutil.UserHeaderName))
			})
		})

		t.Run("And requests are for an app", func(t *testing.T) {
			cdt := clienttest.NewClientDecoratorTest(t,
				clienttest.WithReqContext(req, &user.SignedInUser{
					Login: "admin",
				}),
				clienttest.WithMiddlewares(NewUserHeaderMiddleware()),
			)

			pluginCtx := backend.PluginContext{
				AppInstanceSettings: &backend.AppInstanceSettings{},
			}

			t.Run("Should forward user header when calling QueryData", func(t *testing.T) {
				_, err = cdt.Decorator.QueryData(req.Context(), &backend.QueryDataRequest{
					PluginContext: pluginCtx,
					Headers:       map[string]string{},
				})
				require.NoError(t, err)
				require.NotNil(t, cdt.QueryDataReq)
				require.Len(t, cdt.QueryDataReq.Headers, 1)
				require.Equal(t, "admin", cdt.QueryDataReq.GetHTTPHeader(proxyutil.UserHeaderName))
			})

			t.Run("Should forward user header when calling CallResource", func(t *testing.T) {
				err = cdt.Decorator.CallResource(req.Context(), &backend.CallResourceRequest{
					PluginContext: pluginCtx,
					Headers:       map[string][]string{},
				}, nopCallResourceSender)
				require.NoError(t, err)
				require.NotNil(t, cdt.CallResourceReq)
				require.Len(t, cdt.CallResourceReq.Headers, 1)
				require.Equal(t, "admin", cdt.CallResourceReq.GetHTTPHeader(proxyutil.UserHeaderName))
			})

			t.Run("Should forward user header when calling CheckHealth", func(t *testing.T) {
				_, err = cdt.Decorator.CheckHealth(req.Context(), &backend.CheckHealthRequest{
					PluginContext: pluginCtx,
					Headers:       map[string]string{},
				})
				require.NoError(t, err)
				require.NotNil(t, cdt.CheckHealthReq)
				require.Len(t, cdt.CheckHealthReq.Headers, 1)
				require.Equal(t, "admin", cdt.CheckHealthReq.GetHTTPHeader(proxyutil.UserHeaderName))
			})
		})
	})
}
