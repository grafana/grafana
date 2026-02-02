package bhd_rbac

import (
	"net/http"
	"strconv"

	bhdperm "github.com/grafana/grafana/pkg/api/bmc/bhd_rbac/bhd_permissions"
	"github.com/grafana/grafana/pkg/api/response"
	contextmodel "github.com/grafana/grafana/pkg/services/contexthandler/model"
	"github.com/grafana/grafana/pkg/web"
)

func GetRolePermissions(c *contextmodel.ReqContext, withDbSession bhdperm.WithDbSession) response.Response {
	roleID, err := strconv.ParseInt(web.Params(c.Req)[":roleId"], 10, 64)
	if err != nil {
		message := bhdperm.ErrInvalidRoleID.Error()
		return response.Error(http.StatusBadRequest, message, err)
	}

	query := bhdperm.GetRolePermissionDTO{RoleID: roleID, OrgID: c.OrgID}
	permissions, err := bhdperm.GetRbacRolePermissions(c.Req.Context(), withDbSession, query)
	if err != nil {
		message := bhdperm.ErrFailedToGetPermissions.Error()
		return response.Error(http.StatusInternalServerError, message, err)
	}

	return response.JSON(200, permissions)
}

func UpdateRolePermissions(c *contextmodel.ReqContext, withDbSession bhdperm.WithDbSession) response.Response {
	roleID, err := strconv.ParseInt(web.Params(c.Req)[":roleId"], 10, 64)
	if err != nil {
		message := bhdperm.ErrInvalidRoleID.Error()
		return response.Error(http.StatusBadRequest, message, err)
	}

	cmd := &bhdperm.UpdateRolePermissionsDTO{}
	if err := web.Bind(c.Req, &cmd); err != nil {
		message := bhdperm.ErrInvalidPayload.Error()
		return response.Error(http.StatusBadRequest, message, err)
	}

	query := bhdperm.UpdateRolePermissionsQuery{
		RoleID:      roleID,
		Permissions: cmd.Permissions,
		OrgID:       c.OrgID,
	}

	if err := bhdperm.UpdateRbacRolePermissions(c.Req.Context(), withDbSession, query); err != nil {
		go ManageRolePermissionsAudit(c, withDbSession, roleID, cmd.Permissions, err)
		message := bhdperm.ErrFailedToUpdatePermissions.Error()
		return response.Error(http.StatusInternalServerError, message, err)
	}

	go ManageRolePermissionsAudit(c, withDbSession, roleID, cmd.Permissions, nil)
	return response.Success("Permissions updated")
}

func GetPermissionsByUser(c *contextmodel.ReqContext, withDbSession bhdperm.WithDbSession) response.Response {
	userID, err := strconv.ParseInt(web.Params(c.Req)[":roleId"], 10, 64)
	if err != nil {
		message := bhdperm.ErrInvalidRoleID.Error()
		return response.Error(http.StatusBadRequest, message, err)
	}

	permissions, err := bhdperm.GetRbacRolePermissionsByUserID(c.Req.Context(), withDbSession, userID)
	if err != nil {
		message := bhdperm.ErrFailedToGetPermissions.Error()
		return response.Error(http.StatusInternalServerError, message, err)
	}

	return response.JSON(200, bhdperm.GetMapPermissions(permissions))
}
