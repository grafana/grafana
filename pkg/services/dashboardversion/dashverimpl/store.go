package dashverimpl

import (
	"context"
	"strings"

	dashver "github.com/grafana/grafana/pkg/services/dashboardversion"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/services/sqlstore/db"
)

type store interface {
	Get(context.Context, *dashver.GetDashboardVersionQuery) (*dashver.DashboardVersion, error)
	GetBatch(context.Context, *dashver.DeleteExpiredVersionsCommand, int, int) ([]interface{}, error)
	DeleteBatch(context.Context, *dashver.DeleteExpiredVersionsCommand, []interface{}) (int64, error)
}

type sqlStore struct {
	db db.DB
}

func (ss *sqlStore) Get(ctx context.Context, query *dashver.GetDashboardVersionQuery) (*dashver.DashboardVersion, error) {
	var version dashver.DashboardVersion
	err := ss.db.WithDbSession(ctx, func(sess *sqlstore.DBSession) error {
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
	err := ss.db.WithTransactionalDbSession(ctx, func(sess *sqlstore.DBSession) error {
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
	err := ss.db.WithTransactionalDbSession(ctx, func(sess *sqlstore.DBSession) error {
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
