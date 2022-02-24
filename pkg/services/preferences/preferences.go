package preferences

import (
	"context"
	"strings"

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
	params := make([]interface{}, 0)
	filter := ""

	if len(query.User.Teams) > 0 {
		filter = "(org_id=? AND team_id IN (?" + strings.Repeat(",?", len(query.User.Teams)-1) + ")) OR "
		params = append(params, query.User.OrgId)
		for _, v := range query.User.Teams {
			params = append(params, v)
		}
	}

	filter += "(org_id=? AND user_id=? AND team_id=0) OR (org_id=? AND team_id=0 AND user_id=0)"
	params = append(params, query.User.OrgId)
	params = append(params, query.User.UserId)
	params = append(params, query.User.OrgId)

	prefs, err := s.PreferenceStore.List(ctx, filter, params)
	if err != nil {
		return nil, err
	}

	res := s.PreferenceStore.GetDefaults()
	for _, p := range prefs {
		if p.Theme != "" {
			res.Theme = p.Theme
		}
		if p.Timezone != "" {
			res.Timezone = p.Timezone
		}
		if p.WeekStart != "" {
			res.WeekStart = p.WeekStart
		}
		if p.HomeDashboardId != 0 {
			res.HomeDashboardId = p.HomeDashboardId
		}
	}

	return res, err
}

func (s *ServiceImpl) GetPreferences(ctx context.Context, query *models.GetPreferencesQuery) (*models.Preferences, error) {
	return s.PreferenceStore.Get(ctx, query)
}

func (s *ServiceImpl) SavePreferences(ctx context.Context, query *models.SavePreferencesCommand) error {
	return s.PreferenceStore.Set(ctx, query)
}
