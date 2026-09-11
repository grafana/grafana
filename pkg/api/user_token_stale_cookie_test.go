package api

import (
	"context"
	"net/http"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/auth"
	"github.com/grafana/grafana/pkg/services/auth/authtest"
	contextmodel "github.com/grafana/grafana/pkg/services/contexthandler/model"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/web/webtest"
)

func TestHTTPServer_RotateUserAuthToken_DeletesCookieWhenTokenNotFound(t *testing.T) {
	server := SetupAPITestServer(t, func(hs *HTTPServer) {
		cfg := setting.NewCfg()
		cfg.LoginCookieName = "grafana_session"
		cfg.LoginMaxLifetime = 10 * time.Hour
		hs.Cfg = cfg
		hs.log = log.New()
		hs.AuthTokenService = &authtest.FakeUserAuthTokenService{
			RotateTokenProvider: func(ctx context.Context, cmd auth.RotateCommand) (*auth.UserToken, error) {
				return nil, auth.ErrUserTokenNotFound
			},
		}
	})

	req := server.NewPostRequest("/api/user/auth-tokens/rotate", nil)
	req.AddCookie(&http.Cookie{Name: "grafana_session", Value: "stale", Path: "/"})

	res, err := server.Send(req)
	require.NoError(t, err)
	assert.Equal(t, http.StatusUnauthorized, res.StatusCode)
	assert.Equal(t, []string{
		"grafana_session=; Path=/; Max-Age=0; HttpOnly",
		"grafana_session_expiry=; Path=/; Max-Age=0",
	}, res.Header.Values("Set-Cookie"))
	require.NoError(t, res.Body.Close())
}

func TestHTTPServer_RotateUserAuthTokenRedirect_DeletesCookieWhenTokenNotFound(t *testing.T) {
	server := SetupAPITestServer(t, func(hs *HTTPServer) {
		cfg := setting.NewCfg()
		cfg.LoginCookieName = "grafana_session"
		cfg.LoginMaxLifetime = 10 * time.Hour
		hs.Cfg = cfg
		hs.log = log.New()
		hs.AuthTokenService = &authtest.FakeUserAuthTokenService{
			RotateTokenProvider: func(ctx context.Context, cmd auth.RotateCommand) (*auth.UserToken, error) {
				return nil, auth.ErrUserTokenNotFound
			},
		}
	})

	req := server.NewGetRequest("/user/auth-tokens/rotate")
	req.AddCookie(&http.Cookie{Name: "grafana_session", Value: "stale", Path: "/"})
	req = webtest.RequestWithWebContext(req, &contextmodel.ReqContext{UseSessionStorageRedirect: true})

	var redirectStatusCode int
	var redirectLocation string
	server.HttpClient.CheckRedirect = func(req *http.Request, via []*http.Request) error {
		if req.Response == nil {
			return nil
		}
		redirectStatusCode = req.Response.StatusCode
		redirectLocation = req.Response.Header.Get("Location")
		return http.ErrUseLastResponse
	}

	res, err := server.Send(req)
	require.NoError(t, err)
	assert.Equal(t, http.StatusFound, redirectStatusCode)
	assert.Equal(t, "/login", redirectLocation)
	assert.Equal(t, []string{
		"grafana_session=; Path=/; Max-Age=0; HttpOnly",
		"grafana_session_expiry=; Path=/; Max-Age=0",
	}, res.Header.Values("Set-Cookie"))
	require.NoError(t, res.Body.Close())
}
