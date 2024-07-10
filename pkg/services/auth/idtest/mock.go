package idtest

import (
	"context"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/services/auth"
)

var _ auth.IDService = (*MockService)(nil)

type MockService struct {
	SignIdentityFn  func(ctx context.Context, identity identity.Requester) (string, error)
	RemoveIDTokenFn func(ctx context.Context, identity identity.Requester) error
}

func (m *MockService) SignIdentity(ctx context.Context, identity identity.Requester) (string, error) {
	if m.SignIdentityFn != nil {
		return m.SignIdentityFn(ctx, identity)
	}
	return "", nil
}

func (m *MockService) RemoveIDToken(ctx context.Context, identity identity.Requester) error {
	if m.RemoveIDTokenFn != nil {
		return m.RemoveIDTokenFn(ctx, identity)
	}
	return nil
}

type MockSigner struct {
	SignIDTokenFn func(ctx context.Context, claims *auth.IDClaims) (string, error)
}

func (s *MockSigner) SignIDToken(ctx context.Context, claims *auth.IDClaims) (string, error) {
	if s.SignIDTokenFn != nil {
		return s.SignIDTokenFn(ctx, claims)
	}
	return "", nil
}
