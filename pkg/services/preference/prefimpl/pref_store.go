package prefimpl

import (
	"context"
	"strings"
	"time"

	pref "github.com/grafana/grafana/pkg/services/preference"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/services/sqlstore/db"
	"github.com/grafana/grafana/pkg/setting"
)

type store interface {
	Get(context.Context, *pref.GetPreferenceQuery) (*pref.Preference, error)
	GetDefaults() *pref.Preference
	List(context.Context, *pref.ListPreferenceQuery) ([]*pref.Preference, error)
	Set(context.Context, *pref.SavePreferenceCommand) (*pref.Preference, error)
}

type sqlStore struct {
	db  db.DB
	cfg setting.Cfg
}

func (s *sqlStore) Get(ctx context.Context, query *pref.GetPreferenceQuery) (*pref.Preference, error) {
	var prefs pref.Preference
	err := s.db.WithDbSession(ctx, func(sess *sqlstore.DBSession) error {
		_, err := sess.Where("org_id=? AND user_id=? AND team_id=?", query.OrgID, query.UserID, query.TeamID).Get(&prefs)

		if err != nil {
			return err
		}

		return nil
	})
	return &prefs, err
}

func (s *sqlStore) GetDefaults() *pref.Preference {
	defaults := &pref.Preference{
		Theme:           s.cfg.DefaultTheme,
		Timezone:        s.cfg.DateFormats.DefaultTimezone,
		WeekStart:       s.cfg.DateFormats.DefaultWeekStart,
		HomeDashboardID: 0,
	}

	return defaults
}

func (s *sqlStore) List(ctx context.Context, query *pref.ListPreferenceQuery) ([]*pref.Preference, error) {
	prefs := make([]*pref.Preference, 0)
	params := make([]interface{}, 0)
	filter := ""

	if len(query.Teams) > 0 {
		filter = "(org_id=? AND team_id IN (?" + strings.Repeat(",?", len(query.Teams)-1) + ")) OR "
		params = append(params, query.OrgID)
		for _, v := range query.Teams {
			params = append(params, v)
		}
	}

	filter += "(org_id=? AND user_id=? AND team_id=0) OR (org_id=? AND team_id=0 AND user_id=0)"
	params = append(params, query.OrgID)
	params = append(params, query.UserID)
	params = append(params, query.OrgID)

	err := s.db.WithDbSession(ctx, func(dbSession *sqlstore.DBSession) error {
		err := dbSession.Where(filter, params...).
			OrderBy("user_id ASC, team_id ASC").
			Find(&prefs)

		if err != nil {
			return err
		}

		return nil
	})
	return prefs, err
}

func (s *sqlStore) Set(ctx context.Context, cmd *pref.SavePreferenceCommand) (*pref.Preference, error) {
	var prefs pref.Preference
	err := s.db.WithTransactionalDbSession(ctx, func(sess *sqlstore.DBSession) error {
		exists, err := sess.Where("org_id=? AND user_id=? AND team_id=?", cmd.OrgID, cmd.UserID, cmd.TeamID).Get(&prefs)
		if err != nil {
			return err
		}

		if !exists {
			prefs = pref.Preference{
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
			_, err = sess.Insert(&prefs)
			return err
		}
		prefs.HomeDashboardID = cmd.HomeDashboardID
		prefs.Timezone = cmd.Timezone
		prefs.WeekStart = cmd.WeekStart
		prefs.Theme = cmd.Theme
		prefs.Updated = time.Now()
		prefs.Version += 1
		_, err = sess.ID(prefs.ID).AllCols().Update(&prefs)
		return err
	})
	if err != nil {
		return nil, err
	}
	return &prefs, nil
}
