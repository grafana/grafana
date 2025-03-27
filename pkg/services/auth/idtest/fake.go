package idtest

import (
	"context"

	authnlib "github.com/grafana/authlib/authn"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/services/auth"
)

var _ auth.IDService = (*FakeService)(nil)

type FakeService struct {
	SignIdentityFn  func(ctx context.Context, identity identity.Requester) (string, *authnlib.Claims[authnlib.IDTokenClaims], error)
	RemoveIDTokenFn func(ctx context.Context, identity identity.Requester) error
}

func (m *FakeService) SignIdentity(ctx context.Context, identity identity.Requester) (string, *authnlib.Claims[authnlib.IDTokenClaims], error) {
	if m.SignIdentityFn != nil {
		return m.SignIdentityFn(ctx, identity)
	}
	return "", nil, nil
}

func (m *FakeService) RemoveIDToken(ctx context.Context, identity identity.Requester) error {
	if m.RemoveIDTokenFn != nil {
		return m.RemoveIDTokenFn(ctx, identity)
	}
	return nil
}

type FakeSigner struct {
	SignIDTokenFn func(ctx context.Context, claims *auth.IDClaims) (string, error)
}

func (s *FakeSigner) SignIDToken(ctx context.Context, claims *auth.IDClaims) (string, error) {
	if s.SignIDTokenFn != nil {
		return s.SignIDTokenFn(ctx, claims)
	}
	return "", nil
}
