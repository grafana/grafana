package bmc

import (
	"errors"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/grafana/grafana/pkg/api/bmc/bhd_rbac"

	role "github.com/grafana/grafana/pkg/api/bmc/bhd_rbac/bhd_role"
	"github.com/grafana/grafana/pkg/api/response"
	contextmodel "github.com/grafana/grafana/pkg/services/contexthandler/model"
	"github.com/grafana/grafana/pkg/web"
)

func (p *PluginsAPI) CreateBHDRole(c *contextmodel.ReqContext) response.Response {
	request := role.BHDRoleDTORequest{}
	var err error

	if err := web.Bind(c.Req, &request); err != nil {
		bhd_rbac.Log.Error("Bad request data", "error", err)
		return response.Error(http.StatusBadRequest, "Bad request data", err)
	}
	request.OrgID = c.OrgID
	request.CreatedTime = time.Now()
	request.UpdatedTime = time.Now()
	request.CreatedBy = c.Login
	request.UpdatedBy = c.Login
	bhd_rbac.Log.Info("Role create request", "request", request)
	request.Name = strings.Trim(request.Name, " ")
	if request.Name == "" {
		bhd_rbac.Log.Error("Role name is missing")
		return response.Error(http.StatusBadRequest, role.RoleNameMissingMsg, role.ErrRoleNameMissing)
	}
	result, err := role.CreateBHDRole(c.Req.Context(), p.store, &request)
	if err != nil {
		go bhd_rbac.CreateRoleAudit(c, request.Name, err)
		bhd_rbac.Log.Error("Failed to create role", "Name", request.Name, "error", err)
		if errors.Is(err, role.ErrRoleAlreadyExist) {
			return response.Error(http.StatusConflict, role.RoleAlreadyExistMsg, err)
		} else {
			return response.Error(http.StatusInternalServerError, role.RoleCreateFailureMsg, err)
		}
	}
	go bhd_rbac.CreateRoleAudit(c, request.Name, nil)
	bhd_rbac.Log.Info("Role created successfully", "Name", request.Name)
	return response.JSON(http.StatusOK, &result)
}

func (p *PluginsAPI) GetBHDRole(c *contextmodel.ReqContext) response.Response {
	roleIdStr := web.Params(c.Req)[":roleId"]
	//Dashboard Role Id Validation
	_, validationError := p.ValidateDashboardRoleId(c, roleIdStr)
	if validationError != nil {
		return validationError
	}
	roleId, _ := strconv.ParseInt(roleIdStr, 10, 64)

	request := role.GetBHDRoleByIDQuery{
		OrgID: c.OrgID,
		ID:    roleId,
	}
	bhd_rbac.Log.Info("Role get request", "request", request)
	result, err := role.GetBHDRole(c.Req.Context(), p.store, &request)
	if err != nil {
		if errors.Is(err, role.ErrRoleNotFound) {
			bhd_rbac.Log.Error("Failed to get role", "error", err)
			return response.Error(http.StatusNotFound, role.RoleNotFoundMsg, err)
		}
		bhd_rbac.Log.Error("Failed to get role", "error", err)
		return response.Error(http.StatusInternalServerError, role.RoleGetFailureMsg, err)
	}
	bhd_rbac.Log.Info("Role found", "Id", roleId)
	return response.JSON(http.StatusOK, &result)
}

