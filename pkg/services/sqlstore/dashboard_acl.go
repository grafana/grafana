package sqlstore

import (
	"time"

	"github.com/grafana/grafana/pkg/bus"
	m "github.com/grafana/grafana/pkg/models"
)

func init() {
	bus.AddHandler("sql", AddOrUpdateDashboardPermission)
	bus.AddHandler("sql", RemoveDashboardPermission)
	bus.AddHandler("sql", GetDashboardPermissions)
}

func AddOrUpdateDashboardPermission(cmd *m.AddOrUpdateDashboardPermissionCommand) error {
	return inTransaction(func(sess *DBSession) error {
		if cmd.UserId == 0 && cmd.UserGroupId == 0 {
			return m.ErrDashboardPermissionUserOrUserGroupEmpty
		}

		if res, err := sess.Query("SELECT 1 from "+dialect.Quote("dashboard_acl")+" WHERE dashboard_id =? and (user_group_id=? or user_id=?)", cmd.DashboardId, cmd.UserGroupId, cmd.UserId); err != nil {
			return err
		} else if len(res) == 1 {
			entity := m.DashboardAcl{
				Permissions: cmd.PermissionType,
				Updated:     time.Now(),
			}
			if _, err := sess.Cols("updated", "permissions").Where("dashboard_id =? and (user_group_id=? or user_id=?)", cmd.DashboardId, cmd.UserGroupId, cmd.UserId).Update(&entity); err != nil {
				return err
			}

			return nil
		}

		entity := m.DashboardAcl{
			OrgId:       cmd.OrgId,
			UserGroupId: cmd.UserGroupId,
			UserId:      cmd.UserId,
			Created:     time.Now(),
			Updated:     time.Now(),
			DashboardId: cmd.DashboardId,
			Permissions: cmd.PermissionType,
		}

		cols := []string{"org_id", "created", "updated", "dashboard_id", "permissions"}

		if cmd.UserId != 0 {
			cols = append(cols, "user_id")
		}

		if cmd.UserGroupId != 0 {
			cols = append(cols, "user_group_id")
		}

		entityId, err := sess.Cols(cols...).Insert(&entity)
		if err != nil {
			return err
		}
		cmd.Result = entity
		cmd.Result.Id = entityId

		// Update dashboard HasAcl flag
		dashboard := m.Dashboard{
			HasAcl: true,
		}
		if _, err := sess.Cols("has_acl").Where("id=? OR parent_id=?", cmd.DashboardId, cmd.DashboardId).Update(&dashboard); err != nil {
			return err
		}

		return nil
	})
}

func RemoveDashboardPermission(cmd *m.RemoveDashboardPermissionCommand) error {
	return inTransaction(func(sess *DBSession) error {
		var rawSQL = "DELETE FROM " + dialect.Quote("dashboard_acl") + " WHERE dashboard_id =? and (user_group_id=? or user_id=?)"
		_, err := sess.Exec(rawSQL, cmd.DashboardId, cmd.UserGroupId, cmd.UserId)
		if err != nil {
			return err
		}

		return err
	})
}

func GetDashboardPermissions(query *m.GetDashboardPermissionsQuery) error {
	rawSQL := `SELECT
  da.id,
  da.org_id,
  da.id,
  da.dashboard_id,
  da.user_id,
  da.user_group_id,
  da.permissions,
  da.created,
  da.updated,
  u.login AS user_login,
  u.email AS user_email,
  ug.name AS user_group
  FROM` + dialect.Quote("dashboard_acl") + ` as da
  LEFT OUTER JOIN ` + dialect.Quote("user") + ` AS u ON u.id = da.user_id
  LEFT OUTER JOIN user_group ug on ug.id = da.user_group_id
  WHERE dashboard_id=?`

	query.Result = make([]*m.DashboardAclInfoDTO, 0)

	err := x.SQL(rawSQL, query.DashboardId).Find(&query.Result)

	for _, p := range query.Result {
		p.PermissionName = p.Permissions.String()
	}

	return err
}
