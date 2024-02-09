package auth

import (
	"context"
	"net/url"
	"time"

	auth0Jwks "github.com/auth0/go-jwt-middleware/v2/jwks"
	auth0Validator "github.com/auth0/go-jwt-middleware/v2/validator"
)

type Validator struct {
	validator *auth0Validator.Validator
	provider  *auth0Jwks.CachingProvider
}

func NewValidator() (*Validator, error) {
	issuerURI, err := url.Parse("0929f331-641d-4923-8a05-dec3e14b2e41")
	if err != nil {
		return nil, err
	}

	customURI, err := url.Parse("http://localhost:8080/v1/keys")
	if err != nil {
		return nil, err
	}
	provider := auth0Jwks.NewCachingProvider(
		issuerURI,
		time.Hour*1,
		auth0Jwks.WithCustomJWKSURI(customURI),
	)
	validator, err := auth0Validator.New(provider.KeyFunc, auth0Validator.ES256, "0929f331-641d-4923-8a05-dec3e14b2e41", []string{"stack:2846"})
	if err != nil {
		return nil, err
	}
	return &Validator{
		validator: validator,
	}, nil
}

func (v *Validator) Validate(context context.Context, token string) (interface{}, error) {
	return v.validator.ValidateToken(context, token)
}
