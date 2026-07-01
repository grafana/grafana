package strategies

import (
	"context"

	"github.com/grafana/grafana/pkg/configprovider"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/login/social"
	"github.com/grafana/grafana/pkg/services/ssosettings"
)

// ConfigProviderOAuthStrategy resolves OAuth provider settings live from the
// cloud config provider (MT-Settings) on each request, instead of the static
// boot-time *setting.Cfg used by OAuthStrategy. The config provider fetches on a
// short TTL, so updates in MT-Settings are picked up without a restart.
type ConfigProviderOAuthStrategy struct {
	cfgProvider configprovider.ConfigProvider
	logger      log.Logger
}

var _ ssosettings.FallbackStrategy = (*ConfigProviderOAuthStrategy)(nil)

func NewConfigProviderOAuthStrategy(cfgProvider configprovider.ConfigProvider) *ConfigProviderOAuthStrategy {
	return &ConfigProviderOAuthStrategy{
		cfgProvider: cfgProvider,
		logger:      log.New("ssosettings.configprovider_strategy"),
	}
}

// PoC scope: only generic_oauth, so every other provider falls through to OAuthStrategy.
func (s *ConfigProviderOAuthStrategy) IsMatch(provider string) bool {
	return provider == social.GenericOAuthProviderName
}

func (s *ConfigProviderOAuthStrategy) GetProviderConfig(ctx context.Context, provider string) (map[string]any, error) {
	cfg, err := s.cfgProvider.Get(ctx)
	if err != nil {
		return nil, err
	}

	// Reuse the exact OAuth section parsing, but against the freshly-fetched
	// (live, decrypted) cfg rather than the static boot cfg.
	live := &OAuthStrategy{cfg: cfg, settingsByProvider: make(map[string]map[string]any)}
	return live.loadSettingsForProvider(provider), nil
}
