package auth

import (
	"context"
	"errors"
	"net/http"

	jwtmiddleware "github.com/auth0/go-jwt-middleware/v2"
	"github.com/auth0/go-jwt-middleware/v2/validator"
	"k8s.io/apiserver/pkg/authentication/authenticator"
)

var _ authenticator.Request = &TokenAuthenticator{}

type AuthenticatedUser struct {
	name   string
	uid    string
	groups []string
}

func newAuthenticatedUser(claims *validator.RegisteredClaims) *AuthenticatedUser {
	return &AuthenticatedUser{
		name:   claims.Subject,
		uid:    "",
		groups: []string{},
	}
}

func (user *AuthenticatedUser) GetName() string {
	return user.name
}

func (user *AuthenticatedUser) GetUID() string {
	return user.uid
}

func (user *AuthenticatedUser) GetGroups() []string {
	return user.groups
}

func (user *AuthenticatedUser) GetExtra() map[string][]string {
	return make(map[string][]string, 0)
}

type TokenAuthenticator struct {
	validator *Validator
}

func NewTokenAuthenticator(validator *Validator) *TokenAuthenticator {
	return &TokenAuthenticator{
		validator,
	}
}

func (auth *TokenAuthenticator) AuthenticateRequest(req *http.Request) (*authenticator.Response, bool, error) {
	token, err := jwtmiddleware.AuthHeaderTokenExtractor(req)
	if err != nil {
		return nil, false, errors.New("Could not read bearer token from the authorization header")
	}

	result, err := auth.validator.Validate(context.Background(), token)
	if err != nil {
		return nil, false, err
	}

	claims, ok := result.(*validator.ValidatedClaims)
	if !ok {
		return nil, false, errors.New("Could not assert claims to be validator.ValidatedClaims")
	}
	if err != nil {
		return nil, false, err
	}
	return &authenticator.Response{
		Audiences: claims.RegisteredClaims.Audience,
		User:      newAuthenticatedUser(&claims.RegisteredClaims),
	}, true, nil
}
