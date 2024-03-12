package idtest

import (
	"context"

	"github.com/grafana/grafana/pkg/services/auth"
)

type MockSigner struct {
	SignIDTokenFn func(ctx context.Context, claims *auth.IDClaims) (string, error)
}

func (s *MockSigner) SignIDToken(ctx context.Context, claims *auth.IDClaims) (string, error) {
	if s.SignIDTokenFn != nil {
		return s.SignIDTokenFn(ctx, claims)
	}
	return "", nil
}
