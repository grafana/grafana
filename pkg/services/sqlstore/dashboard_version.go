package sqlstore

import (
	"github.com/grafana/grafana/pkg/bus"
	m "github.com/grafana/grafana/pkg/models"
)

func init() {
	bus.AddHandler("sql", GetDashboardVersion)
	bus.AddHandler("sql", GetDashboardVersions)
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
