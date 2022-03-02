package starsstore

import (
	"context"

	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/sqlstore"
)

type Store interface {
	IsStarredByUserCtx(ctx context.Context, query *models.IsStarredByUserQuery) (bool, error)
	StarDashboard(ctx context.Context, cmd *models.StarDashboardCommand) error
	UnstarDashboard(ctx context.Context, cmd *models.UnstarDashboardCommand) error
	GetUserStars(ctx context.Context, query *models.GetUserStarsQuery) (map[int64]bool, error)
}

type StoreImpl struct {
	SqlStore sqlstore.Store
}

func NewStarsStore(sqlstore sqlstore.Store) *StoreImpl {
	s := &StoreImpl{SqlStore: sqlstore}
	return s
}

func (s *StoreImpl) IsStarredByUserCtx(ctx context.Context, query *models.IsStarredByUserQuery) (bool, error) {
	var isStarred bool
	err := s.SqlStore.WithDbSession(ctx, func(sess *sqlstore.DBSession) error {
		rawSQL := "SELECT 1 from star where user_id=? and dashboard_id=?"
		results, err := sess.Query(rawSQL, query.UserId, query.DashboardId)

		if err != nil {
			return err
		}

		if len(results) == 0 {
			return nil
		}

		isStarred = true

		return nil
	})
	return isStarred, err
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

func (s *StoreImpl) GetUserStars(ctx context.Context, query *models.GetUserStarsQuery) (map[int64]bool, error) {
	var userStars map[int64]bool
	err := s.SqlStore.WithDbSession(ctx, func(dbSession *sqlstore.DBSession) error {
		var stars = make([]models.Star, 0)
		err := dbSession.Where("user_id=?", query.UserId).Find(&stars)

		userStars = make(map[int64]bool)
		for _, star := range stars {
			userStars[star.DashboardId] = true
		}
		return err
	})
	return userStars, err
}
