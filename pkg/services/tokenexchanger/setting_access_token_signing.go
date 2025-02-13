package tokenexchanger

import (
	authlib "github.com/grafana/authlib/authn"
	sdkhttpclient "github.com/grafana/grafana-plugin-sdk-go/backend/httpclient"
	"github.com/grafana/grafana/pkg/setting"
)

const (
	configSection  = "access_token_signing"
	configKeyURL   = "exchange_url"
	configKeyToken = "token"
)

// This service purely exists for centralizing the exchange config reading from grafana.ini
type Service struct {
	Exchanger authlib.TokenExchanger
}

func ProvideAccessTokenSigner(settings setting.Provider, clientProvider sdkhttpclient.Provider) (*Service, error) {
	signer := &Service{}
	cfg := readSettings(settings)

	client, err := clientProvider.New()
	if err != nil {
		return nil, err
	}

	if len(cfg.Token) > 0 && len(cfg.TokenExchangeURL) > 0 {
		exchanger, err := authlib.NewTokenExchangeClient(*cfg, authlib.WithHTTPClient(client))
		if err != nil {
			return nil, err
		}
		signer.Exchanger = exchanger
	}

	return signer, nil
}

func readSettings(settingsProvider setting.Provider) *authlib.TokenExchangeConfig {
	section := settingsProvider.Section(configSection)
	return &authlib.TokenExchangeConfig{
		Token:            section.KeyValue(configKeyToken).MustString(""),
		TokenExchangeURL: section.KeyValue(configKeyURL).MustString(""),
	}
}
