package sqlstore

import (
	"context"
	"errors"
	"time"

	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/dashboards"
)

func (ss *SQLStore) GetThumbnail(ctx context.Context, query *models.GetDashboardThumbnailCommand) (*models.DashboardThumbnail, error) {
	err := ss.WithDbSession(ctx, func(sess *DBSession) error {
		result, err := findThumbnailByMeta(sess, query.DashboardThumbnailMeta)
		if err != nil {
			return err
		}
		query.Result = result
		return nil
	})

	return query.Result, err
}

func (ss *SQLStore) SaveThumbnail(ctx context.Context, cmd *models.SaveDashboardThumbnailCommand) (*models.DashboardThumbnail, error) {
	err := ss.WithTransactionalDbSession(ctx, func(sess *DBSession) error {
		existing, err := findThumbnailByMeta(sess, cmd.DashboardThumbnailMeta)

		if err != nil && !errors.Is(err, dashboards.ErrDashboardThumbnailNotFound) {
			return err
		}

		if existing != nil {
			existing.Image = cmd.Image
			existing.MimeType = cmd.MimeType
			existing.Updated = time.Now()
			existing.DashboardVersion = cmd.DashboardVersion
			existing.State = models.ThumbnailStateDefault
			_, err = sess.ID(existing.Id).Update(existing)
			cmd.Result = existing
			return err
		}

		thumb := &models.DashboardThumbnail{}

		dash, err := findDashboardIdByThumbMeta(sess, cmd.DashboardThumbnailMeta)

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
		thumb.State = models.ThumbnailStateDefault
		thumb.PanelId = cmd.PanelID
		_, err = sess.Insert(thumb)
		cmd.Result = thumb
		return err
	})

	return cmd.Result, err
}

func (ss *SQLStore) UpdateThumbnailState(ctx context.Context, cmd *models.UpdateThumbnailStateCommand) error {
	err := ss.WithTransactionalDbSession(ctx, func(sess *DBSession) error {
		existing, err := findThumbnailByMeta(sess, cmd.DashboardThumbnailMeta)

		if err != nil {
			return err
		}

		existing.State = cmd.State
		_, err = sess.ID(existing.Id).Update(existing)
		return err
	})

	return err
}

func (ss *SQLStore) FindThumbnailCount(ctx context.Context, cmd *models.FindDashboardThumbnailCountCommand) (int64, error) {
	err := ss.WithDbSession(ctx, func(sess *DBSession) error {
		count, err := sess.Count(&models.DashboardThumbnail{})
		if err != nil {
			return err
		}

		cmd.Result = count
		return nil
	})

	return cmd.Result, err
}

func (ss *SQLStore) FindDashboardsWithStaleThumbnails(ctx context.Context, cmd *models.FindDashboardsWithStaleThumbnailsCommand) ([]*models.DashboardWithStaleThumbnail, error) {
	err := ss.WithDbSession(ctx, func(sess *DBSession) error {
		sess.Table("dashboard")
		sess.Join("LEFT", "dashboard_thumbnail", "dashboard.id = dashboard_thumbnail.dashboard_id AND dashboard_thumbnail.theme = ? AND dashboard_thumbnail.kind = ?", cmd.Theme, cmd.Kind)
		sess.Where("dashboard.is_folder = ?", dialect.BooleanStr(false))
		sess.Where("(dashboard.version != dashboard_thumbnail.dashboard_version "+
			"OR dashboard_thumbnail.state = ? "+
			"OR dashboard_thumbnail.id IS NULL)", models.ThumbnailStateStale)

		if !cmd.IncludeManuallyUploadedThumbnails {
			sess.Where("(dashboard_thumbnail.id is not null AND dashboard_thumbnail.dashboard_version != ?) "+
				"OR dashboard_thumbnail.id is null "+
				"OR dashboard_thumbnail.state = ?", models.DashboardVersionForManualThumbnailUpload, models.ThumbnailStateStale)
		}

		sess.Where("(dashboard_thumbnail.id IS NULL OR dashboard_thumbnail.state != ?)", models.ThumbnailStateLocked)

		sess.Cols("dashboard.id",
			"dashboard.uid",
			"dashboard.org_id",
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
	sess.Where("dashboard.uid = ? AND dashboard.org_id = ? AND panel_id = ? AND kind = ? AND theme = ?", meta.DashboardUID, meta.OrgId, meta.PanelID, meta.Kind, meta.Theme)
	sess.Cols("dashboard_thumbnail.id",
		"dashboard_thumbnail.dashboard_id",
		"dashboard_thumbnail.panel_id",
		"dashboard_thumbnail.image",
		"dashboard_thumbnail.dashboard_version",
		"dashboard_thumbnail.state",
		"dashboard_thumbnail.kind",
		"dashboard_thumbnail.mime_type",
		"dashboard_thumbnail.theme",
		"dashboard_thumbnail.updated")
	exists, err := sess.Get(result)

	if !exists {
		return nil, dashboards.ErrDashboardThumbnailNotFound
	}

	if err != nil {
		return nil, err
	}

	return result, nil
}

type dash struct {
	Id int64
}

func findDashboardIdByThumbMeta(sess *DBSession, meta models.DashboardThumbnailMeta) (*dash, error) {
	result := &dash{}

	sess.Table("dashboard").Where("dashboard.uid = ? AND dashboard.org_id = ?", meta.DashboardUID, meta.OrgId).Cols("id")
	exists, err := sess.Get(result)

	if err != nil {
		return nil, err
	}
	if !exists {
		return nil, dashboards.ErrDashboardNotFound
	}

	return result, err
}
