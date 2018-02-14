package sqlstore

import (
	"time"

	"github.com/grafana/grafana/pkg/bus"
	m "github.com/grafana/grafana/pkg/models"
)

func init() {
	bus.AddHandler("sql", SetDashboardAcl)
	bus.AddHandler("sql", UpdateDashboardAcl)
	bus.AddHandler("sql", RemoveDashboardAcl)
	bus.AddHandler("sql", GetDashboardAclInfoList)
}

func UpdateDashboardAcl(cmd *m.UpdateDashboardAclCommand) error {
	return inTransaction(func(sess *DBSession) error {
		// delete existing items
		_, err := sess.Exec("DELETE FROM dashboard_acl WHERE dashboard_id=?", cmd.DashboardId)
		if err != nil {
			return err
		}

		for _, item := range cmd.Items {
			if item.UserId == 0 && item.TeamId == 0 && !item.Role.IsValid() {
				return m.ErrDashboardAclInfoMissing
			}

			if item.DashboardId == 0 {
				return m.ErrDashboardPermissionDashboardEmpty
			}

			sess.Nullable("user_id", "team_id")
			if _, err := sess.Insert(item); err != nil {
				return err
			}
		}

		// Update dashboard HasAcl flag
		dashboard := m.Dashboard{HasAcl: true}
		if _, err := sess.Cols("has_acl").Where("id=?", cmd.DashboardId).Update(&dashboard); err != nil {
			return err
		}
		return nil
	})
}

func SetDashboardAcl(cmd *m.SetDashboardAclCommand) error {
	return inTransaction(func(sess *DBSession) error {
		if cmd.UserId == 0 && cmd.TeamId == 0 {
			return m.ErrDashboardAclInfoMissing
		}

		if cmd.DashboardId == 0 {
			return m.ErrDashboardPermissionDashboardEmpty
		}

		if res, err := sess.Query("SELECT 1 from "+dialect.Quote("dashboard_acl")+" WHERE dashboard_id =? and (team_id=? or user_id=?)", cmd.DashboardId, cmd.TeamId, cmd.UserId); err != nil {
			return err
		} else if len(res) == 1 {

			entity := m.DashboardAcl{
				Permission: cmd.Permission,
				Updated:    time.Now(),
			}

			if _, err := sess.Cols("updated", "permission").Where("dashboard_id =? and (team_id=? or user_id=?)", cmd.DashboardId, cmd.TeamId, cmd.UserId).Update(&entity); err != nil {
				return err
			}

			return nil
		}

		entity := m.DashboardAcl{
			OrgId:       cmd.OrgId,
			TeamId:      cmd.TeamId,
			UserId:      cmd.UserId,
			Created:     time.Now(),
			Updated:     time.Now(),
			DashboardId: cmd.DashboardId,
			Permission:  cmd.Permission,
		}

		cols := []string{"org_id", "created", "updated", "dashboard_id", "permission"}

		if cmd.UserId != 0 {
			cols = append(cols, "user_id")
		}

		if cmd.TeamId != 0 {
			cols = append(cols, "team_id")
		}

		_, err := sess.Cols(cols...).Insert(&entity)
		if err != nil {
			return err
		}

		cmd.Result = entity

		// Update dashboard HasAcl flag
		dashboard := m.Dashboard{
			HasAcl: true,
		}

		if _, err := sess.Cols("has_acl").Where("id=? OR folder_id=?", cmd.DashboardId, cmd.DashboardId).Update(&dashboard); err != nil {
			return err
		}

		return nil
	})
}

// RemoveDashboardAcl removes a specified permission from the dashboard acl
func RemoveDashboardAcl(cmd *m.RemoveDashboardAclCommand) error {
	return inTransaction(func(sess *DBSession) error {
		var rawSQL = "DELETE FROM " + dialect.Quote("dashboard_acl") + " WHERE org_id =? and id=?"
		_, err := sess.Exec(rawSQL, cmd.OrgId, cmd.AclId)
		if err != nil {
			return err
		}

		return err
	})
}

// GetDashboardAclInfoList returns a list of permissions for a dashboard. They can be fetched from three
// different places.
// 1) Permissions for the dashboard
// 2) permissions for its parent folder
// 3) if no specific permissions have been set for the dashboard or its parent folder then get the default permissions
func GetDashboardAclInfoList(query *m.GetDashboardAclInfoListQuery) error {
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
			falseStr + ` AS is_folder
		FROM dashboard_acl as da
		WHERE da.dashboard_id = -1`
		query.Result = make([]*m.DashboardAclInfoDTO, 0)
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
				d.title,
				d.slug,
				d.uid,
				d.is_folder
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
			ORDER BY 1 ASC
			`

		query.Result = make([]*m.DashboardAclInfoDTO, 0)
		err = x.SQL(rawSQL, query.OrgId, query.DashboardId).Find(&query.Result)
	}

	for _, p := range query.Result {
		p.PermissionName = p.Permission.String()
	}

	return err
}
