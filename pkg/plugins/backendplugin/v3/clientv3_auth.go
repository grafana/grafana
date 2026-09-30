package v3

import (
	"fmt"
	"strings"

	authnlib "github.com/grafana/authlib/authn"

	appclientv3 "github.com/grafana/grafana-app-sdk/plugin/client/v3"
	appgrpcplugin "github.com/grafana/grafana-app-sdk/plugin/grpcplugin"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/setting"
)

// NewTokenExchanger returns the exchanger that delegates callers to plugin v3
// services, from the [plugins] v3_cap_token and v3_token_exchange_url
// settings. The access policy of that token is what may call plugins on a
// caller's behalf, so it is configured separately from Grafana's other service
// credentials. Without both settings it returns nil: requests then carry no
// credentials, the caller's identity is not propagated, and plugins that
// authenticate reject them. It never sends the token itself to plugins.
func NewTokenExchanger(cfg *setting.Cfg) (authnlib.TokenExchanger, error) {
	if cfg == nil {
		return nil, nil
	}
	section := cfg.SectionWithEnvOverrides("plugins")
	token := strings.TrimSpace(section.Key("v3_cap_token").MustString(""))
	tokenExchangeURL := strings.TrimSpace(section.Key("v3_token_exchange_url").MustString(""))
	if token == "" && tokenExchangeURL == "" {
		return nil, nil
	}
	if token == "" || tokenExchangeURL == "" {
		return nil, fmt.Errorf("plugin v3 token exchange: [plugins] v3_cap_token and v3_token_exchange_url must be set together")
	}

	exchanger, err := authnlib.NewTokenExchangeClient(authnlib.TokenExchangeConfig{
		Token:            token,
		TokenExchangeURL: tokenExchangeURL,
	})
	if err != nil {
		return nil, fmt.Errorf("plugin v3 token exchange: %w", err)
	}
	return exchanger, nil
}

// WithAuthentication returns client with caller authentication for pluginID.
// Each request carries an access token exchanged for the caller, with the
// plugin ID as its audience, which the plugin accepts for every API group it
// serves. Requests made as Grafana's own service identity use Grafana's
// service token. A nil exchanger returns client unchanged.
func WithAuthentication(client appclientv3.Client, pluginID string, exchanger authnlib.TokenExchanger) (appclientv3.Client, error) {
	if exchanger == nil || client == nil {
		return client, nil
	}
	return appgrpcplugin.WithAuthentication(client, appgrpcplugin.ClientV3Options{
		TokenExchanger:    exchanger,
		PluginID:          pluginID,
		IsServiceIdentity: identity.IsServiceIdentity,
	})
}
