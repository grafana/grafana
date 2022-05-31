package sqlstore

import (
	"context"

	"github.com/grafana/grafana/pkg/models"
)

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
