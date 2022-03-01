package prefsstore

import (
	"context"
	"strings"
	"time"

	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/setting"
)

type StoreImpl struct {
	sqlStore sqlstore.Store
	cfg      *setting.Cfg
}

type Store interface {
	Get(context.Context, *models.GetPreferencesQuery) (*models.Preferences, error)
	GetDefaults() *models.Preferences
	List(ctx context.Context, query *models.ListPreferencesQuery) ([]*models.Preferences, error)
	Set(context.Context, *models.SavePreferencesCommand) (*models.Preferences, error)
}

func NewPreferencesStore(cfg *setting.Cfg, sqlStore sqlstore.Store) Store {
	return &StoreImpl{
		sqlStore: sqlStore,
		cfg:      cfg,
	}
}

//  move the logic part to the service and use GetPreferences instead of this one
func (s *StoreImpl) List(ctx context.Context, query *models.ListPreferencesQuery) ([]*models.Preferences, error) {
	prefs := make([]*models.Preferences, 0)
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

	err := s.sqlStore.WithDbSession(ctx, func(dbSession *sqlstore.DBSession) error {
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

func (s *StoreImpl) GetDefaults() *models.Preferences {
	defaults := &models.Preferences{
		Theme:           s.cfg.DefaultTheme,
		Timezone:        s.cfg.DateFormats.DefaultTimezone,
		WeekStart:       s.cfg.DateFormats.DefaultWeekStart,
		HomeDashboardId: 0,
	}

	return defaults
}

func (s *StoreImpl) Get(ctx context.Context, query *models.GetPreferencesQuery) (*models.Preferences, error) {
	var prefs models.Preferences
	err := s.sqlStore.WithDbSession(ctx, func(sess *sqlstore.DBSession) error {
		_, err := sess.Where("org_id=? AND user_id=? AND team_id=?", query.OrgId, query.UserId, query.TeamId).Get(&prefs)

		if err != nil {
			return err
		}

		return nil
	})
	return &prefs, err
}

func (s *StoreImpl) Set(ctx context.Context, cmd *models.SavePreferencesCommand) (*models.Preferences, error) {
	var prefs models.Preferences
	err := s.sqlStore.WithTransactionalDbSession(ctx, func(sess *sqlstore.DBSession) error {
		exists, err := sess.Where("org_id=? AND user_id=? AND team_id=?", cmd.OrgId, cmd.UserId, cmd.TeamId).Get(&prefs)
		if err != nil {
			return err
		}

		if !exists {
			prefs = models.Preferences{
				UserId:          cmd.UserId,
				OrgId:           cmd.OrgId,
				TeamId:          cmd.TeamId,
				HomeDashboardId: cmd.HomeDashboardId,
				Timezone:        cmd.Timezone,
				WeekStart:       cmd.WeekStart,
				Theme:           cmd.Theme,
				Created:         time.Now(),
				Updated:         time.Now(),
			}
			_, err = sess.Insert(&prefs)
			return err
		}
		prefs.HomeDashboardId = cmd.HomeDashboardId
		prefs.Timezone = cmd.Timezone
		prefs.WeekStart = cmd.WeekStart
		prefs.Theme = cmd.Theme
		prefs.Updated = time.Now()
		prefs.Version += 1
		_, err = sess.ID(prefs.Id).AllCols().Update(&prefs)
		return err
	})
	if err != nil {
		return nil, err
	}
	return &prefs, nil
}
