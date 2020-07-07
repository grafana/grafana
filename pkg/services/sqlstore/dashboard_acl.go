package sqlstore

import (
	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/models"
)

func init() {
	bus.AddHandler("sql", UpdateDashboardAcl)
	bus.AddHandler("sql", GetDashboardAclInfoList)
}

func UpdateDashboardAcl(cmd *models.UpdateDashboardAclCommand) error {
	return inTransaction(func(sess *DBSession) error {
		// delete existing items
		_, err := sess.Exec("DELETE FROM dashboard_acl WHERE dashboard_id=?", cmd.DashboardId)
		if err != nil {
			return err
		}

		for _, item := range cmd.Items {
			if item.UserId == 0 && item.TeamId == 0 && (item.Role == nil || !item.Role.IsValid()) {
				return models.ErrDashboardAclInfoMissing
			}

			if item.DashboardId == 0 {
				return models.ErrDashboardPermissionDashboardEmpty
			}

			sess.Nullable("user_id", "team_id")
			if _, err := sess.Insert(item); err != nil {
				return err
			}
		}

		// Update dashboard HasAcl flag
		dashboard := models.Dashboard{HasAcl: true}
		_, err = sess.Cols("has_acl").Where("id=?", cmd.DashboardId).Update(&dashboard)
		return err
	})
}

// GetDashboardAclInfoList returns a list of permissions for a dashboard. They can be fetched from three
// different places.
// 1) Permissions for the dashboard
// 2) permissions for its parent folder
// 3) if no specific permissions have been set for the dashboard or its parent folder then get the default permissions
func GetDashboardAclInfoList(query *models.GetDashboardAclInfoListQuery) error {
	var err error

	falseStr := dialect.BooleanStr(false)

	if query.DashboardId == 0 {
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
		query.Result = make([]*models.DashboardAclInfoDTO, 0)
		err = x.SQL(sql).Find(&query.Result)
	} else {
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

		query.Result = make([]*models.DashboardAclInfoDTO, 0)
		err = x.SQL(rawSQL, query.OrgId, query.DashboardId).Find(&query.Result)
	}

	for _, p := range query.Result {
		p.PermissionName = p.Permission.String()
	}

	return err
}
