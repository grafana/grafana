package ssosettingsimpl

import (
	"context"
	"errors"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/ssosettings"
	"github.com/grafana/grafana/pkg/setting"
)

type SSOSettingsService struct {
	log   log.Logger
	cfg   *setting.Cfg
	store ssosettings.Store
}

func ProvideService(cfg *setting.Cfg, store ssosettings.Store) *SSOSettingsService {
	return &SSOSettingsService{
		log:   log.New("ssosettings.service"),
		cfg:   cfg,
		store: store,
	}
}

var _ ssosettings.Service = (*SSOSettingsService)(nil)

func (s *SSOSettingsService) GetAuthSettingsForProvider(ctx context.Context, provider string, strategy ssosettings.FallbackStrategy) (map[string]interface{}, error) {
	dto, err := s.store.Get(ctx, provider)
	if errors.Is(err, ssosettings.ErrNotFound) {
		return strategy.ParseConfigFromSystem(ctx)
	}

	if err != nil {
		return nil, err
	}

	return dto.Settings, nil
}

func (s *SSOSettingsService) Update(ctx context.Context, provider string, data map[string]interface{}) error {
	panic("not implemented") // TODO: Implement
}

func (s *SSOSettingsService) Reload(ctx context.Context, provider string) {
	panic("not implemented") // TODO: Implement
}

func (s *SSOSettingsService) RegisterReloadable(ctx context.Context, provider string, reloadable ssosettings.Reloadable) {
	panic("not implemented") // TODO: Implement
}
