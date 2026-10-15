// Package pluginauth decides whether Grafana signs the access tokens between
// itself and the plugins it starts, for when no token signer is configured.
package pluginauth

import (
	"net"
	"net/url"
	"strings"

	v3 "github.com/grafana/grafana/pkg/plugins/backendplugin/v3"
	"github.com/grafana/grafana/pkg/setting"
)

// TokenExchangePath is the path of the local token exchange that plugins call
// to get access tokens for Grafana's API. It is internal to the plugins
// Grafana starts, not a public API.
const TokenExchangePath = "/api/internal/plugin-token-exchange"

// LocalAPIURL returns the URL at which the plugins Grafana starts reach this
// Grafana process directly, on loopback, rather than through the app URL. Local
// access policy tokens and signing keys belong to one process, so behind a
// load balancer the app URL could reach another one.
//
// It is only set for a plain HTTP listener on all interfaces or on loopback:
// an HTTPS certificate does not cover the loopback address, and a socket or a
// listener on another address has none. Otherwise it is "", and plugins use
// the app URL.
func LocalAPIURL(cfg *setting.Cfg) string {
	if cfg == nil || cfg.Protocol != setting.HTTPScheme || cfg.HTTPPort == "" || cfg.HTTPPort == "0" {
		return ""
	}
	host := "127.0.0.1"
	if addr := cfg.HTTPAddr; addr != "" {
		ip := net.ParseIP(addr)
		switch {
		case ip != nil && ip.IsUnspecified():
		case ip != nil && ip.IsLoopback():
			host = addr
		case addr == "localhost":
			host = addr
		default:
			return ""
		}
	}
	u := url.URL{Scheme: "http", Host: net.JoinHostPort(host, cfg.HTTPPort)}
	if cfg.ServeFromSubPath {
		u.Path = strings.TrimSuffix(cfg.AppSubURL, "/")
	}
	return u.String()
}

// LocalTokens reports whether Grafana signs plugin access tokens itself (see
// v3.LocalTokenExchanger and v3.SignLocalAccessToken): neither [plugins]
// v3_cap_token nor v3_token_exchange_url is set, and no real signing keys are
// configured (see v3.RealSigningKeysConfigured). With only one of the exchange
// settings, the exchange is misconfigured and no tokens are signed at all.
func LocalTokens(cfg *setting.Cfg) bool {
	if cfg == nil {
		return false
	}
	if cfg.Raw != nil {
		section := cfg.SectionWithEnvOverrides("plugins")
		if strings.TrimSpace(section.Key("v3_cap_token").MustString("")) != "" ||
			strings.TrimSpace(section.Key("v3_token_exchange_url").MustString("")) != "" {
			return false
		}
	}
	return !v3.RealSigningKeysConfigured(cfg.ExtJWTAuth.JWKSUrl)
}
