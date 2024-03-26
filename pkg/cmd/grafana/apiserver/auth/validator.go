package auth

import (
	"context"

	"github.com/grafana/authlib/authn"
)

type CustomClaims struct {
}

type Validator struct {
	verifier authn.Verifier[CustomClaims]
}

func NewValidator(config *authn.IDVerifierConfig) *Validator {
	verifier := authn.NewVerifier[CustomClaims](authn.IDVerifierConfig{
		SigningKeysURL:   config.SigningKeysURL,
		AllowedAudiences: config.AllowedAudiences,
	})
	return &Validator{
		verifier: verifier,
	}
}

func (v *Validator) Validate(ctx context.Context, token string) (*authn.Claims[CustomClaims], error) {
	customClaims, err := v.verifier.Verify(ctx, token)
	if err != nil {
		return nil, err
	}

	return customClaims, nil
}
