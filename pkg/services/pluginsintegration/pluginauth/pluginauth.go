// Package pluginauth decides, once at startup, whether Grafana signs the
// access tokens between itself and the plugins it starts, for when no token
// signer is configured. Every consumer reads the decision from Config.
package pluginauth

import (
	"context"
	"errors"
	"fmt"
	"net"
	"net/url"
	"slices"
	"strconv"
	"strings"

	"github.com/open-feature/go-sdk/openfeature"

	"github.com/grafana/grafana/pkg/infra/log"
	v3 "github.com/grafana/grafana/pkg/plugins/backendplugin/v3"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/setting"
)

// TokenExchangePath is the path of the local token exchange that plugins call
// to get access tokens for Grafana's API. It is internal to the plugins
// Grafana starts, not a public API.
const TokenExchangePath = "/api/internal/plugin-token-exchange"

// grafanaAudience is the audience app plugins request for Grafana's API.
const grafanaAudience = "grafana"

// Config is how Grafana authenticates the plugins it starts when no token signer
// is configured.
type Config struct {
	// Enabled is set when Grafana signs plugin access tokens itself (see
	// v3.LocalTokenExchanger and v3.SignLocalAccessToken).
	Enabled bool
	// APIURL is where app plugins reach this Grafana process for its API and the
	// token exchange. It is "" when they get no credentials for Grafana's API.
	APIURL string
	// LoopbackOnly is set when APIURL is a loopback address, so the token
	// exchange refuses callers that are not on loopback.
	LoopbackOnly bool
}

// LocalTokens reports whether Grafana signs plugin access tokens itself. A nil
// Config does not.
func (c *Config) LocalTokens() bool {
	return c != nil && c.Enabled
}

// LocalAPIURL returns where app plugins reach this Grafana process, or "" when
// they get no credentials for Grafana's API.
func (c *Config) LocalAPIURL() string {
	if c == nil {
		return ""
	}
	return c.APIURL
}

// ProvideConfig makes the decision from cfg. An invalid [plugins]
// local_api_url is an error. A URL that cannot be inferred is logged, and
// leaves plugins without API credentials while Grafana still authenticates its
// own requests to them.
func ProvideConfig(cfg *setting.Cfg) (*Config, error) {
	c := &Config{Enabled: localPluginAuthEnabled(cfg)}
	if !c.Enabled {
		return c, nil
	}
	apiURL, err := localAPIURL(cfg)
	switch {
	case errors.Is(err, errNoLocalAPIURL):
		log.New("plugins.auth").Warn("App plugins get no credentials for Grafana's API", "error", err)
		return c, nil
	case err != nil:
		return nil, err
	}
	u, _ := url.Parse(apiURL) // localAPIURL has validated it.
	c.APIURL = apiURL
	c.LoopbackOnly = isLoopbackHost(u.Hostname())
	return c, nil
}

// errNoLocalAPIURL is returned by localAPIURL when no [plugins] local_api_url
// is set and none can be inferred from the listener.
var errNoLocalAPIURL = errors.New("local plugin API: no URL reaches this Grafana process")

// TODO: deprecate [plugins] local_api_url, and give plugins and in-process apps
// the same GF_API_ACCESS_ROUTER_URL an app SDK client reads, as their only
// way to find Grafana's API.

// localAPIURL resolves the plugin API endpoint. An explicit override must reach
// this Grafana process: its access policy tokens and signing key are process-local.
// Otherwise only an HTTP listener reachable on loopback can be inferred safely,
// and any other listener returns errNoLocalAPIURL. An invalid override returns
// another error.
func localAPIURL(cfg *setting.Cfg) (string, error) {
	if cfg == nil {
		return "", cannotInferLocalAPIURL("missing server configuration")
	}
	// The app SDK requests this audience for every call to Grafana's API, and
	// the exchange only grants the audiences Grafana accepts.
	if !slices.Contains(cfg.ExtJWTAuth.Audiences, grafanaAudience) {
		return "", fmt.Errorf("%w: [auth.extended_jwt] audiences must include %q for plugins to call Grafana's API", errNoLocalAPIURL, grafanaAudience)
	}
	var endpoint string
	if cfg.Raw != nil {
		endpoint = strings.TrimSpace(cfg.SectionWithEnvOverrides("plugins").Key("local_api_url").MustString(""))
	}
	explicit := endpoint != ""
	if !explicit {
		var err error
		if endpoint, err = inferLocalAPIURL(cfg); err != nil {
			return "", err
		}
	}
	if err := validateLocalAPIURL(cfg, endpoint, explicit); err != nil {
		return "", err
	}
	return endpoint, nil
}

func invalidLocalAPIURL(reason string) error {
	return fmt.Errorf("local plugin API: %s; configure [plugins] local_api_url to reach this Grafana process directly", reason)
}

