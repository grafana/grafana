package sqlstore

import (
	"github.com/go-xorm/xorm"

	"github.com/torkelo/grafana-pro/pkg/bus"
	m "github.com/torkelo/grafana-pro/pkg/models"
)

func init() {
	bus.AddHandler("sql", AddAsFavorite)
	bus.AddHandler("sql", RemoveAsFavorite)
	bus.AddHandler("sql", GetUserFavorites)
}

func AddAsFavorite(cmd *m.AddAsFavoriteCommand) error {
	return inTransaction(func(sess *xorm.Session) error {

		entity := m.Favorite{
			UserId:      cmd.UserId,
			DashboardId: cmd.DashboardId,
		}

		_, err := sess.Insert(&entity)
		return err
	})
}

func RemoveAsFavorite(cmd *m.RemoveAsFavoriteCommand) error {
	return inTransaction(func(sess *xorm.Session) error {
		var rawSql = "DELETE FROM favorite WHERE user_id=? and dashboard_id=?"
		_, err := sess.Exec(rawSql, cmd.UserId, cmd.DashboardId)
		return err
	})
}

func GetUserFavorites(query *m.GetUserFavoritesQuery) error {
	query.Result = make([]m.Favorite, 0)
	err := x.Where("user_id=?", query.UserId).Find(&query.Result)
	return err
}
