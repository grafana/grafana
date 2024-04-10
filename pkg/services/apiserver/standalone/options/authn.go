package options

import (
	"github.com/grafana/authlib/authn"
	"github.com/spf13/pflag"
)

type AuthnOptions struct {
	ServiceBaseURL   string
	SystemCAPToken   string
	IDVerifierConfig *authn.IDVerifierConfig
}

func NewAuthnOptions() *AuthnOptions {
	return &AuthnOptions{
		IDVerifierConfig: &authn.IDVerifierConfig{},
	}
}

func (authOpts *AuthnOptions) AddFlags(fs *pflag.FlagSet) {
	prefix := "grafana.authn"

	fs.StringVar(&authOpts.ServiceBaseURL, prefix+".service-base-url", "", "Base URL for the auth service which will be used to sign access tokens with")
	fs.StringVar(&authOpts.SystemCAPToken, prefix+".system-cap-token", "", "Token belonging to a system realm cloud access policy with which access tokens are signed")
	fs.StringVar(&authOpts.IDVerifierConfig.SigningKeysURL, prefix+".signing-keys-url", "", "URL to jwks endpoint")

	audience := fs.StringSlice(prefix+".allowed-audiences", []string{}, "Specifies a comma-separated list of allowed audiences.")
	authOpts.IDVerifierConfig.AllowedAudiences = *audience
}