func (p *PluginsAPI) UpdateBHDRole(c *contextmodel.ReqContext) response.Response {
	request := role.BHDRoleDTORequest{}
	var err error
	if err := web.Bind(c.Req, &request); err != nil {
		bhd_rbac.Log.Error("Bad request data", "error", err)
		return response.Error(http.StatusBadRequest, "Bad request data", err)
	}

	//Dashboard Role Id Validation
	roleIdStr := web.Params(c.Req)[":roleId"]
	bhdRoleDto, validationError := p.ValidateDashboardRoleId(c, roleIdStr)
	if validationError != nil {
		return validationError
	}
	if bhdRoleDto != nil {
		if bhdRoleDto.SystemRole {
			return response.Error(http.StatusBadRequest, role.SystemRoleUpdateNotAllowedMsg, role.ErrSystemRoleUpdateNotAllowed)
		}
	}
	request.Name = strings.Trim(request.Name, " ")
	if request.Name == "" {
		bhd_rbac.Log.Error("Role name is missing")
		return response.Error(http.StatusBadRequest, role.RoleNameMissingMsg, role.ErrRoleNameMissing)
	}
	roleId, _ := strconv.ParseInt(roleIdStr, 10, 64)
	request.ID = roleId
	request.OrgID = c.OrgID
	request.UpdatedTime = time.Now()
	request.UpdatedBy = c.Login
	bhd_rbac.Log.Info("Role update request", "request", request)
	result, err := role.UpdateBHDRole(c.Req.Context(), p.store, &request)
	if err != nil {
		go bhd_rbac.UpdateRoleAudit(c, request.Name, err)
		if errors.Is(err, role.ErrRoleNotFound) {
			bhd_rbac.Log.Error("Failed to update role", "error", err)
			return response.Error(http.StatusNotFound, role.RoleNotFoundMsg, err)
		} else if errors.Is(err, role.ErrRoleAlreadyExist) {
			bhd_rbac.Log.Error("Failed to update role", "error", err)
			return response.Error(http.StatusConflict, role.RoleAlreadyExistMsg, err)
		}
		bhd_rbac.Log.Error("Failed to update role", "error", err)
		return response.Error(http.StatusInternalServerError, role.RoleUpdateFailureMsg, err)
	}
	go bhd_rbac.UpdateRoleAudit(c, request.Name, nil)
	bhd_rbac.Log.Info("Role updated successfully", "ID", request.ID)
	return response.JSON(http.StatusOK, &result)
}

func (p *PluginsAPI) DeleteBHDRole(c *contextmodel.ReqContext) response.Response {
	var err error
	//Dashboard Role Id Validation
	roleIdStr := web.Params(c.Req)[":roleId"]
	bhdRoleDto, validationError := p.ValidateDashboardRoleId(c, roleIdStr)
	if validationError != nil {
		return validationError
	}
	if bhdRoleDto != nil {
		if bhdRoleDto.SystemRole {
			return response.Error(http.StatusBadRequest, role.SystemRoleDeleteNotAllowedMsg, role.ErrSystemRoleDeleteNotAllowed)
		}
		if len(bhdRoleDto.Users) > 0 {
			return response.Error(http.StatusBadRequest, role.RoleDeleteUserAssociationMsg, role.ErrUserAssociatedRoleDeleteNotAllowed)
		}
		if len(bhdRoleDto.Teams) > 0 {
			return response.Error(http.StatusBadRequest, role.RoleDeleteTeamAssociationMsg, role.ErrTeamAssociatedRoleDeleteNotAllowed)
		}
	}

	roleId, _ := strconv.ParseInt(roleIdStr, 10, 64)
	request := role.BHDRoleDTORequest{
		OrgID: c.OrgID,
		ID:    roleId,
	}
	bhd_rbac.Log.Info("Role delete request", "request", request)
	result, err := role.DeleteBHDRole(c.Req.Context(), p.store, &request)
	if err != nil {
		go bhd_rbac.DeleteRoleAudit(c, bhdRoleDto.Name, err)
		if errors.Is(err, role.ErrRoleNotFound) {
			bhd_rbac.Log.Error("Role not found", "error", err)
			return response.Error(http.StatusNotFound, role.RoleNotFoundMsg, err)
		}
		bhd_rbac.Log.Error("Failed to delete role", "error", err)
		return response.Error(http.StatusInternalServerError, role.RoleDeleteFailureMsg, err)
	}
	go bhd_rbac.DeleteRoleAudit(c, bhdRoleDto.Name, nil)
	bhd_rbac.Log.Info("Role deleted successfully", "ID", request.ID)
	return response.JSON(http.StatusOK, &result)
}

func (p *PluginsAPI) SearchBHDRoles(c *contextmodel.ReqContext) response.Response {
	perPage := c.QueryInt("perpage")
	if perPage <= 0 {
		perPage = 1000
	}
	page := c.QueryInt("page")
	if page < 1 {
		page = 1
	}
	request := role.SearchBHDRolesQuery{
		OrgID:   c.OrgID,
		Query:   c.Query("query"),
		Name:    c.Query("name"),
		OrderBy: c.Query("sortby"),
		Page:    page,
		Limit:   perPage,
	}
	bhd_rbac.Log.Info("Role search request", "request", request)
	result, err := role.SearchBHDRoles(c.Req.Context(), p.store, &request)
	if err != nil {
		bhd_rbac.Log.Error("Failed to search roles", "error", err)
		return response.Error(500, "Failed to search roles", err)
	}
	result.Page = page
	result.PerPage = perPage
	return response.JSON(http.StatusOK, result)
}

