package prefimpl

import (
	"context"
	"errors"
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

func (s *Service) GetWithDefaults(ctx context.Context, query *pref.GetPreferenceWithDefaultsQuery) (*pref.Preference, error) {
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
		if p.HomeDashboardID != 0 {
			res.HomeDashboardID = p.HomeDashboardID
		}
		if p.JsonData != nil {
			res.JsonData = p.JsonData
		}
	}

	return res, err
}

func (s *Service) Get(ctx context.Context, query *pref.GetPreferenceQuery) (*pref.Preference, error) {
	prefs, err := s.store.Get(ctx, query)
	if err != nil && !errors.Is(err, pref.ErrPrefNotFound) {
		return nil, err
	}
	return prefs, nil
}

func (s *Service) Save(ctx context.Context, cmd *pref.SavePreferenceCommand) error {
	var exist bool
	var preference *pref.UpsertPreference
	prefs, err := s.store.Get(ctx, &pref.GetPreferenceQuery{
		OrgID:  cmd.OrgID,
		UserID: cmd.UserID,
		TeamID: cmd.TeamID,
	})
	if err != nil {
		if errors.Is(err, pref.ErrPrefNotFound) {
			preference = &pref.UpsertPreference{
				UserID:          cmd.UserID,
				OrgID:           cmd.OrgID,
				TeamID:          cmd.TeamID,
				HomeDashboardID: cmd.HomeDashboardID,
				Timezone:        cmd.Timezone,
				WeekStart:       cmd.WeekStart,
				Theme:           cmd.Theme,
				Created:         time.Now(),
				Updated:         time.Now(),
			}
		}
		return err
	} else {
		exist = true
		preference = (*pref.UpsertPreference)(prefs)
		preference.Timezone = cmd.Timezone
		preference.WeekStart = cmd.WeekStart
		preference.Theme = cmd.Theme
		preference.Updated = time.Now()
		preference.Version += 1
		preference.JsonData = &pref.PreferencesJsonData{}
		if cmd.Navbar != nil {
			preference.JsonData.Navbar = *cmd.Navbar
		}
	}
	return s.store.Upsert(ctx, preference, exist)
}

func (s *Service) Patch(ctx context.Context, cmd *pref.PatchPreferenceCommand) error {
	var preference *pref.UpsertPreference
	var exist bool
	prefs, err := s.store.Get(ctx, &pref.GetPreferenceQuery{
		OrgID:  cmd.OrgID,
		UserID: cmd.UserID,
		TeamID: cmd.TeamID,
	})
	if err != nil && !errors.Is(err, pref.ErrPrefNotFound) {
		return err
	}

	if errors.Is(err, pref.ErrPrefNotFound) {
		preference = &pref.UpsertPreference{
			UserID:   cmd.UserID,
			OrgID:    cmd.OrgID,
			TeamID:   cmd.TeamID,
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

	if cmd.HomeDashboardID != nil {
		preference.HomeDashboardID = *cmd.HomeDashboardID
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

func (s *Service) GetDefaults() *pref.Preference {
	defaults := &pref.Preference{
		Theme:           s.cfg.DefaultTheme,
		Timezone:        s.cfg.DateFormats.DefaultTimezone,
		WeekStart:       s.cfg.DateFormats.DefaultWeekStart,
		HomeDashboardID: 0,
		JsonData:        &pref.PreferencesJsonData{},
	}

	return defaults
}
