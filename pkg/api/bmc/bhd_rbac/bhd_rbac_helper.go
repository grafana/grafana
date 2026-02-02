package bhd_rbac

import (
	"context"
	"errors"
	"strconv"

	"github.com/grafana/grafana/pkg/api/bmc/bhd_rbac/bhd_permissions"
	"github.com/grafana/grafana/pkg/bmc/audit"
	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/infra/log"
	contextmodel "github.com/grafana/grafana/pkg/services/contexthandler/model"
	"github.com/grafana/grafana/pkg/services/sqlstore"
)

var Log = log.New("bhd-rbac")

func CreateRoleAudit(c *contextmodel.ReqContext, roleName string, err error) {
	audit.RoleCreateAudit(c, roleName, err)
}

func UpdateRoleAudit(c *contextmodel.ReqContext, roleName string, err error) {
	audit.RoleUpdateAudit(c, roleName, err)
}

func DeleteRoleAudit(c *contextmodel.ReqContext, roleName string, err error) {
	audit.RoleDeleteAudit(c, roleName, err)
}

func ManageRolePermissionsAudit(c *contextmodel.ReqContext, withDbSession bhd_permissions.WithDbSession, roleID int64, permissions []string, err error) {
	roleName, roleGetErr := GetRoleNameByID(c, withDbSession, roleID, "name")
	if roleGetErr != nil {
		Log.Error("Error while getting role details for audit")
	}
	audit.RoleManagePermissionsAudit(c, permissions, roleName, err)
}

type BHDRoleAudit struct {
	ID    int64  `json:"id" xorm:"bhd_role_id"`
	Name  string `json:"name"`
	OrgID int64  `json:"orgId" xorm:"org_id"`
}

func GetRoleNameByID(c *contextmodel.ReqContext, withDbSession bhd_permissions.WithDbSession, roleID int64, col string) (string, error) {
	role := BHDRoleAudit{ID: roleID, OrgID: c.OrgID}
	roleGetErr := withDbSession(context.Background(), func(sess *db.Session) error {
		exists, err := sess.Table("bhd_role").Where("bhd_role_id = ? AND org_id = ?", roleID, c.OrgID).Cols(col).Get(&role)
		if err != nil {
			return err
		} else if !exists {
			return errors.New("resource not found")
		}
		return nil
	})
	return role.Name, roleGetErr
}

func ManageUsersRoleAudit(c *contextmodel.ReqContext, sqlstore sqlstore.SQLStore, usersAdded []int64, usersRemoved []int64, roleIdStr string, err error) {
	RoleID, err := strconv.ParseInt(roleIdStr, 10, 64)
	if err != nil {
		Log.Error("Role id is invalid", "error", err)
	}
	roleName, roleGetErr := GetRoleNameByID(c, sqlstore.WithDbSession, RoleID, "name")
	if roleGetErr != nil {
		Log.Error("Error while getting role details for audit")
	}
	audit.RoleManageUsersAudit(c, sqlstore, roleName, usersAdded, usersRemoved, err)
}

func ManageTeamsRoleAudit(c *contextmodel.ReqContext, sqlstore sqlstore.SQLStore, teamsAdded []int64, teamsRemoved []int64, roleIdStr string, err error) {
	RoleID, err := strconv.ParseInt(roleIdStr, 10, 64)
	if err != nil {
		Log.Error("Role id is invalid", "error", err)
	}
	roleName, roleGetErr := GetRoleNameByID(c, sqlstore.WithDbSession, RoleID, "name")
	if roleGetErr != nil {
		Log.Error("Error while getting role details for audit")
	}
	audit.RoleManageTeamsAudit(c, sqlstore, roleName, teamsAdded, teamsRemoved, err)
}
