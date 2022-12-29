package dashverimpl

import (
	"context"
	"database/sql"
	"errors"
	"strings"

	dashver "github.com/grafana/grafana/pkg/services/dashboardversion"
	"github.com/grafana/grafana/pkg/services/sqlstore/session"
)

type sqlxStore struct {
	sess *session.SessionDB
}

func (ss *sqlxStore) Get(ctx context.Context, query *dashver.GetDashboardVersionQuery) (*dashver.DashboardVersion, error) {
	var version dashver.DashboardVersion
	qr := `SELECT dashboard_version.* 
	FROM dashboard_version
	LEFT JOIN dashboard ON dashboard.id=dashboard_version.dashboard_id
	WHERE dashboard_version.dashboard_id=? AND dashboard_version.version=? AND dashboard.org_id=? 
	`
	err := ss.sess.Get(ctx, &version, qr, query.DashboardID, query.Version, query.OrgID)
	if err != nil && errors.Is(err, sql.ErrNoRows) {
		return nil, dashver.ErrDashboardVersionNotFound
	}
	return &version, err
}

func (ss *sqlxStore) GetBatch(ctx context.Context, cmd *dashver.DeleteExpiredVersionsCommand, perBatch int, versionsToKeep int) ([]interface{}, error) {
	var versionIds []interface{}
	versionIdsToDeleteQuery := `SELECT id
	FROM dashboard_version, (
		SELECT dashboard_id, count(version) as count, min(version) as min
		FROM dashboard_version
		GROUP BY dashboard_id
	) AS vtd
	WHERE dashboard_version.dashboard_id=vtd.dashboard_id
	AND version < vtd.min + vtd.count - ?
	LIMIT ?`
	err := ss.sess.Get(ctx, &versionIds, versionIdsToDeleteQuery, versionsToKeep, perBatch)
	return versionIds, err
}

// This service is used by cleanup which need to belong to the same transaction
// Here we need to make sure that the transaction is shared between services
func (ss *sqlxStore) DeleteBatch(ctx context.Context, cmd *dashver.DeleteExpiredVersionsCommand, versionIdsToDelete []interface{}) (int64, error) {
	var deleted int64
	err := ss.sess.WithTransaction(ctx, func(tx *session.SessionTx) error {
		deleteExpiredSQL := `DELETE FROM dashboard_version WHERE id IN (?` + strings.Repeat(",?", len(versionIdsToDelete)-1) + `)`
		expiredResponse, err := tx.Exec(ctx, deleteExpiredSQL, versionIdsToDelete...)
		if err != nil {
			return err
		}
		deleted, err = expiredResponse.RowsAffected()
		return err
	})
	return deleted, err
}

func (ss *sqlxStore) List(ctx context.Context, query *dashver.ListDashboardVersionsQuery) ([]*dashver.DashboardVersion, error) {
	var dashboardVersion []*dashver.DashboardVersion
	qr := `SELECT dashboard_version.id,
				dashboard_version.dashboard_id,
				dashboard_version.parent_version,
				dashboard_version.restored_from,
				dashboard_version.version,
				dashboard_version.created,
				dashboard_version.created_by,
				dashboard_version.message
			FROM dashboard_version
			LEFT JOIN dashboard ON dashboard.id = dashboard_version.dashboard_id
			WHERE dashboard_version.dashboard_id=? AND dashboard.org_id=?
			ORDER BY dashboard_version.version DESC
			LIMIT ? OFFSET ?`

	err := ss.sess.Select(ctx, &dashboardVersion, qr, query.DashboardID, query.OrgID, query.Limit, query.Start)
	if err != nil {
		return nil, err
	}
	if len(dashboardVersion) < 1 {
		return nil, dashver.ErrNoVersionsForDashboardID
	}
	return dashboardVersion, nil
}
