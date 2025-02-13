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

type Service struct {
	exchanger authlib.TokenExchanger
}

func ProvideAccessTokenSigner(settings setting.Provider, clientProvider sdkhttpclient.Provider) (*Service, error) {
	signer := &Service{}
	cfg := readSettings(settings)

	client, err := clientProvider.New()
	if err != nil {
		return nil, err
	}

	exchanger, err := authlib.NewTokenExchangeClient(*cfg, authlib.WithHTTPClient(client))
	if err != nil {
		return nil, err
	}

	signer.exchanger = exchanger
	return signer, nil
}

func readSettings(settingsProvider setting.Provider) *authlib.TokenExchangeConfig {
	section := settingsProvider.Section(configSection)
	return &authlib.TokenExchangeConfig{
		Token:            section.KeyValue(configKeyToken).MustString(""),
		TokenExchangeURL: section.KeyValue(configKeyURL).MustString(""),
	}
}
