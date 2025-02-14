package tokensigning

import (
	authlib "github.com/grafana/authlib/authn"
	sdkhttpclient "github.com/grafana/grafana-plugin-sdk-go/backend/httpclient"
	"github.com/grafana/grafana/pkg/setting"
)

func ProvideAccessTokenSigner(cfg *setting.Cfg, clientProvider sdkhttpclient.Provider) (*authlib.TokenExchangeClient, error) {
	client, err := clientProvider.New()
	if err != nil {
		return nil, err
	}

	if len(cfg.UnistorServerCAPToken) > 0 && len(cfg.UnistorServerCAPTokenExchangeURL) > 0 {
		return authlib.NewTokenExchangeClient(authlib.TokenExchangeConfig{
			Token:            cfg.UnistorServerCAPToken,
			TokenExchangeURL: cfg.UnistorServerCAPTokenExchangeURL,
		}, authlib.WithHTTPClient(client))
	}

	// TODO - remove the nil error, it is temporary until unistor's config is updated all the way up to prod
	return nil, nil
}
