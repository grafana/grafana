package clientmiddleware

import (
	"context"
	"net/http"
	"testing"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/backend/handlertest"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/services/contexthandler/ctxkey"
	contextmodel "github.com/grafana/grafana/pkg/services/contexthandler/model"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/web"
)

func TestExchangedAccessToken(t *testing.T) {
	signedIn := func() context.Context {
		req, err := http.NewRequest(http.MethodGet, "/", nil)
		require.NoError(t, err)
		return context.WithValue(context.Background(), ctxkey.Key{}, &contextmodel.ReqContext{
			Context:      &web.Context{Req: req},
			SignedInUser: &user.SignedInUser{IDToken: "id-token"},
		})
	}
	appCtx := backend.PluginContext{AppInstanceSettings: &backend.AppInstanceSettings{}}

	t.Run("ForwardID does not add the ID token and drops a stale one", func(t *testing.T) {
		cdt := handlertest.NewHandlerMiddlewareTest(t, handlertest.WithMiddlewares(NewForwardIDMiddleware(nil)))
		req := &backend.CallResourceRequest{PluginContext: appCtx}
		req.SetHTTPHeader(forwardIDHeaderName, "stale")
		require.NoError(t, cdt.MiddlewareHandler.CallResource(WithExchangedAccessToken(signedIn()), req, nopCallResourceSender))
		require.Empty(t, cdt.CallResourceReq.GetHTTPHeader(forwardIDHeaderName))

		_, err := cdt.MiddlewareHandler.CheckHealth(WithExchangedAccessToken(signedIn()), &backend.CheckHealthRequest{PluginContext: appCtx})
		require.NoError(t, err)
		require.Empty(t, cdt.CheckHealthReq.GetHTTPHeader(forwardIDHeaderName))
	})

	t.Run("ForwardID still forwards the ID token without the mark", func(t *testing.T) {
		cdt := handlertest.NewHandlerMiddlewareTest(t, handlertest.WithMiddlewares(NewForwardIDMiddleware(nil)))
		require.NoError(t, cdt.MiddlewareHandler.CallResource(signedIn(), &backend.CallResourceRequest{PluginContext: appCtx}, nopCallResourceSender))
		require.Equal(t, "id-token", cdt.CallResourceReq.GetHTTPHeader(forwardIDHeaderName))
	})

	t.Run("ClearAuthHeaders keeps the token when a JWT header has its name", func(t *testing.T) {
		cfg := setting.NewCfg()
		cfg.JWTAuth.Enabled = true
		cfg.JWTAuth.HeaderName = AccessTokenHeaderName
		cdt := handlertest.NewHandlerMiddlewareTest(t, handlertest.WithMiddlewares(NewClearAuthHeadersMiddleware(&cfg.JWTAuth, &cfg.AuthProxy)))
		newReq := func() *backend.CallResourceRequest {
			req := &backend.CallResourceRequest{PluginContext: appCtx}
			req.SetHTTPHeader(AccessTokenHeaderName, "exchanged")
			req.SetHTTPHeader("Authorization", "Basic secret")
			return req
		}

		require.NoError(t, cdt.MiddlewareHandler.CallResource(WithExchangedAccessToken(signedIn()), newReq(), nopCallResourceSender))
		require.Equal(t, "exchanged", cdt.CallResourceReq.GetHTTPHeader(AccessTokenHeaderName))
		require.Empty(t, cdt.CallResourceReq.GetHTTPHeader("Authorization"), "other auth headers are still cleared")

		require.NoError(t, cdt.MiddlewareHandler.CallResource(signedIn(), newReq(), nopCallResourceSender))
		require.Empty(t, cdt.CallResourceReq.GetHTTPHeader(AccessTokenHeaderName), "a caller's JWT header is cleared")
	})
}
