package sqlstore

import (
	"context"

	"github.com/grafana/grafana/pkg/models"
)

func (ss *SQLStore) IsStarredByUserCtx(ctx context.Context, query *models.IsStarredByUserQuery) error {
	return ss.WithDbSession(ctx, func(sess *DBSession) error {
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

func (ss *SQLStore) StarDashboard(ctx context.Context, cmd *models.StarDashboardCommand) error {
	if cmd.DashboardId == 0 || cmd.UserId == 0 {
		return models.ErrCommandValidationFailed
	}

	return ss.WithTransactionalDbSession(ctx, func(sess *DBSession) error {
		entity := models.Star{
			UserId:      cmd.UserId,
			DashboardId: cmd.DashboardId,
		}

		_, err := sess.Insert(&entity)
		return err
	})
}

func (ss *SQLStore) UnstarDashboard(ctx context.Context, cmd *models.UnstarDashboardCommand) error {
	if cmd.DashboardId == 0 || cmd.UserId == 0 {
		return models.ErrCommandValidationFailed
	}

	return ss.WithTransactionalDbSession(ctx, func(sess *DBSession) error {
		var rawSQL = "DELETE FROM star WHERE user_id=? and dashboard_id=?"
		_, err := sess.Exec(rawSQL, cmd.UserId, cmd.DashboardId)
		return err
	})
}

func (ss *SQLStore) GetUserStars(ctx context.Context, query *models.GetUserStarsQuery) error {
	return ss.WithDbSession(ctx, func(dbSession *DBSession) error {
		var stars = make([]models.Star, 0)
		err := dbSession.Where("user_id=?", query.UserId).Find(&stars)

		query.Result = make(map[int64]bool)
		for _, star := range stars {
			query.Result[star.DashboardId] = true
		}

		return err
	})
}
