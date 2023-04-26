package prefimpl

import (
	"context"
	"errors"
	"time"

	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	pref "github.com/grafana/grafana/pkg/services/preference"
	"github.com/grafana/grafana/pkg/setting"
)

type Service struct {
	store    store
	cfg      *setting.Cfg
	features *featuremgmt.FeatureManager
}

func ProvideService(db db.DB, cfg *setting.Cfg, features *featuremgmt.FeatureManager) pref.Service {
	service := &Service{
		cfg:      cfg,
		features: features,
	}
	if features.IsEnabled(featuremgmt.FlagNewDBLibrary) {
		service.store = &sqlxStore{
			sess: db.GetSqlxSession(),
		}
	} else {
		service.store = &sqlStore{
			db: db,
		}
	}
	return service
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
		if p.WeekStart != nil && *p.WeekStart != "" {
			res.WeekStart = p.WeekStart
		}
		if p.HomeDashboardID != 0 {
			res.HomeDashboardID = p.HomeDashboardID
		}
		if p.JSONData != nil {
			if p.JSONData.Language != "" {
				res.JSONData.Language = p.JSONData.Language
			}

			if p.JSONData.QueryHistory.HomeTab != "" {
				res.JSONData.QueryHistory.HomeTab = p.JSONData.QueryHistory.HomeTab
			}

			if p.JSONData.CookiePreferences != nil {
				res.JSONData.CookiePreferences = p.JSONData.CookiePreferences
			}
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
	jsonData, err := preferenceData(cmd)
	if err != nil {
		return err
	}

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
				WeekStart:       &cmd.WeekStart,
				Theme:           cmd.Theme,
				Created:         time.Now(),
				Updated:         time.Now(),
				JSONData:        jsonData,
			}
			_, err = s.store.Insert(ctx, preference)
			if err != nil {
				return err
			}
		}
		return err
	}

	preference.Timezone = cmd.Timezone
	preference.WeekStart = &cmd.WeekStart
	preference.Theme = cmd.Theme
	preference.Updated = time.Now()
	preference.Version += 1
	preference.HomeDashboardID = cmd.HomeDashboardID
	preference.JSONData = jsonData

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

	if cmd.Language != nil {
		if preference.JSONData == nil {
			preference.JSONData = &pref.PreferenceJSONData{}
		}
		preference.JSONData.Language = *cmd.Language
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

	if cmd.CookiePreferences != nil {
		cookies, err := parseCookiePreferences(cmd.CookiePreferences)
		if err != nil {
			return err
		}

		if preference.JSONData == nil {
			preference.JSONData = &pref.PreferenceJSONData{}
		}
		preference.JSONData.CookiePreferences = cookies
	}

	if cmd.Timezone != nil {
		preference.Timezone = *cmd.Timezone
	}

	if cmd.WeekStart != nil {
		preference.WeekStart = cmd.WeekStart
	}

	if cmd.Theme != nil {
		preference.Theme = *cmd.Theme
	}

	preference.Updated = time.Now()
	preference.Version += 1

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
		WeekStart:       &s.cfg.DateFormats.DefaultWeekStart,
		HomeDashboardID: 0,
		JSONData:        &pref.PreferenceJSONData{},
	}

	if s.features.IsEnabled(featuremgmt.FlagInternationalization) {
		defaults.JSONData.Language = s.cfg.DefaultLanguage
	}

	return defaults
}

func (s *Service) DeleteByUser(ctx context.Context, userID int64) error {
	return s.store.DeleteByUser(ctx, userID)
}

func parseCookiePreferences(prefs []pref.CookieType) (map[string]struct{}, error) {
	allowed := map[pref.CookieType]struct{}{
		"analytics":   {},
		"performance": {},
		"functional":  {},
	}

	m := map[string]struct{}{}
	for _, c := range prefs {
		if _, ok := allowed[c]; !ok {
			return nil, pref.ErrUnknownCookieType.Errorf("'%s' is not an allowed cookie type", c)
		}

		m[string(c)] = struct{}{}
	}
	return m, nil
}

func preferenceData(cmd *pref.SavePreferenceCommand) (*pref.PreferenceJSONData, error) {
	jsonData := &pref.PreferenceJSONData{
		Language: cmd.Language,
	}

	if cmd.QueryHistory != nil {
		jsonData.QueryHistory = *cmd.QueryHistory
	}
	if cmd.CookiePreferences != nil {
		cookies, err := parseCookiePreferences(cmd.CookiePreferences)
		if err != nil {
			return nil, err
		}
		jsonData.CookiePreferences = cookies
	}

	return jsonData, nil
}
