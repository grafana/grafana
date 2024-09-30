package clientmiddleware

import (
	"encoding/json"
	"net/http"
	"testing"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/backend/handlertest"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/stretchr/testify/require"
)

func TestCookiesMiddleware(t *testing.T) {
	const otherHeader = "test"

	t.Run("When keepCookies not configured for a datasource", func(t *testing.T) {
		req, err := http.NewRequest(http.MethodGet, "/some/thing", nil)
		require.NoError(t, err)
		req.AddCookie(&http.Cookie{
			Name: "cookie1",
		})
		req.AddCookie(&http.Cookie{
			Name: "cookie2",
		})
		req.AddCookie(&http.Cookie{
			Name: "cookie3",
		})
		req.Header.Set(otherHeader, "test")

		cdt := handlertest.NewHandlerMiddlewareTest(t,
			WithReqContext(req, &user.SignedInUser{}),
			handlertest.WithMiddlewares(NewCookiesMiddleware([]string{"grafana_session"})),
		)

		jsonDataMap := map[string]any{}
		jsonDataBytes, err := json.Marshal(&jsonDataMap)
		require.NoError(t, err)

		pluginCtx := backend.PluginContext{
			DataSourceInstanceSettings: &backend.DataSourceInstanceSettings{
				JSONData: jsonDataBytes,
			},
		}

		t.Run("Should not forward cookies when calling QueryData", func(t *testing.T) {
			_, err = cdt.MiddlewareHandler.QueryData(req.Context(), &backend.QueryDataRequest{
				PluginContext: pluginCtx,
				Headers:       map[string]string{otherHeader: "test"},
			})
			require.NoError(t, err)
			require.NotNil(t, cdt.QueryDataReq)
			require.Len(t, cdt.QueryDataReq.Headers, 1)
			require.Equal(t, "test", cdt.QueryDataReq.Headers[otherHeader])
		})

		t.Run("Should not forward cookies when calling CallResource", func(t *testing.T) {
			pReq := &backend.CallResourceRequest{
				PluginContext: pluginCtx,
				Headers:       map[string][]string{otherHeader: {"test"}},
			}
			pReq.Headers[backend.CookiesHeaderName] = []string{req.Header.Get(backend.CookiesHeaderName)}
			err = cdt.MiddlewareHandler.CallResource(req.Context(), pReq, nopCallResourceSender)
			require.NoError(t, err)
			require.NotNil(t, cdt.CallResourceReq)
			require.Len(t, cdt.CallResourceReq.Headers, 1)
			require.Equal(t, "test", cdt.CallResourceReq.Headers[otherHeader][0])
		})

		t.Run("Should not forward cookies when calling CheckHealth", func(t *testing.T) {
			_, err = cdt.MiddlewareHandler.CheckHealth(req.Context(), &backend.CheckHealthRequest{
				PluginContext: pluginCtx,
				Headers:       map[string]string{otherHeader: "test"},
			})
			require.NoError(t, err)
			require.NotNil(t, cdt.CheckHealthReq)
			require.Len(t, cdt.CheckHealthReq.Headers, 1)
			require.Equal(t, "test", cdt.CheckHealthReq.Headers[otherHeader])
		})
	})

	t.Run("When keepCookies configured for a datasource", func(t *testing.T) {
		req, err := http.NewRequest(http.MethodGet, "/some/thing", nil)
		require.NoError(t, err)
		req.AddCookie(&http.Cookie{
			Name: "cookie1",
		})
		req.AddCookie(&http.Cookie{
			Name: "cookie2",
		})
		req.AddCookie(&http.Cookie{
			Name: "cookie3",
		})
		req.AddCookie(&http.Cookie{
			Name: "grafana_session",
		})

		req.Header.Set(otherHeader, "test")

		cdt := handlertest.NewHandlerMiddlewareTest(t,
			WithReqContext(req, &user.SignedInUser{}),
			handlertest.WithMiddlewares(NewCookiesMiddleware([]string{"grafana_session"})),
		)

		jsonDataMap := map[string]any{
			"keepCookies": []string{"cookie2", "grafana_session"},
		}
		jsonDataBytes, err := json.Marshal(&jsonDataMap)
		require.NoError(t, err)

		pluginCtx := backend.PluginContext{
			DataSourceInstanceSettings: &backend.DataSourceInstanceSettings{
				JSONData: jsonDataBytes,
			},
		}

		t.Run("Should forward cookies when calling QueryData", func(t *testing.T) {
			_, err = cdt.MiddlewareHandler.QueryData(req.Context(), &backend.QueryDataRequest{
				PluginContext: pluginCtx,
				Headers:       map[string]string{otherHeader: "test"},
			})
			require.NoError(t, err)
			require.NotNil(t, cdt.QueryDataReq)
			require.Len(t, cdt.QueryDataReq.Headers, 2)
			require.Equal(t, "test", cdt.QueryDataReq.Headers[otherHeader])
			require.EqualValues(t, "cookie2=", cdt.QueryDataReq.Headers[cookieHeaderName])
		})

		t.Run("Should forward cookies when calling CallResource", func(t *testing.T) {
			err = cdt.MiddlewareHandler.CallResource(req.Context(), &backend.CallResourceRequest{
				PluginContext: pluginCtx,
				Headers:       map[string][]string{otherHeader: {"test"}},
			}, nopCallResourceSender)
			require.NoError(t, err)
			require.NotNil(t, cdt.CallResourceReq)
			require.Len(t, cdt.CallResourceReq.Headers, 2)
			require.Equal(t, "test", cdt.CallResourceReq.Headers[otherHeader][0])
			require.Len(t, cdt.CallResourceReq.Headers[cookieHeaderName], 1)
			require.EqualValues(t, "cookie2=", cdt.CallResourceReq.Headers[cookieHeaderName][0])
		})

		t.Run("Should forward cookies when calling CheckHealth", func(t *testing.T) {
			_, err = cdt.MiddlewareHandler.CheckHealth(req.Context(), &backend.CheckHealthRequest{
				PluginContext: pluginCtx,
				Headers:       map[string]string{otherHeader: "test"},
			})
			require.NoError(t, err)
			require.NotNil(t, cdt.CheckHealthReq)
			require.Len(t, cdt.CheckHealthReq.Headers, 2)
			require.Equal(t, "test", cdt.CheckHealthReq.Headers[otherHeader])
			require.EqualValues(t, "cookie2=", cdt.CheckHealthReq.Headers[cookieHeaderName])
		})
	})

	t.Run("When app", func(t *testing.T) {
		req, err := http.NewRequest(http.MethodGet, "/some/thing", nil)
		require.NoError(t, err)
		req.AddCookie(&http.Cookie{
			Name: "cookie1",
		})
		req.AddCookie(&http.Cookie{
			Name: "cookie2",
		})
		req.AddCookie(&http.Cookie{
			Name: "cookie3",
		})
		req.Header.Set(otherHeader, "test")

		cdt := handlertest.NewHandlerMiddlewareTest(t,
			WithReqContext(req, &user.SignedInUser{}),
			handlertest.WithMiddlewares(NewCookiesMiddleware([]string{"grafana_session"})),
		)

		pluginCtx := backend.PluginContext{
			AppInstanceSettings: &backend.AppInstanceSettings{},
		}

		t.Run("Should not forward cookies when calling QueryData", func(t *testing.T) {
			pReq := &backend.QueryDataRequest{
				PluginContext: pluginCtx,
				Headers:       map[string]string{otherHeader: "test"},
			}
			pReq.Headers[backend.CookiesHeaderName] = req.Header.Get(backend.CookiesHeaderName)
			_, err = cdt.MiddlewareHandler.QueryData(req.Context(), pReq)
			require.NoError(t, err)
			require.NotNil(t, cdt.QueryDataReq)
			require.Len(t, cdt.QueryDataReq.Headers, 1)
			require.Equal(t, "test", cdt.QueryDataReq.Headers[otherHeader])
		})

		t.Run("Should not forward cookies when calling CallResource", func(t *testing.T) {
			pReq := &backend.CallResourceRequest{
				PluginContext: pluginCtx,
				Headers:       map[string][]string{otherHeader: {"test"}},
			}
			pReq.Headers[backend.CookiesHeaderName] = []string{req.Header.Get(backend.CookiesHeaderName)}
			err = cdt.MiddlewareHandler.CallResource(req.Context(), pReq, nopCallResourceSender)
			require.NoError(t, err)
			require.NotNil(t, cdt.CallResourceReq)
			require.Len(t, cdt.CallResourceReq.Headers, 1)
			require.Equal(t, "test", cdt.CallResourceReq.Headers[otherHeader][0])
		})

		t.Run("Should not forward cookies when calling CheckHealth", func(t *testing.T) {
			pReq := &backend.CheckHealthRequest{
				PluginContext: pluginCtx,
				Headers:       map[string]string{otherHeader: "test"},
			}
			pReq.Headers[backend.CookiesHeaderName] = req.Header.Get(backend.CookiesHeaderName)
			_, err = cdt.MiddlewareHandler.CheckHealth(req.Context(), pReq)
			require.NoError(t, err)
			require.NotNil(t, cdt.CheckHealthReq)
			require.Len(t, cdt.CheckHealthReq.Headers, 1)
			require.Equal(t, "test", cdt.CheckHealthReq.Headers[otherHeader])
		})
	})
}
