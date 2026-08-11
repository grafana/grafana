package setting

import (
	"errors"
	"fmt"
	"net/http"
	"net/url"
	"strings"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/backend/gtime"
	"gopkg.in/ini.v1"
)

const (
	defaultLoginCookieName              = "grafana_session"
	defaultLoginMaxInactiveLifetime     = "7d"
	defaultLoginMaxLifetime             = "30d"
	defaultTokenRotationIntervalMinutes = 10
	defaultOAuthRefreshLockMinWaitMs    = int64(1000)
	defaultUserLastSeenUpdateInterval   = "15m"
)

// ApplyAuthnSettings applies the side-effect-free subset of Grafana settings
// used by the multi-tenant authn service. Raw remains available to its legacy
// encryption dependencies. The caller transfers ownership of iniFile to cfg
// and must not reuse it concurrently.
func (cfg *Cfg) ApplyAuthnSettings(iniFile *ini.File) error {
	if iniFile == nil {
		return errors.New("authn settings cannot be nil")
	}

	cfg.Raw = iniFile
	readSecretKey(iniFile, cfg)
	if err := readSessionAuthSettings(iniFile, cfg); err != nil {
		return err
	}
	readOAuthCookieMaxAge(iniFile, cfg)
	readOAuthRefreshLockSettings(iniFile, cfg)
	readCookieSecuritySettings(iniFile, cfg)
	if err := readServerURLSettings(iniFile, cfg); err != nil {
		return err
	}
	readGrafanaComSettings(iniFile, cfg)
	return readUserLastSeenUpdateInterval(iniFile, cfg)
}

func readSecretKey(iniFile *ini.File, cfg *Cfg) {
	cfg.SecretKey = valueAsString(iniFile.Section("security"), "secret_key", "")
}

func readSessionAuthSettings(iniFile *ini.File, cfg *Cfg) error {
	auth := iniFile.Section("auth")
	cfg.LoginCookieName = valueAsString(auth, "login_cookie_name", defaultLoginCookieName)

	var err error
	cfg.LoginMaxInactiveLifetime, err = gtime.ParseDuration(
		valueAsString(auth, "login_maximum_inactive_lifetime_duration", defaultLoginMaxInactiveLifetime),
	)
	if err != nil {
		return fmt.Errorf("auth.login_maximum_inactive_lifetime_duration: %w", err)
	}

	cfg.LoginMaxLifetime, err = gtime.ParseDuration(
		valueAsString(auth, "login_maximum_lifetime_duration", defaultLoginMaxLifetime),
	)
	if err != nil {
		return fmt.Errorf("auth.login_maximum_lifetime_duration: %w", err)
	}

	cfg.TokenRotationIntervalMinutes = auth.Key("token_rotation_interval_minutes").MustInt(defaultTokenRotationIntervalMinutes)
	if cfg.TokenRotationIntervalMinutes < 2 {
		cfg.TokenRotationIntervalMinutes = 2
	}
	return nil
}

func readOAuthCookieMaxAge(iniFile *ini.File, cfg *Cfg) {
	cfg.OAuthCookieMaxAge = iniFile.Section("auth").Key("oauth_state_cookie_max_age").MustInt(600)
}

func readOAuthRefreshLockSettings(iniFile *ini.File, cfg *Cfg) {
	cfg.OAuthRefreshTokenServerLockMinWaitMs = iniFile.Section("auth").Key("oauth_refresh_token_server_lock_min_wait_ms").MustInt64(defaultOAuthRefreshLockMinWaitMs)
}

func readCookieSecuritySettings(iniFile *ini.File, cfg *Cfg) {
	security := iniFile.Section("security")
	cfg.CookieSecure = security.Key("cookie_secure").MustBool(false)

	samesiteString := valueAsString(security, "cookie_samesite", "lax")
	if samesiteString == "disabled" {
		cfg.CookieSameSiteDisabled = true
	} else {
		validSameSiteValues := map[string]http.SameSite{
			"lax":    http.SameSiteLaxMode,
			"strict": http.SameSiteStrictMode,
			"none":   http.SameSiteNoneMode,
		}
		if samesite, ok := validSameSiteValues[samesiteString]; ok {
			cfg.CookieSameSiteMode = samesite
		} else {
			cfg.CookieSameSiteMode = http.SameSiteLaxMode
		}
	}
}

// readServerURLSettings sets AppURL even when the URL fails to parse, so
// callers can include the offending value in their error reporting.
func readServerURLSettings(iniFile *ini.File, cfg *Cfg) error {
	server := iniFile.Section("server")
	appURL := valueAsString(server, "root_url", "http://localhost:3000/")
	if appURL[len(appURL)-1] != '/' {
		appURL += "/"
	}
	cfg.AppURL = appURL

	parsed, err := url.Parse(appURL)
	if err != nil {
		return fmt.Errorf("server.root_url: %w", err)
	}
	cfg.AppSubURL = strings.TrimSuffix(parsed.Path, "/")
	return nil
}

func readGrafanaComSettings(iniFile *ini.File, cfg *Cfg) {
	grafanaComURL := valueAsString(iniFile.Section("grafana_net"), "url", "")
	if grafanaComURL == "" {
		grafanaComURL = valueAsString(iniFile.Section("grafana_com"), "url", "https://grafana.com")
	}
	cfg.GrafanaComURL = grafanaComURL
	cfg.GrafanaComAPIURL = valueAsString(iniFile.Section("grafana_com"), "api_url", grafanaComURL+"/api")
}

func readUserLastSeenUpdateInterval(iniFile *ini.File, cfg *Cfg) error {
	var err error
	cfg.UserLastSeenUpdateInterval, err = gtime.ParseDuration(
		valueAsString(iniFile.Section("users"), "last_seen_update_interval", defaultUserLastSeenUpdateInterval),
	)
	if err != nil {
		return fmt.Errorf("users.last_seen_update_interval: %w", err)
	}

	if cfg.UserLastSeenUpdateInterval < 5*time.Minute {
		cfg.Logger.Warn("the minimum supported value for the `last_seen_update_interval` configuration is 5m (5 minutes)")
		cfg.UserLastSeenUpdateInterval = 5 * time.Minute
	} else if cfg.UserLastSeenUpdateInterval > time.Hour {
		cfg.Logger.Warn("the maximum supported value for the `last_seen_update_interval` configuration is 1h (1 hour)")
		cfg.UserLastSeenUpdateInterval = time.Hour
	}
	return nil
}
