package options

import "github.com/grafana/authlib/authn"

func NewAuthnOptions() *AuthnOptions {
	return &AuthnOptions{
		IDVerifierConfig: &authn.IDVerifierConfig{},
	}
}
