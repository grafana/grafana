package jwt

import (
	"context"
)

type JWTService interface {
	Verify(ctx context.Context, strToken string) (map[string]any, error)
}

type FakeJWTService struct {
	VerifyProvider func(context.Context, string) (map[string]any, error)
}

func (s *FakeJWTService) Verify(ctx context.Context, token string) (map[string]any, error) {
	return s.VerifyProvider(ctx, token)
}

func NewFakeJWTService() *FakeJWTService {
	return &FakeJWTService{
		VerifyProvider: func(ctx context.Context, token string) (map[string]any, error) {
			return map[string]any{}, nil
		},
	}
}
