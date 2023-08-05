package jwt

import (
	"context"
)

type JWTClaims map[string]interface{}

type JWTService interface {
	Verify(ctx context.Context, strToken string) (JWTClaims, error)
}

type FakeJWTService struct {
	VerifyProvider func(context.Context, string) (JWTClaims, error)
}

func (s *FakeJWTService) Verify(ctx context.Context, token string) (JWTClaims, error) {
	return s.VerifyProvider(ctx, token)
}

func NewFakeJWTService() *FakeJWTService {
	return &FakeJWTService{
		VerifyProvider: func(ctx context.Context, token string) (JWTClaims, error) {
			return JWTClaims{}, nil
		},
	}
}
