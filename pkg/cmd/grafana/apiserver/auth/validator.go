package auth

import (
	"context"

	"github.com/grafana/authlib/authn"
)

type CustomClaims struct {
	OrgId string `json:"org_id"`
}

type TokenValidator struct {
	verifier authn.Verifier[CustomClaims]
}

func (v *TokenValidator) Validate(ctx context.Context, token string) (*authn.Claims[CustomClaims], error) {
	customClaims, err := v.verifier.Verify(ctx, token)
	if err != nil {
		return nil, err
	}

	return customClaims, nil
}
