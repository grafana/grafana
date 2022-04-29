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

func ProvideService(db db.DB, cfg *setting.Cfg) pref.Service {
	return &Service{
		store: &sqlStore{
			db: db,
		},
		cfg: cfg,
	}
}

func (s *Service) GetWithDefaults(ctx context.Context, query *pref.GetPreferenceWithDefaultsQuery) (*pref.Preference, error) {
	listQuery := &pref.Preference{
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
	getPref := &pref.Preference{
		OrgID:  query.OrgID,
		UserID: query.UserID,
		TeamID: query.TeamID,
	}
	prefs, err := s.store.Get(ctx, getPref)
	if errors.Is(err, pref.ErrPrefNotFound) {
		return &pref.Preference{}, nil
	}
	if err != nil {
		return nil, err
	}
	return prefs, nil
}

func (s *Service) Save(ctx context.Context, cmd *pref.SavePreferenceCommand) error {
	preference, err := s.store.Get(ctx, &pref.Preference{
		OrgID:  cmd.OrgID,
		UserID: cmd.UserID,
		TeamID: cmd.TeamID,
	})
	if err != nil {
		if errors.Is(err, pref.ErrPrefNotFound) {
			preference := &pref.Preference{
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
			_, err = s.store.Insert(ctx, preference)
			if err != nil {
				return err
			}
		}
		return err
	}

	preference.Timezone = cmd.Timezone
	preference.WeekStart = cmd.WeekStart
	preference.Theme = cmd.Theme
	preference.Updated = time.Now()
	preference.Version += 1
	preference.JSONData = &pref.PreferenceJSONData{}
	preference.HomeDashboardID = cmd.HomeDashboardID

	if cmd.Navbar != nil {
		preference.JSONData.Navbar = *cmd.Navbar
	}
	if cmd.QueryHistory != nil {
		preference.JSONData.QueryHistory = *cmd.QueryHistory
	}
	return s.store.Update(ctx, preference)
}

func (s *Service) Patch(ctx context.Context, cmd *pref.PatchPreferenceCommand) error {
	var exists bool
	preference, err := s.store.Get(ctx, &pref.Preference{
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
			JSONData: &pref.PreferenceJSONData{},
		}
	} else {
		exists = true
	}

	if cmd.Navbar != nil {
		if preference.JSONData == nil {
			preference.JSONData = &pref.PreferenceJSONData{}
		}
		if cmd.Navbar.SavedItems != nil {
			preference.JSONData.Navbar.SavedItems = cmd.Navbar.SavedItems
		}
	}

	if cmd.QueryHistory != nil {
		if preference.JSONData == nil {
			preference.JSONData = &pref.PreferenceJSONData{}
		}
		if cmd.QueryHistory.HomeTab != "" {
			preference.JSONData.QueryHistory.HomeTab = cmd.QueryHistory.HomeTab
		}
	}

	if cmd.HomeDashboardID != nil {
		preference.HomeDashboardID = *cmd.HomeDashboardID
	}

	if cmd.Timezone != nil {
		preference.Timezone = *cmd.Timezone
	}

	if cmd.WeekStart != nil {
		preference.WeekStart = *cmd.WeekStart
	}

	if cmd.Theme != nil {
		preference.Theme = *cmd.Theme
	}

	preference.Updated = time.Now()
	preference.Version += 1

	// Wrap this in an if statement to maintain backwards compatibility
	if cmd.Navbar != nil {
		if preference.JSONData == nil {
			preference.JSONData = &pref.PreferenceJSONData{}
		}
		if cmd.Navbar.SavedItems != nil {
			preference.JSONData.Navbar.SavedItems = cmd.Navbar.SavedItems
		}
	}

	if exists {
		err = s.store.Update(ctx, preference)
	} else {
		_, err = s.store.Insert(ctx, preference)
	}
	return err
}

func (s *Service) GetDefaults() *pref.Preference {
	defaults := &pref.Preference{
		Theme:           s.cfg.DefaultTheme,
		Timezone:        s.cfg.DateFormats.DefaultTimezone,
		WeekStart:       s.cfg.DateFormats.DefaultWeekStart,
		HomeDashboardID: 0,
		JSONData:        &pref.PreferenceJSONData{},
	}

	return defaults
}
