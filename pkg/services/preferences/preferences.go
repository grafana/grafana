package preferences

import (
	"context"

	"github.com/grafana/grafana/pkg/models"
	pstore "github.com/grafana/grafana/pkg/services/preferences/store"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/setting"
)

type Service interface {
	GetPreferencesWithDefaults(ctx context.Context, query *models.GetPreferencesWithDefaultsQuery) (*models.Preferences, error)
	GetPreferences(ctx context.Context, query *models.GetPreferencesQuery) (*models.Preferences, error)
	SavePreferences(ctx context.Context, query *models.SavePreferencesCommand) error
}

type ServiceImpl struct {
	PreferenceStore pstore.Store
}

func ProvideService(cfg *setting.Cfg, sqlstore sqlstore.Store) Service {
	return &ServiceImpl{PreferenceStore: &pstore.StoreImpl{
		SqlStore: sqlstore, Cfg: cfg},
	}
}

func (s *ServiceImpl) GetPreferencesWithDefaults(ctx context.Context, query *models.GetPreferencesWithDefaultsQuery) (*models.Preferences, error) {
	// TODO: Add GetDefaultPreferences logic
	return s.PreferenceStore.GetPreferencesWithDefaults(ctx, query)
}

func (s *ServiceImpl) GetPreferences(ctx context.Context, query *models.GetPreferencesQuery) (*models.Preferences, error) {
	return s.PreferenceStore.GetPreferences(ctx, query)
}

func (s *ServiceImpl) SavePreferences(ctx context.Context, query *models.SavePreferencesCommand) error {
	return s.PreferenceStore.SavePreferences(ctx, query)
}
