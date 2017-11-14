package sqlstore

import (
	"fmt"
	"math"
	"sort"
	"strconv"
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
		var expiredCount int64 = 0
		var versions []DashboardVersionExp

		// Don't clean up if user set versions_to_keep to 2147483647 (MaxInt32)
		if versionsToKeep := setting.DashboardVersionsToKeep; versionsToKeep < math.MaxInt32 {
			// Get dashboard ids to clean up
			affectedDashboardsQuery := fmt.Sprintf(`SELECT dashboard_id FROM dashboard_version
				GROUP BY dashboard_id HAVING COUNT(dashboard_version.id)>%d`, versionsToKeep)

			err := x.Table("dashboard_version").
				Select("dashboard_version.id, dashboard_version.version, dashboard_version.dashboard_id").
				Where(fmt.Sprintf("dashboard_id IN (%s)", affectedDashboardsQuery)).
				Find(&versions)

			if err != nil {
				return err
			}

			// Keep last versionsToKeep versions and delete other
			versionIdsToDelete := getVersionIDsToDelete(versions, versionsToKeep)
			versionIdsToDeleteStr := getVersionIDsToDeleteStr(versionIdsToDelete)
			deleteExpiredSql := fmt.Sprintf("DELETE FROM dashboard_version WHERE id IN (%v)", strings.Join(versionIdsToDeleteStr, ", "))
			expiredResponse, err := x.Exec(deleteExpiredSql)
			if err != nil {
				return err
			}
			expiredCount, _ = expiredResponse.RowsAffected()
		}

		sqlog.Debug("Deleted old/expired dashboard versions", "expired", expiredCount)
		return nil
	})
}

// Short version of DashboardVersion for getting expired versions
type DashboardVersionExp struct {
	Id          int64 `json:"id"`
	DashboardId int64 `json:"dashboardId"`
	Version     int   `json:"version"`
}

// Implement sort.Interface for []DashboardVersionExp (sort by Version field)
type ByVersion []DashboardVersionExp

func (v ByVersion) Len() int {
	return len(v)
}

func (v ByVersion) Swap(i, j int) {
	v[i], v[j] = v[j], v[i]
}

func (v ByVersion) Less(i, j int) bool {
	return v[i].Version < v[j].Version
}

func getVersionIDsToDelete(versions []DashboardVersionExp, versionsToKeep int) []int64 {
	dashboards := make(map[int64][]DashboardVersionExp)
	for _, v := range versions {
		elem, present := dashboards[v.DashboardId]
		if present {
			dashboards[v.DashboardId] = append(elem, v)
		} else {
			dashboards[v.DashboardId] = []DashboardVersionExp{v}
		}
	}

	versionIds := make([]int64, 0)
	for dashboard_id, versions := range dashboards {
		sort.Sort(sort.Reverse(ByVersion(versions)))
		dashboards[dashboard_id] = versions[versionsToKeep:]
		for _, ver := range dashboards[dashboard_id] {
			versionIds = append(versionIds, ver.Id)
		}
	}

	return versionIds
}

func getVersionIDsToDeleteStr(versionIds []int64) []string {
	var versionIdsToDeleteStr []string
	for _, versionId := range versionIds {
		versionIdsToDeleteStr = append(versionIdsToDeleteStr, strconv.FormatInt(versionId, 10))
	}
	return versionIdsToDeleteStr
}
