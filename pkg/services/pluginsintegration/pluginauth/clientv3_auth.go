package pluginauth

import (
	"context"
	"fmt"
	"strings"

	authnlib "github.com/grafana/authlib/authn"

	"github.com/grafana/grafana/pkg/infra/log"
	v3 "github.com/grafana/grafana/pkg/plugins/backendplugin/v3"
	"github.com/grafana/grafana/pkg/setting"
)

// pluginSettingInsecureSkipAuthentication is the [plugin.<id>] setting for
// plugins that do not verify requests. Grafana also passes it to the plugin,
// as GF_PLUGIN_INSECURE_SKIP_AUTHENTICATION.
const pluginSettingInsecureSkipAuthentication = "insecure_skip_authentication"

var clientV3AuthLogger = log.New("plugins.v3.auth")

// NewClientV3TokenExchanger returns the exchanger that delegates callers to
// plugin v3 services, from the [plugins] v3_cap_token and
// v3_token_exchange_url settings (see v3.NewTokenExchanger). It is configured
// separately from Grafana's other service credentials, and is nil without them.
func NewClientV3TokenExchanger(cfg *setting.Cfg) (authnlib.TokenExchanger, error) {
	if cfg == nil {
		return nil, nil
	}
	section := cfg.SectionWithEnvOverrides("plugins")
	return v3.NewTokenExchanger(
		strings.TrimSpace(section.Key("v3_cap_token").MustString("")),
		strings.TrimSpace(section.Key("v3_token_exchange_url").MustString("")),
	)
}

// ClientV3TokenExchanger returns the exchanger for requests to pluginID: the
// configured exchanger when there is one. Otherwise, unless real signing keys
// are configured (see v3.RealSigningKeysConfigured), it is the local exchanger,
// whose tokens verify with the keys Grafana passes to the plugin processes it
// starts (see v3.LocalSigningKeys). Plugins started elsewhere reject them.
// Otherwise it is nil, and requests carry no identity.
func ClientV3TokenExchanger(cfg *setting.Cfg, pluginAuth *Config, pluginID string, exchanger authnlib.TokenExchanger) authnlib.TokenExchanger {
	if exchanger != nil {
		insecure := cfg != nil && cfg.PluginSettings[pluginID][pluginSettingInsecureSkipAuthentication] == "true"
		if insecure && cfg.Env == setting.Dev {
			clientV3AuthLogger.Warn("Plugin does not verify requests (insecure_skip_authentication); use only for local development", "pluginId", pluginID)
		}
		return exchanger
	}
	if !pluginAuth.LocalTokens() {
		if cfg == nil || v3.RealSigningKeysConfigured(cfg.ExtJWTAuth.JWKSUrl) {
			return nil
		}
		// Plugins get no keys to verify local tokens, so send them only to a
		// plugin that skips verification in development, as before local signing.
		insecure := cfg.PluginSettings[pluginID][pluginSettingInsecureSkipAuthentication] == "true"
		if !insecure || cfg.Env != setting.Dev {
			return nil
		}
		clientV3AuthLogger.Warn("Plugin requests use unverifiable local tokens; use only for local development", "pluginId", pluginID)
	}
	local, err := v3.LocalTokenExchanger()
	if err != nil {
		clientV3AuthLogger.Error("Failed to create the local plugin token exchanger", "pluginId", pluginID, "error", err)
		return nil
	}
	return local
}

// InvalidClientV3TokenExchanger returns an exchanger that fails every exchange
// with err, for an invalid exchange configuration. Requests to plugins then
// fail with the configuration error, rather than being sent without a caller
// identity or with local tokens.
func InvalidClientV3TokenExchanger(err error) authnlib.TokenExchanger {
	return invalidTokenExchanger{err: err}
}

type invalidTokenExchanger struct{ err error }

func (e invalidTokenExchanger) Exchange(context.Context, authnlib.TokenExchangeRequest) (*authnlib.TokenExchangeResponse, error) {
	return nil, fmt.Errorf("plugin v3 token exchange is misconfigured: %w", e.err)
}
