package clientmiddleware

import (
	"net/http"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana/pkg/plugins/manager/client/clienttest"
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
			})

			t.Run("Should not attach delete headers middleware when calling CallResource", func(t *testing.T) {
				err = cdt.Decorator.CallResource(req.Context(), &backend.CallResourceRequest{
					PluginContext: pluginCtx,
					Headers:       map[string][]string{otherHeader: {"test"}},
				}, nopCallResourceSender)
				require.NoError(t, err)
				require.NotNil(t, cdt.CallResourceReq)
				require.Len(t, cdt.CallResourceReq.Headers, 1)
			})

			t.Run("Should not attach delete headers middleware when calling CheckHealth", func(t *testing.T) {
				_, err = cdt.Decorator.CheckHealth(req.Context(), &backend.CheckHealthRequest{
					PluginContext: pluginCtx,
					Headers:       map[string]string{otherHeader: "test"},
				})
				require.NoError(t, err)
				require.NotNil(t, cdt.CheckHealthReq)
				require.Len(t, cdt.CheckHealthReq.Headers, 1)
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
			})

			t.Run("Should not attach delete headers middleware when calling CallResource", func(t *testing.T) {
				err = cdt.Decorator.CallResource(req.Context(), &backend.CallResourceRequest{
					PluginContext: pluginCtx,
					Headers:       map[string][]string{otherHeader: {"test"}},
				}, nopCallResourceSender)
				require.NoError(t, err)
				require.NotNil(t, cdt.CallResourceReq)
				require.Len(t, cdt.CallResourceReq.Headers, 1)
			})

			t.Run("Should not attach delete headers middleware when calling CheckHealth", func(t *testing.T) {
				_, err = cdt.Decorator.CheckHealth(req.Context(), &backend.CheckHealthRequest{
					PluginContext: pluginCtx,
					Headers:       map[string]string{otherHeader: "test"},
				})
				require.NoError(t, err)
				require.NotNil(t, cdt.CheckHealthReq)
				require.Len(t, cdt.CheckHealthReq.Headers, 1)
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

			req := req.WithContext(contexthandler.WithAuthHTTPHeaders(req.Context(), setting.NewCfg()))
			req.Header.Set("Authorization", "val")

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
				require.Equal(t, "test", cdt.QueryDataReq.Headers[otherHeader])
			})

			t.Run("Should attach delete headers middleware when calling CallResource", func(t *testing.T) {
				err = cdt.Decorator.CallResource(req.Context(), &backend.CallResourceRequest{
					PluginContext: pluginCtx,
					Headers:       map[string][]string{otherHeader: {"test"}},
				}, nopCallResourceSender)
				require.NoError(t, err)
				require.NotNil(t, cdt.CallResourceReq)
				require.Len(t, cdt.CallResourceReq.Headers, 1)
				require.Equal(t, []string{"test"}, cdt.CallResourceReq.Headers[otherHeader])
			})

			t.Run("Should attach delete headers middleware when calling CheckHealth", func(t *testing.T) {
				_, err = cdt.Decorator.CheckHealth(req.Context(), &backend.CheckHealthRequest{
					PluginContext: pluginCtx,
					Headers:       map[string]string{otherHeader: "test"},
				})
				require.NoError(t, err)
				require.NotNil(t, cdt.CheckHealthReq)
				require.Len(t, cdt.CheckHealthReq.Headers, 1)
				require.Equal(t, "test", cdt.CheckHealthReq.Headers[otherHeader])
			})
		})

		t.Run("And requests are for an app", func(t *testing.T) {
			cdt := clienttest.NewClientDecoratorTest(t,
				clienttest.WithReqContext(req, &user.SignedInUser{}),
				clienttest.WithMiddlewares(NewClearAuthHeadersMiddleware()),
			)

			req := req.WithContext(contexthandler.WithAuthHTTPHeaders(req.Context(), setting.NewCfg()))
			req.Header.Set("Authorization", "val")

			const otherHeader = "x-Other"
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
				require.Equal(t, "test", cdt.QueryDataReq.Headers[otherHeader])
			})

			t.Run("Should attach delete headers middleware when calling CallResource", func(t *testing.T) {
				err = cdt.Decorator.CallResource(req.Context(), &backend.CallResourceRequest{
					PluginContext: pluginCtx,
					Headers:       map[string][]string{otherHeader: {"test"}},
				}, nopCallResourceSender)
				require.NoError(t, err)
				require.NotNil(t, cdt.CallResourceReq)
				require.Len(t, cdt.CallResourceReq.Headers, 1)
				require.Equal(t, []string{"test"}, cdt.CallResourceReq.Headers[otherHeader])
			})

			t.Run("Should attach delete headers middleware when calling CheckHealth", func(t *testing.T) {
				_, err = cdt.Decorator.CheckHealth(req.Context(), &backend.CheckHealthRequest{
					PluginContext: pluginCtx,
					Headers:       map[string]string{otherHeader: "test"},
				})
				require.NoError(t, err)
				require.NotNil(t, cdt.CheckHealthReq)
				require.Len(t, cdt.CheckHealthReq.Headers, 1)
				require.Equal(t, "test", cdt.CheckHealthReq.Headers[otherHeader])
			})
		})
	})
}
