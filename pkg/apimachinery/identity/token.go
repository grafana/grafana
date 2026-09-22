package identity

import (
	"context"

	"github.com/grafana/authlib/types"
)

// TODO
// These interfaces should live in authlib

type TokenAuthenticator interface {
	// Given a token, return valid AuthInfo
	AuthenticateToken(ctx context.Context, token string) (types.AuthInfo, error)
}

// maybe???
type TokenExchange interface {
	// Using the AuthInfo in context, create a new token ready for
	ExchangeToken(ctx context.Context, req TokenExchangeRequest) (string, error)
}

type TokenExchangeRequest struct {
	Audience []string
}
