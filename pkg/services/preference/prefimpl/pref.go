package prefimpl

import (
	"context"

	pref "github.com/grafana/grafana/pkg/services/preference"
	"github.com/grafana/grafana/pkg/services/sqlstore/db"
	"github.com/grafana/grafana/pkg/setting"
)

type Service struct {
	store store
}

func ProvideService(db db.DB, cfg setting.Cfg) *Service {
	return &Service{
		store: &sqlStore{
			db:  db,
			cfg: cfg,
		},
	}
}

func (s *Service) GetPreferenceWithDefaults(ctx context.Context, query *pref.GetPreferenceWithDefaultsQuery) (*pref.Preference, error) {
	listQuery := &pref.ListPreferenceQuery{
		Teams:  query.Teams,
		OrgID:  query.OrgID,
		UserID: query.UserID,
	}
	prefs, err := s.store.List(ctx, listQuery)
	if err != nil {
		return nil, err
	}

	res := s.store.GetDefaults()
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
		if p.HomeDashboardID != 0 {
			res.HomeDashboardID = p.HomeDashboardID
		}
	}

	return res, err
}

func (s *Service) GetPreference(ctx context.Context, query *pref.GetPreferenceQuery) (*pref.Preference, error) {
	return s.store.Get(ctx, query)
}

func (s *Service) SavePreference(ctx context.Context, cmd *pref.SavePreferenceCommand) (*pref.Preference, error) {
	return s.store.Set(ctx, cmd)
}
