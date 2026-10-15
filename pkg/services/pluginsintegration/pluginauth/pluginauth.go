// Package pluginauth decides whether Grafana signs the access tokens between
// itself and the plugins it starts, for when no token signer is configured.
package pluginauth

import (
	"strings"

	v3 "github.com/grafana/grafana/pkg/plugins/backendplugin/v3"
	"github.com/grafana/grafana/pkg/setting"
)

// TokenExchangePath is the path, under Grafana's app URL, of the local token
// exchange that plugins call to get access tokens for Grafana's API.
const TokenExchangePath = "/api/plugin-auth/sign-access-token"

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
