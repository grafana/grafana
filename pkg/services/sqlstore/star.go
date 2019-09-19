package sqlstore

import (
	"context"

	"github.com/grafana/grafana/pkg/bus"
	m "github.com/grafana/grafana/pkg/models"
)

func init() {
	bus.AddHandlerCtx("sql", StarDashboard)
	bus.AddHandlerCtx("sql", UnstarDashboard)
	bus.AddHandlerCtx("sql", GetUserStars)
	bus.AddHandlerCtx("sql", IsStarredByUser)
}

func IsStarredByUser(ctx context.Context, query *m.IsStarredByUserQuery) error {
	rawSql := "SELECT 1 from star where user_id=? and dashboard_id=?"
	results, err := x.Query(rawSql, query.UserId, query.DashboardId)

	if err != nil {
		return err
	}

	if len(results) == 0 {
		return nil
	}

	query.Result = true

	return nil
}

func StarDashboard(ctx context.Context, cmd *m.StarDashboardCommand) error {
	if cmd.DashboardId == 0 || cmd.UserId == 0 {
		return m.ErrCommandValidationFailed
	}

	return inTransaction(func(sess *DBSession) error {

		entity := m.Star{
			UserId:      cmd.UserId,
			DashboardId: cmd.DashboardId,
		}

		_, err := sess.Insert(&entity)
		return err
	})
}

func UnstarDashboard(ctx context.Context, cmd *m.UnstarDashboardCommand) error {
	if cmd.DashboardId == 0 || cmd.UserId == 0 {
		return m.ErrCommandValidationFailed
	}

	return inTransaction(func(sess *DBSession) error {
		var rawSql = "DELETE FROM star WHERE user_id=? and dashboard_id=?"
		_, err := sess.Exec(rawSql, cmd.UserId, cmd.DashboardId)
		return err
	})
}

func GetUserStars(ctx context.Context, query *m.GetUserStarsQuery) error {
	var stars = make([]m.Star, 0)
	err := x.Where("user_id=?", query.UserId).Find(&stars)

	query.Result = make(map[int64]bool)
	for _, star := range stars {
		query.Result[star.DashboardId] = true
	}

	return err
}
