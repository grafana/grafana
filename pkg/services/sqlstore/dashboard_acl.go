package sqlstore

import (
	"time"

	"github.com/go-xorm/xorm"
	"github.com/grafana/grafana/pkg/bus"
	m "github.com/grafana/grafana/pkg/models"
)

func init() {
	bus.AddHandler("sql", AddOrUpdateDashboardPermission)
	bus.AddHandler("sql", RemoveDashboardPermission)
	bus.AddHandler("sql", GetDashboardPermissions)
}

func AddOrUpdateDashboardPermission(cmd *m.AddOrUpdateDashboardPermissionCommand) error {
	return inTransaction(func(sess *xorm.Session) error {
		if res, err := sess.Query("SELECT 1 from dashboard_acl WHERE dashboard_id =? and (user_group_id=? or user_id=?)", cmd.DashboardId, cmd.UserGroupId, cmd.UserId); err != nil {
			return err
		} else if len(res) == 1 {
			entity := m.DashboardAcl{
				Permissions: cmd.PermissionType,
			}
			if _, err := sess.Cols("permissions").Where("dashboard_id =? and (user_group_id=? or user_id=?)", cmd.DashboardId, cmd.UserGroupId, cmd.UserId).Update(&entity); err != nil {
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

		_, err := sess.Cols(cols...).Insert(&entity)
		if err != nil {
			return err
		}

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
	return inTransaction(func(sess *xorm.Session) error {
		var rawSql = "DELETE FROM dashboard_acl WHERE dashboard_id =? and (user_group_id=? or user_id=?)"
		_, err := sess.Exec(rawSql, cmd.DashboardId, cmd.UserGroupId, cmd.UserId)
		if err != nil {
			return err
		}

		return err
	})
}

func GetDashboardPermissions(query *m.GetDashboardPermissionsQuery) error {
	sess := x.Where("dashboard_id=?", query.DashboardId)
	query.Result = make([]*m.DashboardAcl, 0)
	return sess.Find(&query.Result)
}
