package sqlstore

import (
	"context"
	"strings"

	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/setting"
)

func (ss *SQLStore) addDashboardVersionQueryAndCommandHandlers() {
	bus.AddHandlerCtx("sql", ss.GetDashboardVersion)
	bus.AddHandlerCtx("sql", ss.GetDashboardVersions)
	bus.AddHandlerCtx("sql", ss.DeleteExpiredVersions)
}

// GetDashboardVersion gets the dashboard version for the given dashboard ID and version number.
func (ss *SQLStore) GetDashboardVersion(ctx context.Context, query *models.GetDashboardVersionQuery) error {
	return ss.WithDbSession(ctx, func(sess *DBSession) error {
		version := models.DashboardVersion{}
		has, err := sess.Where("dashboard_version.dashboard_id=? AND dashboard_version.version=? AND dashboard.org_id=?", query.DashboardId, query.Version, query.OrgId).
			Join("LEFT", "dashboard", `dashboard.id = dashboard_version.dashboard_id`).
			Get(&version)

		if err != nil {
			return err
		}

		if !has {
			return models.ErrDashboardVersionNotFound
		}

		version.Data.Set("id", version.DashboardId)
		query.Result = &version
		return nil
	})
}

// GetDashboardVersions gets all dashboard versions for the given dashboard ID.
func (ss *SQLStore) GetDashboardVersions(ctx context.Context, query *models.GetDashboardVersionsQuery) error {
	return ss.WithDbSession(ctx, func(sess *DBSession) error {
		if query.Limit == 0 {
			query.Limit = 1000
		}

		err := sess.Table("dashboard_version").
			Select(`dashboard_version.id,
				dashboard_version.dashboard_id,
				dashboard_version.parent_version,
				dashboard_version.restored_from,
				dashboard_version.version,
				dashboard_version.created,
				dashboard_version.created_by as created_by_id,
				dashboard_version.message,
				dashboard_version.data,`+
				dialect.Quote("user")+`.login as created_by`).
			Join("LEFT", dialect.Quote("user"), `dashboard_version.created_by = `+dialect.Quote("user")+`.id`).
			Join("LEFT", "dashboard", `dashboard.id = dashboard_version.dashboard_id`).
			Where("dashboard_version.dashboard_id=? AND dashboard.org_id=?", query.DashboardId, query.OrgId).
			OrderBy("dashboard_version.version DESC").
			Limit(query.Limit, query.Start).
			Find(&query.Result)
		if err != nil {
			return err
		}

		if len(query.Result) < 1 {
			return models.ErrNoVersionsForDashboardId
		}
		return nil
	})
}

const MAX_VERSIONS_TO_DELETE_PER_BATCH = 100
const MAX_VERSION_DELETION_BATCHES = 50

func (ss *SQLStore) DeleteExpiredVersions(ctx context.Context, cmd *models.DeleteExpiredVersionsCommand) error {
	return ss.deleteExpiredVersions(ctx, cmd, MAX_VERSIONS_TO_DELETE_PER_BATCH, MAX_VERSION_DELETION_BATCHES)
}

func (ss *SQLStore) deleteExpiredVersions(ctx context.Context, cmd *models.DeleteExpiredVersionsCommand, perBatch int, maxBatches int) error {
	versionsToKeep := setting.DashboardVersionsToKeep
	if versionsToKeep < 1 {
		versionsToKeep = 1
	}

	for batch := 0; batch < maxBatches; batch++ {
		deleted := int64(0)

		batchErr := ss.WithTransactionalDbSession(ctx, func(sess *DBSession) error {
			// Idea of this query is finding version IDs to delete based on formula:
			// min_version_to_keep = min_version + (versions_count - versions_to_keep)
			// where version stats is processed for each dashboard. This guarantees that we keep at least versions_to_keep
			// versions, but in some cases (when versions are sparse) this number may be more.
			versionIdsToDeleteQuery := `SELECT id
				FROM dashboard_version, (
					SELECT dashboard_id, count(version) as count, min(version) as min
					FROM dashboard_version
					GROUP BY dashboard_id
				) AS vtd
				WHERE dashboard_version.dashboard_id=vtd.dashboard_id
				AND version < vtd.min + vtd.count - ?
				LIMIT ?`

			var versionIdsToDelete []interface{}
			err := sess.SQL(versionIdsToDeleteQuery, versionsToKeep, perBatch).Find(&versionIdsToDelete)
			if err != nil {
				return err
			}

			if len(versionIdsToDelete) < 1 {
				return nil
			}

			deleteExpiredSQL := `DELETE FROM dashboard_version WHERE id IN (?` + strings.Repeat(",?", len(versionIdsToDelete)-1) + `)`
			sqlOrArgs := append([]interface{}{deleteExpiredSQL}, versionIdsToDelete...)
			expiredResponse, err := sess.Exec(sqlOrArgs...)
			if err != nil {
				return err
			}

			deleted, err = expiredResponse.RowsAffected()
			return err
		})

		if batchErr != nil {
			return batchErr
		}

		cmd.DeletedRows += deleted

		if deleted < int64(perBatch) {
			break
		}
	}

	return nil
}
