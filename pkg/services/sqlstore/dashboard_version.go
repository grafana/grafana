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

func DeleteExpiredVersions(cmd *m.DeleteExpiredVersionsCommand) error {
	return inTransaction(func(sess *DBSession) error {
		expiredCount := int64(0)
		versions := []DashboardVersionExp{}
		versionsToKeep := setting.DashboardVersionsToKeep

		if versionsToKeep < 1 {
			versionsToKeep = 1
		}

		err := sess.Table("dashboard_version").
			Select("dashboard_version.id, dashboard_version.version, dashboard_version.dashboard_id").
			Where(`dashboard_id IN (
			SELECT dashboard_id FROM dashboard_version
			GROUP BY dashboard_id HAVING COUNT(dashboard_version.id) > ?
		)`, versionsToKeep).
			Desc("dashboard_version.dashboard_id", "dashboard_version.version").
			Find(&versions)

		if err != nil {
			return err
		}

		// Keep last versionsToKeep versions and delete other
		versionIdsToDelete := getVersionIDsToDelete(versions, versionsToKeep)
		if len(versionIdsToDelete) > 0 {
			deleteExpiredSql := `DELETE FROM dashboard_version WHERE id IN (?` + strings.Repeat(",?", len(versionIdsToDelete)-1) + `)`
			expiredResponse, err := sess.Exec(deleteExpiredSql, versionIdsToDelete...)
			if err != nil {
				return err
			}
			expiredCount, _ = expiredResponse.RowsAffected()
			sqlog.Debug("Deleted old/expired dashboard versions", "expired", expiredCount)
		}

		return nil
	})
}

// Short version of DashboardVersion for getting expired versions
type DashboardVersionExp struct {
	Id          int64 `json:"id"`
	DashboardId int64 `json:"dashboardId"`
	Version     int   `json:"version"`
}

func getVersionIDsToDelete(versions []DashboardVersionExp, versionsToKeep int) []interface{} {
	versionIds := make([]interface{}, 0)

	if len(versions) == 0 {
		return versionIds
	}

	currentDashboard := versions[0].DashboardId
	count := 0
	for _, v := range versions {
		if v.DashboardId == currentDashboard {
			count++
		} else {
			count = 1
			currentDashboard = v.DashboardId
		}
		if count > versionsToKeep {
			versionIds = append(versionIds, v.Id)
		}
	}

	return versionIds
}
