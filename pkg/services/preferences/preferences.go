package preferences

import (
	"context"

	"github.com/grafana/grafana/pkg/models"
	pstore "github.com/grafana/grafana/pkg/services/preferences/store"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/setting"
)

type Service struct {
	PreferenceStore pstore.PreferenceStore
}

func ProvideService(cfg *setting.Cfg, sqlstore sqlstore.Store) Service {
	return Service{PreferenceStore: pstore.PreferenceStore{SqlStore: sqlstore, Cfg: cfg}}
}

func (s *Service) GetPreferencesWithDefaults(ctx context.Context, query *models.GetPreferencesWithDefaultsQuery) error {
	return s.PreferenceStore.GetPreferencesWithDefaults(ctx, query)
}

func (s *Service) GetPreferences(ctx context.Context, query *models.GetPreferencesQuery) error {
	return s.PreferenceStore.GetPreferences(ctx, query)
}

func (s *Service) SavePreferences(ctx context.Context, query *models.SavePreferencesCommand) error {
	return s.PreferenceStore.SavePreferences(ctx, query)
}
