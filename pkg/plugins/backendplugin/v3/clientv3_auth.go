package v3

import (
	"errors"
	"fmt"

	authnlib "github.com/grafana/authlib/authn"

	appclientv3 "github.com/grafana/grafana-app-sdk/plugin/client/v3"
	appgrpcplugin "github.com/grafana/grafana-app-sdk/plugin/grpcplugin"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
)

// NewTokenExchanger returns the exchanger that delegates callers to plugin v3
// services, using the access policy token at the token exchange URL. That
// policy is what may call plugins on a caller's behalf. Without both values it
// returns nil: requests then carry no credentials, the caller's identity is
// not propagated, and plugins that authenticate reject them. It never sends
// the token itself to plugins.
func NewTokenExchanger(token, tokenExchangeURL string) (authnlib.TokenExchanger, error) {
	if token == "" && tokenExchangeURL == "" {
		return nil, nil
	}
	if token == "" || tokenExchangeURL == "" {
		return nil, errors.New("plugin v3 token exchange: the access policy token and token exchange URL must be set together")
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
