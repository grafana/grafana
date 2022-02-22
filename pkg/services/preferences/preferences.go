package preferences

import (
	"context"

	"github.com/grafana/grafana/pkg/models"
	pstore "github.com/grafana/grafana/pkg/services/preferences/store"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/setting"
)

type Service interface {
	GetPreferencesWithDefaults(ctx context.Context, query *models.GetPreferencesWithDefaultsQuery) error
	GetPreferences(ctx context.Context, query *models.GetPreferencesQuery) error
	SavePreferences(ctx context.Context, query *models.SavePreferencesCommand) error
}

type Store struct {
	PreferenceStore pstore.Store
}

func ProvideService(cfg *setting.Cfg, sqlstore sqlstore.Store) Service {
	return &Store{PreferenceStore: &pstore.PreferenceStore{
		SqlStore: sqlstore, Cfg: cfg},
	}
}

func (s *Store) GetPreferencesWithDefaults(ctx context.Context, query *models.GetPreferencesWithDefaultsQuery) error {
	queryDef := &models.GetPreferencesQuery{}
	// TODO: Add GetDefaultPreferences logic
	return s.PreferenceStore.GetPreferences(ctx, queryDef)
}

func (s *Store) GetPreferences(ctx context.Context, query *models.GetPreferencesQuery) error {
	return s.PreferenceStore.GetPreferences(ctx, query)
}

func (s *Store) SavePreferences(ctx context.Context, query *models.SavePreferencesCommand) error {
	return s.PreferenceStore.SetPreferences(ctx, query)
}
