package strategies

import (
	"context"

	"github.com/grafana/grafana/pkg/login/social"
	"github.com/grafana/grafana/pkg/services/auth/jwt"
	"github.com/grafana/grafana/pkg/services/ssosettings"
	"github.com/grafana/grafana/pkg/setting"
)

type JWTStrategy struct {
	cfg *setting.Cfg
}

var _ ssosettings.FallbackStrategy = (*JWTStrategy)(nil)

func NewJWTStrategy(cfg *setting.Cfg) *JWTStrategy {
	return &JWTStrategy{cfg: cfg}
}

func (s *JWTStrategy) IsMatch(provider string) bool {
	return provider == social.JWTProviderName
}

func (s *JWTStrategy) GetProviderConfig(_ context.Context, _ string) (map[string]any, error) {
	return jwt.SettingsToMap(s.cfg.JWTAuth), nil
}
