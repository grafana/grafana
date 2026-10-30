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
		_, err = auth.NewKey("oauth_refresh_token_server_lock_min_wait_ms", "1250")
		require.NoError(t, err)
		_, err = auth.NewKey("oauth_refresh_token_server_lock_wait_budget_ms", "3000")
		require.NoError(t, err)
		_, err = auth.NewKey("oauth_allow_insecure_email_lookup", "true")
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

		quota, err := settings.NewSection("quota")
		require.NoError(t, err)
		_, err = quota.NewKey("enabled", "true")
		require.NoError(t, err)
		_, err = quota.NewKey("global_user", "42")
		require.NoError(t, err)
		_, err = quota.NewKey("org_user", "17")
		require.NoError(t, err)
		_, err = quota.NewKey("user_org", "3")
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
		assert.Equal(t, int64(1250), cfg.OAuthRefreshTokenServerLockMinWaitMs)
		assert.Equal(t, int64(3000), cfg.OAuthRefreshTokenServerLockWaitBudgetMs)
		assert.True(t, cfg.OAuthAllowInsecureEmailLookup)
		assert.True(t, cfg.CookieSecure)
		assert.Equal(t, http.SameSiteStrictMode, cfg.CookieSameSiteMode)
		assert.Equal(t, "http://localtest.example.com:8080/", cfg.AppURL)
		assert.Empty(t, cfg.AppSubURL)
		assert.Equal(t, "http://localhost:13001", cfg.GrafanaComURL)
		assert.True(t, cfg.Quota.Enabled)
		assert.EqualValues(t, 42, cfg.Quota.Global.User)
		assert.EqualValues(t, 17, cfg.Quota.Org.User)
		assert.EqualValues(t, 3, cfg.Quota.User.Org)
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
		assert.Equal(t, int64(1000), cfg.OAuthRefreshTokenServerLockMinWaitMs)
		assert.Equal(t, int64(5000), cfg.OAuthRefreshTokenServerLockWaitBudgetMs)
		assert.False(t, cfg.CookieSecure)
		assert.Equal(t, http.SameSiteLaxMode, cfg.CookieSameSiteMode)
		assert.Equal(t, "http://localhost:3000/", cfg.AppURL)
		assert.Equal(t, "https://grafana.com", cfg.GrafanaComURL)
		assert.False(t, cfg.Quota.Enabled)
		assert.EqualValues(t, -1, cfg.Quota.Global.User)
		assert.EqualValues(t, 10, cfg.Quota.Org.User)
		assert.EqualValues(t, 10, cfg.Quota.User.Org)
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
