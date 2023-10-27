package ssosettingsimpl

import (
	"context"
	"errors"

	"github.com/grafana/grafana/pkg/infra/log"
	ac "github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/auth/identity"
	"github.com/grafana/grafana/pkg/services/ssosettings"
	"github.com/grafana/grafana/pkg/services/ssosettings/models"
	"github.com/grafana/grafana/pkg/setting"
)

var (
	grafanaCom = "grafana_com"
	allOauthes = []string{"github", "gitlab", "google", "generic_oauth", "grafananet", grafanaCom, "azuread", "okta"}
)

type SSOSettingsService struct {
	log   log.Logger
	cfg   *setting.Cfg
	store ssosettings.Store
	ac    ac.AccessControl
}

func ProvideService(cfg *setting.Cfg, store ssosettings.Store, ac ac.AccessControl) *SSOSettingsService {
	return &SSOSettingsService{
		log:   log.New("ssosettings.service"),
		cfg:   cfg,
		store: store,
		ac:    ac,
	}
}

var _ ssosettings.Service = (*SSOSettingsService)(nil)

func (s *SSOSettingsService) GetForProvider(ctx context.Context, provider string, strategy ssosettings.FallbackStrategy) (*models.SSOSetting, error) {
	dto, err := s.store.Get(ctx, provider)

	if errors.Is(err, ssosettings.ErrNotFound) {
		fallbackConfig, err := strategy.ParseConfigFromSystem(ctx)
		if err != nil {
			return nil, err
		}

		return &models.SSOSetting{
			Settings: fallbackConfig,
			Provider: provider,
			Source:   models.System,
		}, nil
	}

	if err != nil {
		return nil, err
	}

	dto.Source = models.DB

	return dto, nil
}

func (s *SSOSettingsService) GetAll(ctx context.Context, requester identity.Requester) ([]*models.SSOSetting, error) {
	panic("not implemented") // TODO: Implement

	// for _, provider := range allOauthes {
	// 	ev := ac.EvalPermission(ac.ActionSettingsRead, ac.Scope("settings", fmt.Sprintf("auth.%s", provider)))
	// 	if hasAccess, _ := s.ac.Evaluate(ctx, requester, ev); !hasAccess{
	// 		continue
	// 	}
	// }
}

func (s *SSOSettingsService) Upsert(ctx context.Context, provider string, data map[string]interface{}) error {
	// Validate first

	// Update
	err := s.store.Upsert(ctx, provider, data)
	if err != nil {
		return err
	}
	return nil
}

func (s *SSOSettingsService) Delete(ctx context.Context, provider string) error {
	return s.store.Delete(ctx, provider)
}

func (s *SSOSettingsService) Reload(ctx context.Context, provider string) {
	panic("not implemented") // TODO: Implement
}

func (s *SSOSettingsService) RegisterReloadable(ctx context.Context, provider string, reloadable ssosettings.Reloadable) {
	panic("not implemented") // TODO: Implement
}
