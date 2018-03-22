package sqlstore

import (
	"strings"

	"github.com/grafana/grafana/pkg/bus"
	m "github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/setting"
)

func init() {
	bus.AddHandler("sql", GetDashboardVersion)
	bus.AddHandler("sql", GetDashboardVersions)
	bus.AddHandler("sql", DeleteExpiredVersions)
}

// GetDashboardVersion gets the dashboard version for the given dashboard ID and version number.
func GetDashboardVersion(query *m.GetDashboardVersionQuery) error {
	version := m.DashboardVersion{}
	has, err := x.Where("dashboard_version.dashboard_id=? AND dashboard_version.version=? AND dashboard.org_id=?", query.DashboardId, query.Version, query.OrgId).
		Join("LEFT", "dashboard", `dashboard.id = dashboard_version.dashboard_id`).
		Get(&version)

	if err != nil {
		return err
	}

	if !has {
		return m.ErrDashboardVersionNotFound
	}

	version.Data.Set("id", version.DashboardId)
	query.Result = &version
	return nil
}

// GetDashboardVersions gets all dashboard versions for the given dashboard ID.
func GetDashboardVersions(query *m.GetDashboardVersionsQuery) error {
	if query.Limit == 0 {
		query.Limit = 1000
	}

	err := x.Table("dashboard_version").
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
		Join("LEFT", "user", `dashboard_version.created_by = `+dialect.Quote("user")+`.id`).
		Join("LEFT", "dashboard", `dashboard.id = dashboard_version.dashboard_id`).
		Where("dashboard_version.dashboard_id=? AND dashboard.org_id=?", query.DashboardId, query.OrgId).
		OrderBy("dashboard_version.version DESC").
		Limit(query.Limit, query.Start).
		Find(&query.Result)
	if err != nil {
		return err
	}

	if len(query.Result) < 1 {
		return m.ErrNoVersionsForDashboardId
	}
	return nil
}

const MAX_VERSIONS_TO_DELETE = 100

func DeleteExpiredVersions(cmd *m.DeleteExpiredVersionsCommand) error {
	return inTransaction(func(sess *DBSession) error {
		versionsToKeep := setting.DashboardVersionsToKeep
		if versionsToKeep < 1 {
			versionsToKeep = 1
		}

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
			AND version < vtd.min + vtd.count - ?`

		var versionIdsToDelete []interface{}
		err := sess.SQL(versionIdsToDeleteQuery, versionsToKeep).Find(&versionIdsToDelete)
		if err != nil {
			return err
		}

		// Don't delete more than MAX_VERSIONS_TO_DELETE version per time
		if len(versionIdsToDelete) > MAX_VERSIONS_TO_DELETE {
			versionIdsToDelete = versionIdsToDelete[:MAX_VERSIONS_TO_DELETE]
		}

		if len(versionIdsToDelete) > 0 {
			deleteExpiredSql := `DELETE FROM dashboard_version WHERE id IN (?` + strings.Repeat(",?", len(versionIdsToDelete)-1) + `)`
			expiredResponse, err := sess.Exec(deleteExpiredSql, versionIdsToDelete...)
			if err != nil {
				return err
			}
			cmd.DeletedRows, _ = expiredResponse.RowsAffected()
		}

		return nil
	})
}
