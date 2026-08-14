package setting

import (
	"net/http"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gopkg.in/ini.v1"
)

func TestApplyAuthnSettings(t *testing.T) {
	t.Run("applies the authn subset and retains raw settings", func(t *testing.T) {
		settings := ini.Empty()
		security, err := settings.NewSection("security")
		require.NoError(t, err)
		_, err = security.NewKey("secret_key", "instance-secret")
		require.NoError(t, err)
		_, err = security.NewKey("encryption_provider", "secretKey.v1")
		require.NoError(t, err)
		_, err = security.NewKey("cookie_secure", "true")
		require.NoError(t, err)
		_, err = security.NewKey("cookie_samesite", "strict")
		require.NoError(t, err)

		auth, err := settings.NewSection("auth")
		require.NoError(t, err)
		_, err = auth.NewKey("login_cookie_name", "tenant_session")
		require.NoError(t, err)
		_, err = auth.NewKey("login_maximum_inactive_lifetime_duration", "12h")
		require.NoError(t, err)
		_, err = auth.NewKey("login_maximum_lifetime_duration", "48h")
		require.NoError(t, err)
		_, err = auth.NewKey("token_rotation_interval_minutes", "3")
		require.NoError(t, err)
		_, err = auth.NewKey("oauth_state_cookie_max_age", "900")
		require.NoError(t, err)

		users, err := settings.NewSection("users")
		require.NoError(t, err)
		_, err = users.NewKey("last_seen_update_interval", "30m")
		require.NoError(t, err)

		server, err := settings.NewSection("server")
		require.NoError(t, err)
		_, err = server.NewKey("root_url", "http://localtest.example.com:8080/")
		require.NoError(t, err)

		grafanaCom, err := settings.NewSection("grafana_com")
		require.NoError(t, err)
		_, err = grafanaCom.NewKey("url", "http://localhost:13001")
		require.NoError(t, err)

		cfg := NewCfg()
		err = cfg.ApplyAuthnSettings(settings)
		require.NoError(t, err)

		assert.Same(t, settings, cfg.Raw)
		assert.Equal(t, "instance-secret", cfg.SecretKey)
		assert.Equal(t, "tenant_session", cfg.LoginCookieName)
		assert.Equal(t, 12*time.Hour, cfg.LoginMaxInactiveLifetime)
		assert.Equal(t, 48*time.Hour, cfg.LoginMaxLifetime)
		assert.Equal(t, 3, cfg.TokenRotationIntervalMinutes)
		assert.Equal(t, 30*time.Minute, cfg.UserLastSeenUpdateInterval)
		assert.Equal(t, "secretKey.v1", cfg.Raw.Section("security").Key("encryption_provider").String())
		assert.Equal(t, 900, cfg.OAuthCookieMaxAge)
		assert.True(t, cfg.CookieSecure)
		assert.Equal(t, http.SameSiteStrictMode, cfg.CookieSameSiteMode)
		assert.Equal(t, "http://localtest.example.com:8080/", cfg.AppURL)
		assert.Empty(t, cfg.AppSubURL)
		assert.Equal(t, "http://localhost:13001", cfg.GrafanaComURL)
	})

	t.Run("applies Grafana defaults", func(t *testing.T) {
		settings := ini.Empty()
		security, err := settings.NewSection("security")
		require.NoError(t, err)
		_, err = security.NewKey("secret_key", "instance-secret")
		require.NoError(t, err)

		cfg := NewCfg()
		err = cfg.ApplyAuthnSettings(settings)
		require.NoError(t, err)

		assert.Equal(t, "grafana_session", cfg.LoginCookieName)
		assert.Equal(t, 7*24*time.Hour, cfg.LoginMaxInactiveLifetime)
		assert.Equal(t, 30*24*time.Hour, cfg.LoginMaxLifetime)
		assert.Equal(t, 10, cfg.TokenRotationIntervalMinutes)
		assert.Equal(t, 15*time.Minute, cfg.UserLastSeenUpdateInterval)
		assert.Equal(t, 600, cfg.OAuthCookieMaxAge)
		assert.False(t, cfg.CookieSecure)
		assert.Equal(t, http.SameSiteLaxMode, cfg.CookieSameSiteMode)
		assert.Equal(t, "http://localhost:3000/", cfg.AppURL)
		assert.Equal(t, "https://grafana.com", cfg.GrafanaComURL)
	})

	t.Run("does not mutate compatibility globals", func(t *testing.T) {
		originalAppURL := AppUrl
		originalCookieSecure := CookieSecure
		originalCookieSameSiteMode := CookieSameSiteMode
		t.Cleanup(func() {
			AppUrl = originalAppURL
			CookieSecure = originalCookieSecure
			CookieSameSiteMode = originalCookieSameSiteMode
		})
		AppUrl = "sentinel-app-url"
		CookieSecure = true
		CookieSameSiteMode = http.SameSiteStrictMode

		err := NewCfg().ApplyAuthnSettings(ini.Empty())
		require.NoError(t, err)

		assert.Equal(t, "sentinel-app-url", AppUrl)
		assert.True(t, CookieSecure)
		assert.Equal(t, http.SameSiteStrictMode, CookieSameSiteMode)
	})

	t.Run("rejects nil settings", func(t *testing.T) {
		err := NewCfg().ApplyAuthnSettings(nil)
		assert.ErrorContains(t, err, "cannot be nil")
	})

	t.Run("identifies invalid duration settings", func(t *testing.T) {
		settings := ini.Empty()
		auth, err := settings.NewSection("auth")
		require.NoError(t, err)
		_, err = auth.NewKey("login_maximum_lifetime_duration", "not-a-duration")
		require.NoError(t, err)

		err = NewCfg().ApplyAuthnSettings(settings)
		assert.ErrorContains(t, err, "auth.login_maximum_lifetime_duration")
	})
}
