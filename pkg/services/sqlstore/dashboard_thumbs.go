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

		sess.UseBool("stale")

		if existing != nil {
			existing.Image = cmd.Image
			existing.MimeType = cmd.MimeType
			existing.Updated = time.Now()
			existing.DashboardVersion = cmd.DashboardVersion
			existing.Stale = false
			_, err = sess.ID(existing.Id).Update(existing)
			cmd.Result = existing
			return err
		}

		thumb := &models.DashboardThumbnail{}

		dash, err := findDashboardIDByUID(sess, cmd.DashboardUID)

		if err != nil {
			return err
		}

		thumb.Updated = time.Now()
		thumb.Theme = cmd.Theme
		thumb.Kind = cmd.Kind
		thumb.Image = cmd.Image
		thumb.MimeType = cmd.MimeType
		thumb.DashboardId = dash.Id
		thumb.DashboardVersion = cmd.DashboardVersion
		thumb.Stale = false
		thumb.PanelId = cmd.PanelID
		_, err = sess.Insert(thumb)
		cmd.Result = thumb
		return err
	})

	return cmd.Result, err
}

func (ss *SQLStore) MarkAsStale(cmd *models.MarkAsStaleCommand) error {
	err := ss.WithTransactionalDbSession(context.Background(), func(sess *DBSession) error {
		existing, err := findThumbnailByMeta(sess, cmd.DashboardThumbnailMeta)

		if err != nil {
			return err
		}

		existing.Stale = true
		_, err = sess.ID(existing.Id).UseBool("stale").Update(existing)
		return err
	})

	return err
}

func (ss *SQLStore) FindDashboardsWithStaleThumbnails(cmd *models.FindDashboardsWithStaleThumbnailsCommand) ([]*models.DashboardWithStaleThumbnail, error) {
	err := ss.WithTransactionalDbSession(context.Background(), func(sess *DBSession) error {
		sess.Table("dashboard")
		sess.Join("LEFT", "dashboard_thumbnail", "dashboard.id = dashboard_thumbnail.dashboard_id")
		sess.Where("dashboard.is_folder = ?", dialect.BooleanStr(false))
		sess.Where("(dashboard.version != dashboard_thumbnail.dashboard_version "+
			"OR dashboard_thumbnail.stale = ? "+
			"OR dashboard_thumbnail.id IS NULL)", dialect.BooleanStr(true))

		if !cmd.IncludeManuallyUploadedThumbnails {
			sess.Where("(dashboard_thumbnail.id is not null AND dashboard_thumbnail.dashboard_version != ?) "+
				"OR dashboard_thumbnail.id is null "+
				"OR dashboard_thumbnail.stale = ?", models.DashboardVersionForManualThumbnailUpload, dialect.BooleanStr(true))
		}

		sess.Cols("dashboard.id",
			"dashboard.uid",
			"dashboard.version",
			"dashboard.slug")

		var dashboards = make([]*models.DashboardWithStaleThumbnail, 0)
		err := sess.Find(&dashboards)

		if err != nil {
			return err
		}
		cmd.Result = dashboards
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
		"dashboard_thumbnail.dashboard_version",
		"dashboard_thumbnail.stale",
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

type dash struct {
	Id int64
}

func findDashboardIDByUID(sess *DBSession, dashboardUID string) (*dash, error) {
	result := &dash{}

	sess.Table("dashboard").Where("dashboard.uid = ?", dashboardUID).Cols("id")
	exists, err := sess.Get(result)

	if err != nil {
		return nil, err
	}
	if !exists {
		return nil, models.ErrDashboardNotFound
	}

	return result, err
}
