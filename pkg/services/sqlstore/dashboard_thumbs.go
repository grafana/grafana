package sqlstore

import (
	"context"
	"github.com/grafana/grafana/pkg/models"
	"time"
)

func (ss *SQLStore) GetThumbnail(query *models.GetDashboardThumbnailCommand) (*models.DashboardThumbnail, error) {

	err := ss.WithTransactionalDbSession(context.Background(), func(sess *DBSession) error {

		result := &models.DashboardThumbnail{}

		sess.Table("dashboard_thumbnail")
		sess.Join("INNER", "dashboard", "dashboard.id = dashboard_thumbnail.dashboard_id")
		sess.Where("dashboard.uid = ? AND panel_id = ? AND kind = ? AND theme = ?", query.DashboardUID, query.PanelID, query.Kind, query.Theme)
		sess.Cols("dashboard_thumbnail.id",
			"dashboard_thumbnail.dashboard_id",
			"dashboard_thumbnail.panel_id",
			"dashboard_thumbnail.image_data_url",
			"dashboard_thumbnail.kind",
			"dashboard_thumbnail.theme",
			"dashboard_thumbnail.updated")
		exists, err := sess.Get(result)

		if !exists {
			return models.ErrDashboardThumbnailNotFound
		}

		if err != nil {
			return err
		}

		query.Result = result
		return nil
	})

	return query.Result, err
}

func (ss *SQLStore) SaveThumbnail(cmd *models.SaveDashboardThumbnailCommand) (*models.DashboardThumbnail, error) {
	err := ss.WithTransactionalDbSession(context.Background(), func(sess *DBSession) error {
		result := &models.DashboardThumbnail{}
		exists, err := sess.Where("dashboard_id = ? AND panel_id = ? AND kind = ? AND theme = ?", cmd.DashboardID, cmd.PanelID, cmd.Kind, cmd.Theme).Get(result)

		if err != nil {

			return err
		}

		if exists {
			result.ImageDataUrl = cmd.Image
			result.Updated = time.Now()
			_, err = sess.ID(result.Id).Update(result)
			cmd.Result = result
			return err
		} else {
			result.Updated = time.Now()
			result.Theme = cmd.Theme
			result.Kind = cmd.Kind
			result.ImageDataUrl = cmd.Image
			result.DashboardId = cmd.DashboardID
			result.PanelId = cmd.PanelID
			_, err := sess.Insert(result)
			cmd.Result = result
			return err
		}
	})

	return cmd.Result, err
}