func (p *PluginsAPI) UpdateUsersRole(c *contextmodel.ReqContext) response.Response {
	bhd_rbac.Log.Info("Update Users Role request")
	request := role.UpdateUsersBHDRoleQuery{}
	var err error
	if err := web.Bind(c.Req, &request); err != nil {
		bhd_rbac.Log.Error("Bad request data", "error", err)
		return response.Error(http.StatusBadRequest, "Bad request data", err)
	}
	request.OrgID = c.OrgID
	//Dashboard Role Id Validation
	roleIdStr := web.Params(c.Req)[":roleId"]
	_, validationError := p.ValidateDashboardRoleId(c, roleIdStr)
	if validationError != nil {
		return validationError
	}
	request.ID, _ = strconv.ParseInt(roleIdStr, 10, 64)

	result, err := role.UpdateUsersBHDRole(c.Req.Context(), p.store, &request)
	if err != nil {
		go bhd_rbac.ManageUsersRoleAudit(c, p.store, request.UsersAdded, request.UsersRemoved, roleIdStr, err)
		bhd_rbac.Log.Error("Failed to update Users Role", "error", err)
		return response.Error(500, "Failed to update Users Role", err)
	}
	go bhd_rbac.ManageUsersRoleAudit(c, p.store, request.UsersAdded, request.UsersRemoved, roleIdStr, nil)
	bhd_rbac.Log.Info("Users Role updated successfully", "Id", request.ID)
	return response.JSON(http.StatusOK, &result)
}

func (p *PluginsAPI) UpdateTeamsRole(c *contextmodel.ReqContext) response.Response {
	bhd_rbac.Log.Info("Update Teams Role request")
	request := role.UpdateTeamsBHDRoleQuery{}
	var err error

	if err := web.Bind(c.Req, &request); err != nil {
		bhd_rbac.Log.Error("Bad request data", "error", err)
		return response.Error(http.StatusBadRequest, "Bad request data", err)
	}
	request.OrgID = c.OrgID

	//Dashboard Role Id Validation
	roleIdStr := web.Params(c.Req)[":roleId"]
	_, validationError := p.ValidateDashboardRoleId(c, roleIdStr)
	if validationError != nil {
		return validationError
	}
	request.ID, _ = strconv.ParseInt(roleIdStr, 10, 64)

	result, err := role.UpdateTeamsBHDRole(c.Req.Context(), p.store, &request)
	if err != nil {
		go bhd_rbac.ManageTeamsRoleAudit(c, p.store, request.TeamsAdded, request.TeamsRemoved, roleIdStr, err)
		bhd_rbac.Log.Error("Failed to update Teams Role", "error", err)
		return response.Error(500, "Failed to update Teams Role", err)
	}
	go bhd_rbac.ManageTeamsRoleAudit(c, p.store, request.TeamsAdded, request.TeamsRemoved, roleIdStr, nil)
	bhd_rbac.Log.Info("Teams Role updated successfully", "Id", request.ID)
	return response.JSON(http.StatusOK, &result)
}

func (p *PluginsAPI) ValidateDashboardRoleId(c *contextmodel.ReqContext, roleIdStr string) (*role.BHDRoleDTO, response.Response) {
	var err error
	var RoleID int64
	RoleID, err = strconv.ParseInt(roleIdStr, 10, 64)
	if err != nil {
		bhd_rbac.Log.Error("Role id is invalid", "error", err)
		return nil, response.Error(http.StatusBadRequest, "Role id is invalid", err)
	}
	request := role.GetBHDRoleByIDQuery{
		OrgID:              c.OrgID,
		ID:                 RoleID,
		IncludeAssociation: true,
	}
	result, err := role.GetBHDRole(c.Req.Context(), p.store, &request)
	if err != nil {
		if errors.Is(err, role.ErrRoleNotFound) {
			bhd_rbac.Log.Error("Role not found", "error", err)
			return nil, response.Error(http.StatusNotFound, role.RoleNotFoundMsg, err)
		}
		bhd_rbac.Log.Error("Failed to validated role id", "error", err)
		return nil, response.Error(http.StatusBadRequest, "Failed to validated role id", err)
	}
	bhd_rbac.Log.Debug("Dashboard Role Found", "Dashboard Role", result)
	return result, nil
}
