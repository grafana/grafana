package sqlstore

import (
	"context"
	"fmt"

	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/models"
)

func (ss *SQLStore) addDashboardACLQueryAndCommandHandlers() {
	bus.AddHandler("sql", ss.GetDashboardAclInfoList)
}

func (ss *SQLStore) UpdateDashboardACL(ctx context.Context, dashboardID int64, items []*models.DashboardAcl) error {
	return ss.UpdateDashboardACLCtx(ctx, dashboardID, items)
}

func (ss *SQLStore) UpdateDashboardACLCtx(ctx context.Context, dashboardID int64, items []*models.DashboardAcl) error {
	return ss.WithTransactionalDbSession(ctx, func(sess *DBSession) error {
		// delete existing items
		_, err := sess.Exec("DELETE FROM dashboard_acl WHERE dashboard_id=?", dashboardID)
		if err != nil {
			return fmt.Errorf("deleting from dashboard_acl failed: %w", err)
		}

		for _, item := range items {
			if item.UserID == 0 && item.TeamID == 0 && (item.Role == nil || !item.Role.IsValid()) {
				return models.ErrDashboardAclInfoMissing
			}

			if item.DashboardID == 0 {
				return models.ErrDashboardPermissionDashboardEmpty
			}

			sess.Nullable("user_id", "team_id")
			if _, err := sess.Insert(item); err != nil {
				return err
			}
		}

		// Update dashboard HasAcl flag
		dashboard := models.Dashboard{HasAcl: true}
		_, err = sess.Cols("has_acl").Where("id=?", dashboardID).Update(&dashboard)
		return err
	})
}

// GetDashboardAclInfoList returns a list of permissions for a dashboard. They can be fetched from three
// different places.
// 1) Permissions for the dashboard
// 2) permissions for its parent folder
// 3) if no specific permissions have been set for the dashboard or its parent folder then get the default permissions
func (ss *SQLStore) GetDashboardAclInfoList(ctx context.Context, query *models.GetDashboardAclInfoListQuery) error {
	outerErr := ss.WithDbSession(ctx, func(dbSession *DBSession) error {
		query.Result = make([]*models.DashboardAclInfoDTO, 0)
		falseStr := dialect.BooleanStr(false)

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
			return dbSession.SQL(sql).Find(&query.Result)
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
				CASE WHEN (da.dashboard_id = -1 AND d.folder_id > 0) OR da.dashboard_id = d.folder_id THEN ` + dialect.BooleanStr(true) + ` ELSE ` + falseStr + ` END AS inherited
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
				LEFT JOIN ` + dialect.Quote("user") + ` AS u ON u.id = da.user_id
				LEFT JOIN team ug on ug.id = da.team_id
			WHERE d.org_id = ? AND d.id = ? AND da.id IS NOT NULL
			ORDER BY da.id ASC
			`

		return dbSession.SQL(rawSQL, query.OrgID, query.DashboardID).Find(&query.Result)
	})

	if outerErr != nil {
		return outerErr
	}

	for _, p := range query.Result {
		p.PermissionName = p.Permission.String()
	}

	return nil
}
