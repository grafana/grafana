package dashboardthumbsimpl

import (
	"context"
	"encoding/json"
	"errors"
	"time"

	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/thumbs"
)

type xormStore struct {
	db db.DB
}

func (ss *xormStore) Get(ctx context.Context, query *thumbs.GetDashboardThumbnailCommand) (*thumbs.DashboardThumbnail, error) {
	err := ss.db.WithDbSession(ctx, func(sess *db.Session) error {
		result, err := findThumbnailByMeta(sess, query.DashboardThumbnailMeta)
		if err != nil {
			return err
		}
		query.Result = result
		return nil
	})

	return query.Result, err
}

func marshalDatasourceUids(dsUids []string) (string, error) {
	if dsUids == nil {
		return "", nil
	}

	b, err := json.Marshal(dsUids)
	if err != nil {
		return "", err
	}
	return string(b), nil
}

func (ss *xormStore) Save(ctx context.Context, cmd *thumbs.SaveDashboardThumbnailCommand) (*thumbs.DashboardThumbnail, error) {
	err := ss.db.WithTransactionalDbSession(ctx, func(sess *db.Session) error {
		existing, err := findThumbnailByMeta(sess, cmd.DashboardThumbnailMeta)

		if err != nil && !errors.Is(err, dashboards.ErrDashboardThumbnailNotFound) {
			return err
		}

		dsUids, err := marshalDatasourceUids(cmd.DatasourceUIDs)
		if err != nil {
			return err
		}

		if existing != nil {
			existing.Image = cmd.Image
			existing.MimeType = cmd.MimeType
			existing.Updated = time.Now()
			existing.DashboardVersion = cmd.DashboardVersion
			existing.DsUIDs = dsUids
			existing.State = thumbs.ThumbnailStateDefault
			_, err = sess.ID(existing.Id).Update(existing)
			cmd.Result = existing
			return err
		}

		thumb := &thumbs.DashboardThumbnail{}

		dash, err := findDashboardIdByThumbMeta(sess, cmd.DashboardThumbnailMeta)

		if err != nil {
			return err
		}

		thumb.Updated = time.Now()
		thumb.Theme = cmd.Theme
		thumb.Kind = cmd.Kind
		thumb.Image = cmd.Image
		thumb.DsUIDs = dsUids
		thumb.MimeType = cmd.MimeType
		thumb.DashboardId = dash.Id
		thumb.DashboardVersion = cmd.DashboardVersion
		thumb.State = thumbs.ThumbnailStateDefault
		thumb.PanelId = cmd.PanelID
		_, err = sess.Insert(thumb)
		cmd.Result = thumb
		return err
	})

	return cmd.Result, err
}

func (ss *xormStore) UpdateState(ctx context.Context, cmd *thumbs.UpdateThumbnailStateCommand) error {
	err := ss.db.WithTransactionalDbSession(ctx, func(sess *db.Session) error {
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

func (ss *xormStore) Count(ctx context.Context, cmd *thumbs.FindDashboardThumbnailCountCommand) (int64, error) {
	err := ss.db.WithDbSession(ctx, func(sess *db.Session) error {
		count, err := sess.Count(&thumbs.DashboardThumbnail{})
		if err != nil {
			return err
		}

		cmd.Result = count
		return nil
	})

	return cmd.Result, err
}

func (ss *xormStore) FindDashboardsWithStaleThumbnails(ctx context.Context, cmd *thumbs.FindDashboardsWithStaleThumbnailsCommand) ([]*thumbs.DashboardWithStaleThumbnail, error) {
	err := ss.db.WithDbSession(ctx, func(sess *db.Session) error {
		sess.Table("dashboard")
		sess.Join("LEFT", "dashboard_thumbnail", "dashboard.id = dashboard_thumbnail.dashboard_id AND dashboard_thumbnail.theme = ? AND dashboard_thumbnail.kind = ?", cmd.Theme, cmd.Kind)
		sess.Where("dashboard.is_folder = ?", ss.db.GetDialect().BooleanStr(false))

		query := "(dashboard.version != dashboard_thumbnail.dashboard_version " +
			"OR dashboard_thumbnail.state = ? " +
			"OR dashboard_thumbnail.id IS NULL"
		args := []interface{}{thumbs.ThumbnailStateStale}

		if cmd.IncludeThumbnailsWithEmptyDsUIDs {
			query += " OR dashboard_thumbnail.ds_uids = ? OR dashboard_thumbnail.ds_uids IS NULL"
			args = append(args, "")
		}
		sess.Where(query+")", args...)

		if !cmd.IncludeManuallyUploadedThumbnails {
			sess.Where("(dashboard_thumbnail.id is not null AND dashboard_thumbnail.dashboard_version != ?) "+
				"OR dashboard_thumbnail.id is null "+
				"OR dashboard_thumbnail.state = ?", thumbs.DashboardVersionForManualThumbnailUpload, thumbs.ThumbnailStateStale)
		}

		sess.Where("(dashboard_thumbnail.id IS NULL OR dashboard_thumbnail.state != ?)", thumbs.ThumbnailStateLocked)

		sess.Cols("dashboard.id",
			"dashboard.uid",
			"dashboard.org_id",
			"dashboard.version",
			"dashboard.slug")

		var result = make([]*thumbs.DashboardWithStaleThumbnail, 0)
		err := sess.Find(&result)

		if err != nil {
			return err
		}
		cmd.Result = result
		return err
	})

	return cmd.Result, err
}

func findThumbnailByMeta(sess *db.Session, meta thumbs.DashboardThumbnailMeta) (*thumbs.DashboardThumbnail, error) {
	result := &thumbs.DashboardThumbnail{}

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
		"dashboard_thumbnail.ds_uids",
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

func findDashboardIdByThumbMeta(sess *db.Session, meta thumbs.DashboardThumbnailMeta) (*dash, error) {
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
