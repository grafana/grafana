package auth

import (
	"context"

	"k8s.io/apiserver/pkg/authorization/authorizer"
)

var _ authorizer.Authorizer = &TokenAuthorizer{}

type TokenAuthorizer struct {
}

func NewTokenAuthorizer() *TokenAuthorizer {
	return &TokenAuthorizer{}
}

func (auth *TokenAuthorizer) Authorize(ctx context.Context, a authorizer.Attributes) (authorized authorizer.Decision, reason string, err error) {
	return authorizer.DecisionAllow, "", nil
}
