package grpc

import (
	"github.com/grafana/grafana/pkg/setting"
)

type mode string

var (
	inProcessMode mode = "inproc"
	remoteMode    mode = "remote"
)

type authSrvCfg struct {
	// mode is the authentication mode.
	// inproc: authentication is done in-process => no need to go fetch keys from a remote server.
	// remote: authentication relies on a remote server
	mode mode

	// accessTokenEnabled is a flag to enable/disable access token authentication.
	accessTokenEnabled bool

	// signingKeysURL is the URL to fetch the signing keys from.
	// This is only used in remote mode.
	// Ex: https://localhost:3000/api/signing-keys/keys
	signingKeysURL string

	// allowedAudiences is the list of allowed audiences.
	allowedAudiences []string
}

func readAuthSrvConfig(cfg *setting.Cfg) *authSrvCfg {
	section := cfg.SectionWithEnvOverrides("grpc_srv_authentication")

	return &authSrvCfg{
		signingKeysURL:     section.Key("signing_keys_url").MustString(""),
		accessTokenEnabled: section.Key("access_token_enabled").MustBool(false),
	}
}

type authClientCfg struct {
	// accessTokenEnabled is a flag to enable/disable access token authentication.
	accessTokenEnabled bool

	// token is the token to use for token exchange.
	token string

	// tokenExchangeURL is the URL to exchange the token for a temporary access-token.
	tokenExchangeURL string

	// withUser is a flag to enable/disable user information in the context.
	withUser bool
}

func readAuthClientConfig(cfg *setting.Cfg) *authClientCfg {
	section := cfg.SectionWithEnvOverrides("grpc_client_authentication")

	return &authClientCfg{
		accessTokenEnabled: section.Key("access_token_enabled").MustBool(false),
		token:              section.Key("token").MustString(""),
		tokenExchangeURL:   section.Key("token_exchange_url").MustString(""),
	}
}
