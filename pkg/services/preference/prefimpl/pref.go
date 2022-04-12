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
		if p.JSONData != nil {
			res.JSONData = p.JSONData
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
	prefs, err := s.store.Get(ctx, &pref.GetPreferenceQuery{
		OrgID:  cmd.OrgID,
		UserID: cmd.UserID,
		TeamID: cmd.TeamID,
	})
	if err != nil {
		if errors.Is(err, pref.ErrPrefNotFound) {
			preference := &pref.InsertPreferenceQuery{
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
			return s.store.Insert(ctx, preference)
		}
		return err
	}
	preference := (*pref.UpdatePreferenceQuery)(prefs)
	preference.Timezone = cmd.Timezone
	preference.WeekStart = cmd.WeekStart
	preference.Theme = cmd.Theme
	preference.Updated = time.Now()
	preference.Version += 1
	preference.JSONData = &pref.PreferencesJSONData{}

	if cmd.Navbar != nil {
		preference.JSONData.Navbar = *cmd.Navbar
	}
	if cmd.QueryHistory != nil {
		prefs.JSONData.QueryHistory = *cmd.QueryHistory
	}
	return s.store.Update(ctx, preference)
}

func (s *Service) Patch(ctx context.Context, cmd *pref.PatchPreferenceCommand) error {
	var preference *pref.Preference
	var exists bool
	prefs, err := s.store.Get(ctx, &pref.GetPreferenceQuery{
		OrgID:  cmd.OrgID,
		UserID: cmd.UserID,
		TeamID: cmd.TeamID,
	})
	if err != nil && !errors.Is(err, pref.ErrPrefNotFound) {
		return err
	}

	if errors.Is(err, pref.ErrPrefNotFound) {
		preference = &pref.Preference{
			UserID:   cmd.UserID,
			OrgID:    cmd.OrgID,
			TeamID:   cmd.TeamID,
			Created:  time.Now(),
			JSONData: &pref.PreferencesJSONData{},
		}
	} else {
		exists = true
	}

	if cmd.Navbar != nil {
		if preference.JSONData == nil {
			preference.JSONData = &pref.PreferencesJSONData{}
		}
		if cmd.Navbar.SavedItems != nil {
			preference.JSONData.Navbar.SavedItems = cmd.Navbar.SavedItems
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
		if preference.JSONData == nil {
			preference.JSONData = &pref.PreferencesJSONData{}
		}
		if cmd.Navbar.SavedItems != nil {
			preference.JSONData.Navbar.SavedItems = cmd.Navbar.SavedItems
		}
	}

	if exists {
		prefs := (*pref.UpdatePreferenceQuery)(preference)
		err = s.store.Update(ctx, prefs)
	} else {
		prefs := (*pref.InsertPreferenceQuery)(preference)
		err = s.store.Insert(ctx, prefs)
	}
	return err
}

func (s *Service) GetDefaults() *pref.Preference {
	defaults := &pref.Preference{
		Theme:           s.cfg.DefaultTheme,
		Timezone:        s.cfg.DateFormats.DefaultTimezone,
		WeekStart:       s.cfg.DateFormats.DefaultWeekStart,
		HomeDashboardID: 0,
		JSONData:        &pref.PreferencesJSONData{},
	}

	return defaults
}
