package sqlstore

import (
	"context"
	"github.com/grafana/grafana/pkg/models"
	"time"
)

func (ss *SQLStore) GetThumbnail(query *models.GetDashboardThumbnailCommand) (*models.DashboardThumbnail, error) {

	err := ss.WithTransactionalDbSession(context.Background(), func(sess *DBSession) error {
		result, err := findThumbnailByMeta(sess, query.DashboardThumbnailMeta)
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
		existing, err := findThumbnailByMeta(sess, cmd.DashboardThumbnailMeta)

		if err != nil && err != models.ErrDashboardThumbnailNotFound {
			return err
		}

		if existing != nil {
			existing.Image = cmd.Image
			existing.MimeType = cmd.MimeType
			existing.Updated = time.Now()
			_, err = sess.ID(existing.Id).Update(existing)
			cmd.Result = existing
			return err
		}

		thumb := &models.DashboardThumbnail{}

		dashboardID, err := findDashboardIDByUID(sess, cmd.DashboardUID)

		if err != nil {
			return err
		}

		thumb.Updated = time.Now()
		thumb.Theme = cmd.Theme
		thumb.Kind = cmd.Kind
		thumb.Image = cmd.Image
		thumb.MimeType = cmd.MimeType
		thumb.DashboardId = dashboardID
		thumb.PanelId = cmd.PanelID
		_, err = sess.Insert(thumb)
		cmd.Result = thumb
		return err
	})

	return cmd.Result, err
}

func findThumbnailByMeta(sess *DBSession, meta models.DashboardThumbnailMeta) (*models.DashboardThumbnail, error) {
	result := &models.DashboardThumbnail{}

	sess.Table("dashboard_thumbnail")
	sess.Join("INNER", "dashboard", "dashboard.id = dashboard_thumbnail.dashboard_id")
	sess.Where("dashboard.uid = ? AND panel_id = ? AND kind = ? AND theme = ?", meta.DashboardUID, meta.PanelID, meta.Kind, meta.Theme)
	sess.Cols("dashboard_thumbnail.id",
		"dashboard_thumbnail.dashboard_id",
		"dashboard_thumbnail.panel_id",
		"dashboard_thumbnail.image",
		"dashboard_thumbnail.kind",
		"dashboard_thumbnail.mime_type",
		"dashboard_thumbnail.theme",
		"dashboard_thumbnail.updated")
	exists, err := sess.Get(result)

	if !exists {
		return nil, models.ErrDashboardThumbnailNotFound
	}

	if err != nil {
		return nil, err
	}

	return result, nil
}

func findDashboardIDByUID(sess *DBSession, dashboardUID string) (int64, error) {
	result := &struct {
		Id int64
	}{
		Id: 0,
	}

	sess.Table("dashboard").Where("dashboard.uid = ?", dashboardUID).Cols("id")
	exists, err := sess.Get(result)

	if err != nil {
		return 0, err
	}
	if !exists {
		return 0, models.ErrDashboardNotFound
	}

	return result.Id, err
}
