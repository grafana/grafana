package preferencesstore

import (
	"context"
	"time"

	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/setting"
)

type StoreImpl struct {
	SqlStore sqlstore.Store
	Cfg      *setting.Cfg
}

// TODO : Get and Set store methods
type Store interface {
	// TODO adjust the methods to Get/Set methods move logic to service
	Get(context.Context, *models.GetPreferencesQuery) (*models.Preferences, error)
	GetDefaults() *models.Preferences
	List(ctx context.Context, filter string, params []interface{}) ([]*models.Preferences, error)
	Set(context.Context, *models.SavePreferencesCommand) error
}

//  move the logic part to the service and use GetPreferences instead of this one
func (s *StoreImpl) List(ctx context.Context, filter string, params []interface{}) ([]*models.Preferences, error) {
	prefs := make([]*models.Preferences, 0)
	err := s.SqlStore.WithDbSession(ctx, func(dbSession *sqlstore.DBSession) error {
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
		Theme:           s.Cfg.DefaultTheme,
		Timezone:        s.Cfg.DateFormats.DefaultTimezone,
		WeekStart:       s.Cfg.DateFormats.DefaultWeekStart,
		HomeDashboardId: 0,
	}

	return defaults
}

func (s *StoreImpl) Get(ctx context.Context, query *models.GetPreferencesQuery) (*models.Preferences, error) {
	var prefs models.Preferences
	err := s.SqlStore.WithDbSession(ctx, func(sess *sqlstore.DBSession) error {
		_, err := sess.Where("org_id=? AND user_id=? AND team_id=?", query.OrgId, query.UserId, query.TeamId).Get(&prefs)

		if err != nil {
			return err
		}

		return nil
	})
	return &prefs, err
}

func (s *StoreImpl) Set(ctx context.Context, cmd *models.SavePreferencesCommand) error {
	return s.SqlStore.WithTransactionalDbSession(ctx, func(sess *sqlstore.DBSession) error {
		var prefs models.Preferences
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
}
