package database

import (
	"context"

	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/services/dashboards"
)

// GetDashboardACLInfoList returns a list of permissions for a dashboard. They can be fetched from three
// different places.
// 1) Permissions for the dashboard
// 2) permissions for its parent folder
// 3) if no specific permissions have been set for the dashboard or its parent folder then get the default permissions
func (d *dashboardStore) GetDashboardACLInfoList(ctx context.Context, query *dashboards.GetDashboardACLInfoListQuery) ([]*dashboards.DashboardACLInfoDTO, error) {
	queryResult := make([]*dashboards.DashboardACLInfoDTO, 0)
	outerErr := d.store.WithDbSession(ctx, func(dbSession *db.Session) error {
		falseStr := d.store.GetDialect().BooleanStr(false)

		if query.DashboardID == 0 {
			sql := `SELECT
		da.id,
		da.org_id,
		da.dashboard_id,
		da.user_id,
		da.team_id,
		da.permission,
		da.role,
		da.created,
		da.updated,
		'' as user_login,
		'' as user_email,
		'' as team,
		'' as title,
		'' as slug,
		'' as uid,` +
				falseStr + ` AS is_folder,` +
				falseStr + ` AS inherited
		FROM dashboard_acl as da
		WHERE da.dashboard_id = -1`
			return dbSession.SQL(sql).Find(&queryResult)
		}

		rawSQL := `
			-- get permissions for the dashboard and its parent folder
			SELECT
				da.id,
				da.org_id,
				da.dashboard_id,
				da.user_id,
				da.team_id,
				da.permission,
				da.role,
				da.created,
				da.updated,
				u.login AS user_login,
				u.email AS user_email,
				ug.name AS team,
				ug.email AS team_email,
				d.title,
				d.slug,
				d.uid,
				d.is_folder,
				CASE WHEN (da.dashboard_id = -1 AND d.folder_id > 0) OR da.dashboard_id = d.folder_id THEN ` + d.store.GetDialect().BooleanStr(true) + ` ELSE ` + falseStr + ` END AS inherited
			FROM dashboard as d
				LEFT JOIN dashboard folder on folder.id = d.folder_id
				LEFT JOIN dashboard_acl AS da ON
				da.dashboard_id = d.id OR
				da.dashboard_id = d.folder_id OR
				(
					-- include default permissions -->
					da.org_id = -1 AND (
					  (folder.id IS NOT NULL AND folder.has_acl = ` + falseStr + `) OR
					  (folder.id IS NULL AND d.has_acl = ` + falseStr + `)
					)
				)
				LEFT JOIN ` + d.store.GetDialect().Quote("user") + ` AS u ON u.id = da.user_id
				LEFT JOIN team ug on ug.id = da.team_id
			WHERE d.org_id = ? AND d.id = ? AND da.id IS NOT NULL
			ORDER BY da.id ASC
			`

		return dbSession.SQL(rawSQL, query.OrgID, query.DashboardID).Find(&queryResult)
	})

	if outerErr != nil {
		return nil, outerErr
	}

	for _, p := range queryResult {
		p.PermissionName = p.Permission.String()
	}

	return queryResult, nil
}

func (d *dashboardStore) DeleteACLByUser(ctx context.Context, userID int64) error {
	return d.store.WithTransactionalDbSession(ctx, func(sess *db.Session) error {
		var rawSQL = "DELETE FROM dashboard_acl WHERE user_id = ?"
		_, err := sess.Exec(rawSQL, userID)
		return err
	})
}
