package ssosettingsimpl

import (
	"context"
	"errors"

	"github.com/grafana/grafana/pkg/api/routing"
	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/login/social"
	ac "github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/auth/identity"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/ssosettings"
	"github.com/grafana/grafana/pkg/services/ssosettings/api"
	"github.com/grafana/grafana/pkg/services/ssosettings/database"
	"github.com/grafana/grafana/pkg/services/ssosettings/models"
	"github.com/grafana/grafana/pkg/services/ssosettings/strategies"
	"github.com/grafana/grafana/pkg/setting"
)

var _ ssosettings.Service = (*SSOSettingsService)(nil)

type SSOSettingsService struct {
	log          log.Logger
	cfg          *setting.Cfg
	store        ssosettings.Store
	ac           ac.AccessControl
	fbStrategies []ssosettings.FallbackStrategy
}

func ProvideService(cfg *setting.Cfg, sqlStore db.DB, ac ac.AccessControl,
	routeRegister routing.RouteRegister, features *featuremgmt.FeatureManager) *SSOSettingsService {
	strategies := []ssosettings.FallbackStrategy{
		strategies.NewOAuthStrategy(cfg),
		// register other strategies here, for example SAML
	}

	store := database.ProvideStore(sqlStore)

	svc := &SSOSettingsService{
		log:          log.New("ssosettings.service"),
		cfg:          cfg,
		store:        store,
		ac:           ac,
		fbStrategies: strategies,
	}

	if features.IsEnabledGlobally(featuremgmt.FlagSsoSettingsApi) {
		ssoSettingsApi := api.ProvideApi(svc, routeRegister, ac)
		ssoSettingsApi.RegisterAPIEndpoints()
	}

	return svc
}

var _ ssosettings.Service = (*SSOSettingsService)(nil)

func (s *SSOSettingsService) GetForProvider(ctx context.Context, provider string) (*models.SSOSettings, error) {
	storeSettings, err := s.store.Get(ctx, provider)

	if errors.Is(err, ssosettings.ErrNotFound) {
		settings, err := s.loadSettingsUsingFallbackStrategy(ctx, provider)
		if err != nil {
			return nil, err
		}

		return settings, nil
	}

	if err != nil {
		return nil, err
	}

	storeSettings.Source = models.DB

	return storeSettings, nil
}

func (s *SSOSettingsService) List(ctx context.Context, requester identity.Requester) ([]*models.SSOSettings, error) {
	result := make([]*models.SSOSettings, 0, len(ssosettings.AllOAuthProviders))
	storedSettings, err := s.store.List(ctx)

	if err != nil {
		return nil, err
	}

	for _, provider := range ssosettings.AllOAuthProviders {
		ev := ac.EvalPermission(ac.ActionSettingsRead, ac.Scope("settings", "auth."+provider, "*"))
		hasAccess, err := s.ac.Evaluate(ctx, requester, ev)
		if err != nil {
			return nil, err
		}

		if !hasAccess {
			continue
		}

		settings := getSettingsByProvider(provider, storedSettings)
		if len(settings) == 0 {
			// If there is no data in the DB then we need to load the settings using the fallback strategy
			fallbackSettings, err := s.loadSettingsUsingFallbackStrategy(ctx, provider)
			if err != nil {
				return nil, err
			}

			settings = append(settings, fallbackSettings)
		}
		result = append(result, settings...)
	}

	return result, nil
}

func (s *SSOSettingsService) Upsert(ctx context.Context, settings models.SSOSettings) error {
	// TODO: validation (configurable provider? Contains the required fields? etc)
	err := s.store.Upsert(ctx, settings)
	if err != nil {
		return err
	}
	return nil
}

func (s *SSOSettingsService) Patch(ctx context.Context, provider string, data map[string]interface{}) error {
	panic("not implemented") // TODO: Implement
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

func (s *SSOSettingsService) RegisterFallbackStrategy(providerRegex string, strategy ssosettings.FallbackStrategy) {
	s.fbStrategies = append(s.fbStrategies, strategy)
}

func (s *SSOSettingsService) loadSettingsUsingFallbackStrategy(ctx context.Context, provider string) (*models.SSOSettings, error) {
	loadStrategy, ok := s.getFallBackstrategyFor(provider)
	if !ok {
		return nil, errors.New("no fallback strategy found for provider: " + provider)
	}

	settingsFromSystem, err := loadStrategy.ParseConfigFromSystem(ctx)
	if err != nil {
		return nil, err
	}

	oAuthInfo, err := social.CreateOAuthInfoFromKeyValues(settingsFromSystem)
	if err != nil {
		return nil, err
	}

	return &models.SSOSettings{
		Provider:      provider,
		Source:        models.System,
		OAuthSettings: oAuthInfo,
	}, nil
}

func getSettingsByProvider(provider string, settings []*models.SSOSettings) []*models.SSOSettings {
	result := make([]*models.SSOSettings, 0)
	for _, item := range settings {
		if item.Provider == provider {
			result = append(result, item)
		}
	}
	return result
}

func (s *SSOSettingsService) getFallBackstrategyFor(provider string) (ssosettings.FallbackStrategy, bool) {
	for _, strategy := range s.fbStrategies {
		if strategy.IsMatch(provider) {
			return strategy, true
		}
	}
	return nil, false
}
