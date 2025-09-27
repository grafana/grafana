package strategies

import (
	"context"

	"github.com/grafana/grafana/pkg/login/social"
	"github.com/grafana/grafana/pkg/services/ssosettings"
	"github.com/grafana/grafana/pkg/setting"
)

type RADIUSStrategy struct {
	cfg *setting.Cfg
}

var _ ssosettings.FallbackStrategy = (*RADIUSStrategy)(nil)

func NewRADIUSStrategy(cfg *setting.Cfg) *RADIUSStrategy {
	return &RADIUSStrategy{
		cfg: cfg,
	}
}

func (s *RADIUSStrategy) IsMatch(provider string) bool {
	return provider == social.RADIUSProviderName
}

func (s *RADIUSStrategy) GetProviderConfig(_ context.Context, _ string) (map[string]any, error) {
	section := s.cfg.Raw.Section("auth.radius")

	result := map[string]any{
		"enabled":            section.Key("enabled").MustBool(false),
		"server":             section.Key("server").Value(),
		"port":               section.Key("port").MustInt(1812),
		"secretConfigured":   section.Key("secret").Value() != "",
		"allow_sign_up":      section.Key("allow_sign_up").MustBool(false),
		"skip_org_role_sync": section.Key("skip_org_role_sync").MustBool(false),
		"class_mappings":     section.Key("class_mappings").Value(),
	}

	return result, nil
}
