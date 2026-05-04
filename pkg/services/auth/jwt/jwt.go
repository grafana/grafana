package jwt

import (
	"context"

	"github.com/grafana/grafana/pkg/setting"
)

type JWTService interface {
	Verify(ctx context.Context, strToken string) (map[string]any, error)
	// Settings returns a snapshot of the JWT auth settings currently in effect.
	// Implementations must be safe to call concurrently with reloads.
	Settings() setting.AuthJWTSettings
}

type FakeJWTService struct {
	VerifyProvider func(context.Context, string) (map[string]any, error)
	SettingsValue  setting.AuthJWTSettings
}

func (s *FakeJWTService) Verify(ctx context.Context, token string) (map[string]any, error) {
	return s.VerifyProvider(ctx, token)
}

func (s *FakeJWTService) Settings() setting.AuthJWTSettings {
	return s.SettingsValue
}

func NewFakeJWTService() *FakeJWTService {
	return &FakeJWTService{
		VerifyProvider: func(ctx context.Context, token string) (map[string]any, error) {
			return map[string]any{}, nil
		},
	}
}
