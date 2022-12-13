package clientmiddleware

import (
	"encoding/json"
	"net/http"
	"testing"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/backend/httpclient"
	"github.com/grafana/grafana/pkg/infra/httpclient/httpclientprovider"
	"github.com/grafana/grafana/pkg/plugins/manager/client/clienttest"
	"github.com/grafana/grafana/pkg/services/oauthtoken/oauthtokentest"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/stretchr/testify/require"
	"golang.org/x/oauth2"
)

func TestOAuthTokenMiddleware(t *testing.T) {
	const otherHeader = "test"

	t.Run("When oauthPassThru not configured for a datasource", func(t *testing.T) {
		req, err := http.NewRequest(http.MethodGet, "/some/thing", nil)
		require.NoError(t, err)

		req.Header.Set(otherHeader, "test")

		oAuthTokenService := &oauthtokentest.Service{}
		cdt := clienttest.NewClientDecoratorTest(t,
			clienttest.WithReqContext(req, &user.SignedInUser{}),
			clienttest.WithMiddlewares(NewOAuthTokenMiddleware(oAuthTokenService)),
		)

		jsonDataMap := map[string]interface{}{}
		jsonDataBytes, err := json.Marshal(&jsonDataMap)
		require.NoError(t, err)

		pluginCtx := backend.PluginContext{
			DataSourceInstanceSettings: &backend.DataSourceInstanceSettings{
				JSONData: jsonDataBytes,
			},
		}

		t.Run("Should not forward OAuth Identity when calling QueryData", func(t *testing.T) {
			_, err = cdt.Decorator.QueryData(req.Context(), &backend.QueryDataRequest{
				PluginContext: pluginCtx,
				Headers:       map[string]string{otherHeader: "test"},
			})
			require.NoError(t, err)
			require.NotNil(t, cdt.QueryDataReq)
			require.Len(t, cdt.QueryDataReq.Headers, 1)
			require.Equal(t, "test", cdt.QueryDataReq.Headers[otherHeader])

			middlewares := httpclient.ContextualMiddlewareFromContext(cdt.QueryDataCtx)
			require.Len(t, middlewares, 0)
		})

		t.Run("Should not forward OAuth Identity when calling CallResource", func(t *testing.T) {
			err = cdt.Decorator.CallResource(req.Context(), &backend.CallResourceRequest{
				PluginContext: pluginCtx,
				Headers:       map[string][]string{otherHeader: {"test"}},
			}, nopCallResourceSender)
			require.NoError(t, err)
			require.NotNil(t, cdt.CallResourceReq)
			require.Len(t, cdt.CallResourceReq.Headers, 1)
			require.Equal(t, "test", cdt.CallResourceReq.Headers[otherHeader][0])

			middlewares := httpclient.ContextualMiddlewareFromContext(cdt.CallResourceCtx)
			require.Len(t, middlewares, 0)
		})

		t.Run("Should not forward OAuth Identity when calling CheckHealth", func(t *testing.T) {
			_, err = cdt.Decorator.CheckHealth(req.Context(), &backend.CheckHealthRequest{
				PluginContext: pluginCtx,
				Headers:       map[string]string{otherHeader: "test"},
			})
			require.NoError(t, err)
			require.NotNil(t, cdt.CheckHealthReq)
			require.Len(t, cdt.CheckHealthReq.Headers, 1)
			require.Equal(t, "test", cdt.CheckHealthReq.Headers[otherHeader])

			middlewares := httpclient.ContextualMiddlewareFromContext(cdt.CheckHealthCtx)
			require.Len(t, middlewares, 0)
		})
	})

	t.Run("When oauthPassThru configured for a datasource", func(t *testing.T) {
		req, err := http.NewRequest(http.MethodGet, "/some/thing", nil)
		require.NoError(t, err)

		req.Header.Set(otherHeader, "test")

		token := &oauth2.Token{
			TokenType:   "bearer",
			AccessToken: "access-token",
		}
		token = token.WithExtra(map[string]interface{}{"id_token": "id-token"})
		oAuthTokenService := &oauthtokentest.Service{
			Token: token,
		}
		cdt := clienttest.NewClientDecoratorTest(t,
			clienttest.WithReqContext(req, &user.SignedInUser{}),
			clienttest.WithMiddlewares(NewOAuthTokenMiddleware(oAuthTokenService)),
		)

		jsonDataMap := map[string]interface{}{
			"oauthPassThru": true,
		}
		jsonDataBytes, err := json.Marshal(&jsonDataMap)
		require.NoError(t, err)

		pluginCtx := backend.PluginContext{
			DataSourceInstanceSettings: &backend.DataSourceInstanceSettings{
				JSONData: jsonDataBytes,
			},
		}

		t.Run("Should forward OAuth Identity when calling QueryData", func(t *testing.T) {
			_, err = cdt.Decorator.QueryData(req.Context(), &backend.QueryDataRequest{
				PluginContext: pluginCtx,
				Headers:       map[string]string{otherHeader: "test"},
			})
			require.NoError(t, err)
			require.NotNil(t, cdt.QueryDataReq)
			require.Len(t, cdt.QueryDataReq.Headers, 3)
			require.Equal(t, "test", cdt.QueryDataReq.Headers[otherHeader])
			require.Equal(t, "Bearer access-token", cdt.QueryDataReq.Headers[tokenHeaderName])
			require.Equal(t, "id-token", cdt.QueryDataReq.Headers[idTokenHeaderName])

			middlewares := httpclient.ContextualMiddlewareFromContext(cdt.QueryDataCtx)
			require.Len(t, middlewares, 1)
			require.Equal(t, httpclientprovider.SetHeadersMiddlewareName, middlewares[0].(httpclient.MiddlewareName).MiddlewareName())

			reqClone := req.Clone(req.Context())
			res, err := middlewares[0].CreateMiddleware(httpclient.Options{}, finalRoundTripper).RoundTrip(reqClone)
			require.NoError(t, err)
			require.NoError(t, res.Body.Close())
			require.Len(t, reqClone.Header, 3)
			require.Equal(t, "test", reqClone.Header.Get(otherHeader))
			require.Equal(t, "Bearer access-token", reqClone.Header.Get(tokenHeaderName))
			// We don't use Get here because idTokenHeaderName is not in canonical format
			require.Equal(t, []string{"id-token"}, reqClone.Header[idTokenHeaderName])
			require.Empty(t, reqClone.Header["X-Id-Token"], "X-ID-Token and X-Id-Token are both present")
		})

		t.Run("Should forward OAuth Identity when calling CallResource", func(t *testing.T) {
			err = cdt.Decorator.CallResource(req.Context(), &backend.CallResourceRequest{
				PluginContext: pluginCtx,
				Headers:       map[string][]string{otherHeader: {"test"}},
			}, nopCallResourceSender)
			require.NoError(t, err)
			require.NotNil(t, cdt.CallResourceReq)
			require.Len(t, cdt.CallResourceReq.Headers, 3)
			require.Equal(t, "test", cdt.CallResourceReq.Headers[otherHeader][0])
			require.Len(t, cdt.CallResourceReq.Headers[tokenHeaderName], 1)
			require.Equal(t, "Bearer access-token", cdt.CallResourceReq.Headers[tokenHeaderName][0])
			require.Len(t, cdt.CallResourceReq.Headers[idTokenHeaderName], 1)
			require.Equal(t, "id-token", cdt.CallResourceReq.Headers[idTokenHeaderName][0])

			middlewares := httpclient.ContextualMiddlewareFromContext(cdt.CallResourceCtx)
			require.Len(t, middlewares, 1)
			require.Equal(t, httpclientprovider.SetHeadersMiddlewareName, middlewares[0].(httpclient.MiddlewareName).MiddlewareName())

			reqClone := req.Clone(req.Context())
			res, err := middlewares[0].CreateMiddleware(httpclient.Options{}, finalRoundTripper).RoundTrip(reqClone)
			require.NoError(t, err)
			require.NoError(t, res.Body.Close())
			require.Len(t, reqClone.Header, 3)
			require.Equal(t, "test", reqClone.Header.Get(otherHeader))
			require.Equal(t, "Bearer access-token", reqClone.Header.Get(tokenHeaderName))
			// We don't use Get here because idTokenHeaderName is not in canonical format
			require.Equal(t, []string{"id-token"}, reqClone.Header[idTokenHeaderName])
			require.Empty(t, reqClone.Header["X-Id-Token"], "X-ID-Token and X-Id-Token are both present")
		})

		t.Run("Should forward OAuth Identity when calling CheckHealth", func(t *testing.T) {
			_, err = cdt.Decorator.CheckHealth(req.Context(), &backend.CheckHealthRequest{
				PluginContext: pluginCtx,
				Headers:       map[string]string{otherHeader: "test"},
			})
			require.NoError(t, err)
			require.NotNil(t, cdt.CheckHealthReq)
			require.Len(t, cdt.CheckHealthReq.Headers, 3)
			require.Equal(t, "test", cdt.CheckHealthReq.Headers[otherHeader])
			require.Equal(t, "Bearer access-token", cdt.CheckHealthReq.Headers[tokenHeaderName])
			require.Equal(t, "id-token", cdt.CheckHealthReq.Headers[idTokenHeaderName])

			middlewares := httpclient.ContextualMiddlewareFromContext(cdt.CheckHealthCtx)
			require.Len(t, middlewares, 1)
			require.Equal(t, httpclientprovider.SetHeadersMiddlewareName, middlewares[0].(httpclient.MiddlewareName).MiddlewareName())

			reqClone := req.Clone(req.Context())
			res, err := middlewares[0].CreateMiddleware(httpclient.Options{}, finalRoundTripper).RoundTrip(reqClone)
			require.NoError(t, err)
			require.NoError(t, res.Body.Close())
			require.Len(t, reqClone.Header, 3)
			require.Equal(t, "test", reqClone.Header.Get(otherHeader))
			require.Equal(t, "Bearer access-token", reqClone.Header.Get(tokenHeaderName))
			// We don't use Get here because idTokenHeaderName is not in canonical format
			require.Equal(t, []string{"id-token"}, reqClone.Header[idTokenHeaderName])
			require.Empty(t, reqClone.Header["X-Id-Token"], "X-ID-Token and X-Id-Token are both present")
		})
	})
}