func cannotInferLocalAPIURL(reason string) error {
	return fmt.Errorf("%w: %s; configure [plugins] local_api_url to reach this Grafana process directly", errNoLocalAPIURL, reason)
}

// inferLocalAPIURL derives a loopback URL from a plain HTTP listener on a
// fixed port, bound to all interfaces or to loopback.
func inferLocalAPIURL(cfg *setting.Cfg) (string, error) {
	if cfg.Protocol != setting.HTTPScheme {
		return "", cannotInferLocalAPIURL("cannot infer a loopback URL for this server protocol")
	}
	port, err := strconv.Atoi(cfg.HTTPPort)
	if err != nil || port < 1 || port > 65535 {
		return "", cannotInferLocalAPIURL("automatic loopback requires a fixed [server] http_port between 1 and 65535")
	}
	host := "127.0.0.1"
	if addr := strings.Trim(cfg.HTTPAddr, "[]"); addr != "" {
		switch {
		case net.ParseIP(addr).IsUnspecified():
		case isLoopbackHost(addr):
			host = addr
		default:
			return "", cannotInferLocalAPIURL("the HTTP listener is not bound to loopback or all interfaces")
		}
	}
	u := url.URL{Scheme: "http", Host: net.JoinHostPort(host, cfg.HTTPPort)}
	if cfg.ServeFromSubPath {
		u.Path = strings.TrimSuffix(cfg.AppSubURL, "/")
	}
	return u.String(), nil
}

// isLoopbackHost reports whether host, an IP address or host name without a
// port, names this machine's loopback interface.
func isLoopbackHost(host string) bool {
	return strings.EqualFold(host, "localhost") || net.ParseIP(host).IsLoopback()
}

// validateLocalAPIURL checks that endpoint can name this process. An inferred
// endpoint that enforce_domain would redirect returns errNoLocalAPIURL.
func validateLocalAPIURL(cfg *setting.Cfg, endpoint string, explicit bool) error {
	u, err := url.Parse(endpoint)
	if err != nil || (u.Scheme != "http" && u.Scheme != "https") || u.Hostname() == "" || u.User != nil ||
		u.RawQuery != "" || u.ForceQuery || strings.Contains(endpoint, "#") {
		return invalidLocalAPIURL("local_api_url must be an absolute HTTP(S) URL without credentials, query, or fragment")
	}
	if port := u.Port(); port != "" || strings.HasSuffix(u.Host, ":") {
		n, err := strconv.Atoi(port)
		if err != nil || n < 1 || n > 65535 {
			return invalidLocalAPIURL("local_api_url has an invalid port")
		}
	}
	if ip := net.ParseIP(u.Hostname()); ip != nil && ip.IsUnspecified() {
		return invalidLocalAPIURL("local_api_url must identify a destination, not a wildcard listen address")
	}
	// Match ValidateHostHeader's comparison so the exchange POST cannot be redirected.
	if cfg.EnforceDomain && !strings.EqualFold(strings.SplitN(u.Host, ":", 2)[0], cfg.Domain) {
		if !explicit {
			return cannotInferLocalAPIURL("enforce_domain would redirect requests to the loopback address")
		}
		return invalidLocalAPIURL("local_api_url host conflicts with [server] domain while enforce_domain is enabled")
	}
	return nil
}

// localPluginAuthEnabled reports whether Grafana signs plugin access tokens
// itself (see v3.LocalTokenExchanger and v3.SignLocalAccessToken): the
// appplugins.loadAppManifest feature toggle is enabled, [plugins]
// enable_local_plugin_auth is not false, neither v3_cap_token nor
// v3_token_exchange_url is set, and no real signing keys are configured (see
// v3.RealSigningKeysConfigured). With only one of the exchange settings, the
// exchange is misconfigured and no tokens are signed at all.
func localPluginAuthEnabled(cfg *setting.Cfg) bool {
	if cfg == nil {
		return false
	}
	// The local access policy comes from the plugin's app manifest.
	// NOTE: When this check is removed, we need to make a loud announcement in the release notes
	if !appManifestsEnabled() {
		return false
	}
	if cfg.Raw != nil {
		section := cfg.SectionWithEnvOverrides("plugins")
		// An explicit opt-out, for installs that don't want plugins to get
		// credentials or Grafana to trust a key held in memory.
		if !section.Key("enable_local_plugin_auth").MustBool(true) {
			return false
		}
		// Explicitly configured CAP token used to make requests into plugins
		if strings.TrimSpace(section.Key("v3_cap_token").MustString("")) != "" ||
			strings.TrimSpace(section.Key("v3_token_exchange_url").MustString("")) != "" {
			return false
		}
	}
	return !v3.RealSigningKeysConfigured(cfg.ExtJWTAuth.JWKSUrl)
}

func appManifestsEnabled() bool {
	ctx := context.Background()
	return openfeature.NewDefaultClient().Boolean(ctx, featuremgmt.FlagApppluginsLoadAppManifest, false, openfeature.TransactionContext(ctx))
}
