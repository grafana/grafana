package authn

import (
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/models/usertoken"
	"github.com/grafana/grafana/pkg/setting"
)

func TestSessionCookie(t *testing.T) {
	cfg := setting.NewCfg()
	cfg.LoginCookieName = "grafana_session"
	cfg.LoginMaxLifetime = 30 * 24 * time.Hour
	cfg.CookieSecure = true
	cfg.CookieSameSiteMode = http.SameSiteLaxMode
	cfg.AppSubURL = "/grafana"
	w := httptest.NewRecorder()
	WriteSessionCookie(w, cfg, &usertoken.UserToken{UnhashedToken: "opaque-session"})
	cookies := w.Result().Cookies()
	require.Len(t, cookies, 1)
	require.Equal(t, "grafana_session", cookies[0].Name)
	require.Equal(t, "opaque-session", cookies[0].Value)
	require.Equal(t, 2592000, cookies[0].MaxAge)
	require.Equal(t, "/grafana", cookies[0].Path)
	require.True(t, cookies[0].HttpOnly)
	require.True(t, cookies[0].Secure)
	require.Equal(t, http.SameSiteLaxMode, cookies[0].SameSite)

	w = httptest.NewRecorder()
	DeleteSessionCookie(w, cfg)
	cookies = w.Result().Cookies()
	require.Len(t, cookies, 1)
	require.Equal(t, "grafana_session", cookies[0].Name)
	require.Equal(t, "/grafana", cookies[0].Path)
	require.Equal(t, -1, cookies[0].MaxAge)
}
