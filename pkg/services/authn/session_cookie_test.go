package authn

import (
	"net/http"
	"net/http/httptest"
	"strconv"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/models/usertoken"
	"github.com/grafana/grafana/pkg/setting"
)

func TestWriteSessionCookieUsesProvidedConfig(t *testing.T) {
	for _, tc := range []struct {
		name     string
		path     string
		secure   bool
		sameSite http.SameSite
		disabled bool
	}{
		{name: "secure subpath", path: "/tenant", secure: true, sameSite: http.SameSiteStrictMode},
		{name: "root", path: "", sameSite: http.SameSiteLaxMode},
		{name: "same site disabled", path: "/other", secure: true, disabled: true},
	} {
		t.Run(tc.name, func(t *testing.T) {
			cfg := setting.NewCfg()
			cfg.LoginCookieName = "tenant_session"
			cfg.AppSubURL = tc.path
			cfg.CookieSecure = tc.secure
			cfg.CookieSameSiteMode = tc.sameSite
			cfg.CookieSameSiteDisabled = tc.disabled
			cfg.LoginMaxLifetime = 24 * time.Hour
			cfg.TokenRotationIntervalMinutes = 10
			token := &usertoken.UserToken{UnhashedToken: "session-token", RotatedAt: 1000}
			rr := httptest.NewRecorder()
			WriteSessionCookie(rr, cfg, token)

			cookies := rr.Result().Cookies()
			require.Len(t, cookies, 2)
			assert.Equal(t, cfg.LoginCookieName, cookies[0].Name)
			assert.Equal(t, token.UnhashedToken, cookies[0].Value)
			assert.True(t, cookies[0].HttpOnly)
			assert.Equal(t, sessionExpiryCookie, cookies[1].Name)
			assert.Equal(t, strconv.FormatInt(token.NextRotation(10*time.Minute).Unix(), 10), cookies[1].Value)
			assert.False(t, cookies[1].HttpOnly)
			path := tc.path
			if path == "" {
				path = "/"
			}
			for _, cookie := range cookies {
				assert.Equal(t, path, cookie.Path)
				assert.Equal(t, tc.secure, cookie.Secure)
				assert.Equal(t, int(cfg.LoginMaxLifetime.Seconds()), cookie.MaxAge)
				if tc.disabled {
					assert.Zero(t, cookie.SameSite)
				} else {
					assert.Equal(t, tc.sameSite, cookie.SameSite)
				}
			}
		})
	}
}
