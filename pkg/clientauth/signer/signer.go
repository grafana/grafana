package signer

import (
	"fmt"

	authlib "github.com/grafana/authlib/authn"

	"github.com/grafana/grafana/pkg/setting"
)

type signerSettings struct {
	token            string
	tokenExchangeURL string
}

func ProvideAccessTokenSigner(cfg *setting.Cfg) (authlib.TokenExchanger, error) {
	if cfg.StackID == "" {
		// for non-cloud use-case, return a noop signer
		return authlib.NewStaticTokenExchanger("noop-signer"), nil
	}

	clientCfg, err := readSignerSettings(cfg)
	if err != nil {
		return nil, err
	}

	return authlib.NewTokenExchangeClient(authlib.TokenExchangeConfig{
		Token:            clientCfg.token,
		TokenExchangeURL: clientCfg.tokenExchangeURL,
	})
}

func readSignerSettings(cfg *setting.Cfg) (*signerSettings, error) {
	grpcClientAuthSection := cfg.SectionWithEnvOverrides("grpc_client_authentication")

	s := &signerSettings{}

	s.token = grpcClientAuthSection.Key("token").MustString("")
	s.tokenExchangeURL = grpcClientAuthSection.Key("token_exchange_url").MustString("")

	// When running in cloud mode, the token and tokenExchangeURL are required.
	if s.token == "" || s.tokenExchangeURL == "" {
		return nil, fmt.Errorf("authorization:  missing token or tokenExchangeUrl")
	}

	return s, nil
}
