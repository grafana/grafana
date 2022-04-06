package prefimpl

import (
	"context"
	"time"

	pref "github.com/grafana/grafana/pkg/services/preference"
	"github.com/grafana/grafana/pkg/services/sqlstore/db"
	"github.com/grafana/grafana/pkg/setting"
)

type Service struct {
	store store
	cfg   *setting.Cfg
}

func ProvideService(db db.DB, cfg *setting.Cfg) *Service {
	return &Service{
		store: &sqlStore{
			db: db,
		},
		cfg: cfg,
	}
}

func (s *Service) GetWithDefaults(ctx context.Context, query *pref.GetPreferenceWithDefaultsQuery) (*pref.Preferences, error) {
	listQuery := &pref.ListPreferenceQuery{
		Teams:  query.Teams,
		OrgID:  query.OrgID,
		UserID: query.UserID,
	}
	prefs, err := s.store.List(ctx, listQuery)
	if err != nil {
		return nil, err
	}

	res := s.GetDefaults()
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
		if p.JsonData != nil {
			res.JsonData = p.JsonData
		}
	}

	return res, err
}

func (s *Service) Get(ctx context.Context, query *pref.GetPreferenceQuery) (*pref.Preferences, error) {
	prefs, err := s.store.Get(ctx, query)
	if err != nil && err != pref.ErrPrefNotFound {
		return nil, err
	}
	return prefs, nil
}

func (s *Service) Save(ctx context.Context, cmd *pref.SavePreferenceCommand) error {
	return s.store.Set(ctx, cmd)
}

func (s *Service) Patch(ctx context.Context, cmd *pref.PatchPreferenceCommand) error {
	var preference *pref.Preferences
	var exist bool
	prefs, err := s.store.Get(ctx, &pref.GetPreferenceQuery{
		OrgID:  cmd.OrgID,
		UserID: cmd.UserID,
		TeamID: cmd.TeamID,
	})
	if err != nil && err != pref.ErrPrefNotFound {
		return err
	}

	if err == pref.ErrPrefNotFound {
		preference = &pref.Preferences{
			UserId:   cmd.UserID,
			OrgId:    cmd.OrgID,
			TeamId:   cmd.TeamID,
			Created:  time.Now(),
			JsonData: &pref.PreferencesJsonData{},
		}
	} else {
		exist = true
	}

	if cmd.Navbar != nil {
		if preference.JsonData == nil {
			preference.JsonData = &pref.PreferencesJsonData{}
		}
		if cmd.Navbar.SavedItems != nil {
			preference.JsonData.Navbar.SavedItems = cmd.Navbar.SavedItems
		}
	}

	if cmd.HomeDashboardId != nil {
		preference.HomeDashboardId = *cmd.HomeDashboardId
	}

	if cmd.Timezone != nil {
		preference.Timezone = *cmd.Timezone
	}

	if cmd.WeekStart != nil {
		prefs.WeekStart = *cmd.WeekStart
	}

	if cmd.Theme != nil {
		prefs.Theme = *cmd.Theme
	}

	prefs.Updated = time.Now()
	prefs.Version += 1

	// Wrap this in an if statement to maintain backwards compatibility
	if cmd.Navbar != nil {
		if preference.JsonData == nil {
			preference.JsonData = &pref.PreferencesJsonData{}
		}
		if cmd.Navbar.SavedItems != nil {
			preference.JsonData.Navbar.SavedItems = cmd.Navbar.SavedItems
		}
	}

	return s.store.Upsert(ctx, preference, exist)
}

func (s *Service) GetDefaults() *pref.Preferences {
	defaults := &pref.Preferences{
		Theme:           s.cfg.DefaultTheme,
		Timezone:        s.cfg.DateFormats.DefaultTimezone,
		WeekStart:       s.cfg.DateFormats.DefaultWeekStart,
		HomeDashboardId: 0,
		JsonData:        &pref.PreferencesJsonData{},
	}

	return defaults
}
