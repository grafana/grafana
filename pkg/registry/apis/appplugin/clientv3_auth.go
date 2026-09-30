package appplugin

import (
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
// configured exchanger when there is one. Otherwise, in development mode
// (app_mode = development), for a plugin with insecure_skip_authentication =
// true in [plugin.<id>], it is a local exchanger whose tokens only a plugin
// that skips verification accepts, so local development sees the caller's
// identity. Otherwise it is nil, and requests carry no identity.
func ClientV3TokenExchanger(cfg *setting.Cfg, pluginID string, exchanger authnlib.TokenExchanger) authnlib.TokenExchanger {
	if exchanger != nil {
		return exchanger
	}
	if cfg == nil || cfg.PluginSettings[pluginID][pluginSettingInsecureSkipAuthentication] != "true" {
		return nil
	}
	if cfg.Env != setting.Dev {
		clientV3AuthLogger.Warn("Ignoring insecure_skip_authentication outside development mode; plugin requests carry no caller identity", "pluginId", pluginID)
		return nil
	}
	local, err := v3.InsecureTokenExchanger()
	if err != nil {
		clientV3AuthLogger.Error("Failed to create the local plugin token exchanger", "pluginId", pluginID, "error", err)
		return nil
	}
	clientV3AuthLogger.Warn("Plugin requests use unverifiable local tokens; use only for local development", "pluginId", pluginID)
	return local
}
