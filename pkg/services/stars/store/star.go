package starsstore

import (
	"context"

	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/sqlstore"
)

type Store interface {
	IsStarredByUserCtx(ctx context.Context, query *models.IsStarredByUserQuery) error
	StarDashboard(ctx context.Context, cmd *models.StarDashboardCommand) error
	UnstarDashboard(ctx context.Context, cmd *models.UnstarDashboardCommand) error
	GetUserStars(ctx context.Context, query *models.GetUserStarsQuery) error
}

type StoreImpl struct {
	SqlStore sqlstore.Store
}

func (s *StoreImpl) addStarQueryAndCommandHandlers() {
	bus.AddHandler("sql", s.StarDashboard)
	bus.AddHandler("sql", s.UnstarDashboard)
	bus.AddHandler("sql", s.GetUserStars)
	bus.AddHandler("sql", s.IsStarredByUserCtx)
}

func NewStarsStore(sqlstore sqlstore.Store) *StoreImpl {
	s := &StoreImpl{SqlStore: sqlstore}
	s.addStarQueryAndCommandHandlers()
	return s
}

func (s *StoreImpl) IsStarredByUserCtx(ctx context.Context, query *models.IsStarredByUserQuery) error {
	return s.SqlStore.WithDbSession(ctx, func(sess *sqlstore.DBSession) error {
		rawSQL := "SELECT 1 from star where user_id=? and dashboard_id=?"
		results, err := sess.Query(rawSQL, query.UserId, query.DashboardId)

		if err != nil {
			return err
		}

		if len(results) == 0 {
			return nil
		}

		query.Result = true

		return nil
	})
}

func (s *StoreImpl) StarDashboard(ctx context.Context, cmd *models.StarDashboardCommand) error {
	if cmd.DashboardId == 0 || cmd.UserId == 0 {
		return models.ErrCommandValidationFailed
	}

	return s.SqlStore.WithTransactionalDbSession(ctx, func(sess *sqlstore.DBSession) error {
		entity := models.Star{
			UserId:      cmd.UserId,
			DashboardId: cmd.DashboardId,
		}

		_, err := sess.Insert(&entity)
		return err
	})
}

func (s *StoreImpl) UnstarDashboard(ctx context.Context, cmd *models.UnstarDashboardCommand) error {
	if cmd.DashboardId == 0 || cmd.UserId == 0 {
		return models.ErrCommandValidationFailed
	}

	return s.SqlStore.WithTransactionalDbSession(ctx, func(sess *sqlstore.DBSession) error {
		var rawSQL = "DELETE FROM star WHERE user_id=? and dashboard_id=?"
		_, err := sess.Exec(rawSQL, cmd.UserId, cmd.DashboardId)
		return err
	})
}

func (s *StoreImpl) GetUserStars(ctx context.Context, query *models.GetUserStarsQuery) error {
	return s.SqlStore.WithDbSession(ctx, func(dbSession *sqlstore.DBSession) error {
		var stars = make([]models.Star, 0)
		err := dbSession.Where("user_id=?", query.UserId).Find(&stars)

		query.Result = make(map[int64]bool)
		for _, star := range stars {
			query.Result[star.DashboardId] = true
		}

		return err
	})
}
