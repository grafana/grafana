// Package pluginauth decides whether Grafana signs the access tokens between
// itself and the plugins it starts, for when no token signer is configured.
package pluginauth

import (
	"errors"
	"fmt"
	"net"
	"net/url"
	"strconv"
	"strings"

	v3 "github.com/grafana/grafana/pkg/plugins/backendplugin/v3"
	"github.com/grafana/grafana/pkg/setting"
)

// TokenExchangePath is the path of the local token exchange that plugins call
// to get access tokens for Grafana's API. It is internal to the plugins
// Grafana starts, not a public API.
const TokenExchangePath = "/api/internal/plugin-token-exchange"

// ErrNoLocalAPIURL is returned by LocalAPIURL when no [plugins] local_api_url
// is set and none can be inferred from the listener. Plugins then get no
// credentials for Grafana's API, while Grafana still authenticates its own
// requests to them.
var ErrNoLocalAPIURL = errors.New("local plugin API: no URL reaches this Grafana process")

// LocalAPIURL resolves the plugin API endpoint. An explicit override must reach
// this Grafana process: its access policy tokens and signing key are process-local.
// Otherwise only an HTTP listener reachable on loopback can be inferred safely,
// and any other listener returns ErrNoLocalAPIURL. An invalid override returns
// another error.
func LocalAPIURL(cfg *setting.Cfg) (string, error) {
	invalid := func(reason string) (string, error) {
		return "", fmt.Errorf("local plugin API: %s; configure [plugins] local_api_url to reach this Grafana process directly", reason)
	}
	cannotInfer := func(reason string) (string, error) {
		return "", fmt.Errorf("%w: %s; configure [plugins] local_api_url to reach this Grafana process directly", ErrNoLocalAPIURL, reason)
	}
	if cfg == nil {
		return cannotInfer("missing server configuration")
	}
	var endpoint string
	if cfg.Raw != nil {
		endpoint = strings.TrimSpace(cfg.SectionWithEnvOverrides("plugins").Key("local_api_url").MustString(""))
	}
	explicit := endpoint != ""
	if !explicit {
		if cfg.Protocol != setting.HTTPScheme {
			return cannotInfer("cannot infer a loopback URL for this server protocol")
		}
		port, err := strconv.Atoi(cfg.HTTPPort)
		if err != nil || port < 1 || port > 65535 {
			return cannotInfer("automatic loopback requires a fixed [server] http_port between 1 and 65535")
		}
		host := "127.0.0.1"
		if addr := strings.Trim(cfg.HTTPAddr, "[]"); addr != "" {
			ip := net.ParseIP(addr)
			switch {
			case ip != nil && ip.IsUnspecified():
			case ip != nil && ip.IsLoopback():
				host = addr
			case addr == "localhost":
				host = addr
			default:
				return cannotInfer("the HTTP listener is not bound to loopback or all interfaces")
			}
		}
		u := url.URL{Scheme: "http", Host: net.JoinHostPort(host, cfg.HTTPPort)}
		if cfg.ServeFromSubPath {
			u.Path = strings.TrimSuffix(cfg.AppSubURL, "/")
		}
		endpoint = u.String()
	}

	u, err := url.Parse(endpoint)
	if err != nil || (u.Scheme != "http" && u.Scheme != "https") || u.Hostname() == "" || u.User != nil ||
		u.RawQuery != "" || u.ForceQuery || strings.Contains(endpoint, "#") {
		return invalid("local_api_url must be an absolute HTTP(S) URL without credentials, query, or fragment")
	}
	if port := u.Port(); port != "" || strings.HasSuffix(u.Host, ":") {
		n, err := strconv.Atoi(port)
		if err != nil || n < 1 || n > 65535 {
			return invalid("local_api_url has an invalid port")
		}
	}
	if ip := net.ParseIP(u.Hostname()); ip != nil && ip.IsUnspecified() {
		return invalid("local_api_url must identify a destination, not a wildcard listen address")
	}
	// Match ValidateHostHeader's comparison so the exchange POST cannot be redirected.
	if cfg.EnforceDomain && !strings.EqualFold(strings.SplitN(u.Host, ":", 2)[0], cfg.Domain) {
		if !explicit {
			return cannotInfer("enforce_domain would redirect requests to the loopback address")
		}
		return invalid("local_api_url host conflicts with [server] domain while enforce_domain is enabled")
	}
	return endpoint, nil
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
