package dashverimpl

import (
	"context"
	"strings"

	"github.com/grafana/grafana/pkg/infra/db"
	dashver "github.com/grafana/grafana/pkg/services/dashboardversion"
	"github.com/grafana/grafana/pkg/services/sqlstore/migrator"
)

type sqlStore struct {
	db      db.DB
	dialect migrator.Dialect
}

func (ss *sqlStore) Get(ctx context.Context, query *dashver.GetDashboardVersionQuery) (*dashver.DashboardVersion, error) {
	var version dashver.DashboardVersion
	err := ss.db.WithDbSession(ctx, func(sess *db.Session) error {
		has, err := sess.Where("dashboard_version.dashboard_id=? AND dashboard_version.version=? AND dashboard.org_id=?", query.DashboardID, query.Version, query.OrgID).
			Join("LEFT", "dashboard", `dashboard.id = dashboard_version.dashboard_id`).
			Get(&version)

		if err != nil {
			return err
		}

		if !has {
			return dashver.ErrDashboardVersionNotFound
		}
		return nil
	})
	if err != nil {
		return nil, err
	}
	return &version, nil
}

func (ss *sqlStore) GetBatch(ctx context.Context, cmd *dashver.DeleteExpiredVersionsCommand, perBatch int, versionsToKeep int) ([]interface{}, error) {
	var versionIds []interface{}
	err := ss.db.WithTransactionalDbSession(ctx, func(sess *db.Session) error {
		versionIdsToDeleteQuery := `SELECT id
			FROM dashboard_version, (
				SELECT dashboard_id, count(version) as count, min(version) as min
				FROM dashboard_version
				GROUP BY dashboard_id
			) AS vtd
			WHERE dashboard_version.dashboard_id=vtd.dashboard_id
			AND version < vtd.min + vtd.count - ?
			LIMIT ?`

		err := sess.SQL(versionIdsToDeleteQuery, versionsToKeep, perBatch).Find(&versionIds)
		return err
	})
	return versionIds, err
}

func (ss *sqlStore) DeleteBatch(ctx context.Context, cmd *dashver.DeleteExpiredVersionsCommand, versionIdsToDelete []interface{}) (int64, error) {
	var deleted int64
	err := ss.db.WithTransactionalDbSession(ctx, func(sess *db.Session) error {
		deleteExpiredSQL := `DELETE FROM dashboard_version WHERE id IN (?` + strings.Repeat(",?", len(versionIdsToDelete)-1) + `)`
		sqlOrArgs := append([]interface{}{deleteExpiredSQL}, versionIdsToDelete...)
		expiredResponse, err := sess.Exec(sqlOrArgs...)
		if err != nil {
			return err
		}

		deleted, err = expiredResponse.RowsAffected()
		return err
	})
	return deleted, err
}

func (ss *sqlStore) List(ctx context.Context, query *dashver.ListDashboardVersionsQuery) ([]*dashver.DashboardVersion, error) {
	var dashboardVersion []*dashver.DashboardVersion
	err := ss.db.WithDbSession(ctx, func(sess *db.Session) error {
		err := sess.Table("dashboard_version").
			Select(`dashboard_version.id,
				dashboard_version.dashboard_id,
				dashboard_version.parent_version,
				dashboard_version.restored_from,
				dashboard_version.version,
				dashboard_version.created,
				dashboard_version.created_by,
				dashboard_version.message,
				dashboard_version.data`).
			Join("LEFT", "dashboard", `dashboard.id = dashboard_version.dashboard_id`).
			Where("dashboard_version.dashboard_id=? AND dashboard.org_id=?", query.DashboardID, query.OrgID).
			OrderBy("dashboard_version.version DESC").
			Limit(query.Limit, query.Start).
			Find(&dashboardVersion)
		if err != nil {
			return err
		}

		if len(dashboardVersion) < 1 {
			return dashver.ErrNoVersionsForDashboardID
		}
		return nil
	})
	if err != nil {
		return nil, err
	}
	return dashboardVersion, nil
}
