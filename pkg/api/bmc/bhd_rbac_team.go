package bmc

import (
	"errors"
	"net/http"
	"strconv"

	"github.com/grafana/grafana/pkg/api/bmc/bhd_rbac"

	bhd_team "github.com/grafana/grafana/pkg/api/bmc/bhd_rbac/team"
	"github.com/grafana/grafana/pkg/api/response"
	contextmodel "github.com/grafana/grafana/pkg/services/contexthandler/model"
	"github.com/grafana/grafana/pkg/services/team"
	"github.com/grafana/grafana/pkg/web"
)

func (p *PluginsAPI) SearchTeam(c *contextmodel.ReqContext) response.Response {
	perPage := c.QueryInt("perpage")
	if perPage <= 0 {
		perPage = 1000
	}
	page := c.QueryInt("page")

	if page < 1 {
		page = 1
	}

	//Dashboard Role Id Validation
	roleIdStr := c.Query("bhdRoleId")
	if roleIdStr != "" {
		_, validationError := p.ValidateDashboardRoleId(c, roleIdStr)
		if validationError != nil {
			return validationError
		}
	}

	request := bhd_team.SearchTeamQuery{
		OrgID:     c.OrgID,
		Query:     c.Query("query"),
		Name:      c.Query("name"),
		Email:     c.Query("email"),
		Id:        c.QueryInt("id"),
		OrderBy:   c.Query("sortby"),
		BHDRoleID: c.QueryInt64("bhdRoleId"),
		Selected:  c.QueryBool("selected"),
		Limit:     perPage,
		Page:      page,
	}

	bhd_rbac.Log.Info("Teams search request", "r", request)
	result, err := bhd_team.SearchTeam(c.Req.Context(), p.store, &request)
	if err != nil {
		bhd_rbac.Log.Error("Failed to search Teams", "error", err)
		return response.Error(500, "Failed to search Teams", err)
	}
	result.Page = page
	result.PerPage = perPage
	bhd_rbac.Log.Info("Team search request processed successfully", "Total Count", result.TotalCount)
	return response.JSON(http.StatusOK, &result)
}

func (p *PluginsAPI) AddTeamBHDRole(c *contextmodel.ReqContext) response.Response {
	bhd_rbac.Log.Info("Request to assign Dashboard Role to the Team")
	cmd := bhd_team.AddTeamRoleCommand{}
	var err error
	if err := web.Bind(c.Req, &cmd); err != nil {
		return response.Error(http.StatusBadRequest, "bad request data", err)
	}
	cmd.OrgID = c.OrgID
	cmd.ID, err = strconv.ParseInt(web.Params(c.Req)[":teamId"], 10, 64)
	if err != nil {
		return response.Error(http.StatusBadRequest, "teamId is invalid", err)
	}

	// if hs.AccessControl.IsDisabled() {
	// 	if err := hs.teamGuardian.CanAdmin(c.Req.Context(), cmd.OrgID, cmd.ID, c.SignedInUser); err != nil {
	// 		return response.Error(403, "Not allowed to add team role", err)
	// 	}
	// }

	if err := bhd_team.AddTeamBHDRole(c.Req.Context(), p.store, &cmd); err != nil {
		if errors.Is(err, team.ErrTeamNotFound) {
			return response.Error(400, "Team does not exists.", err)
		}
		return response.Error(500, "Failed to add team role", err)
	}

	bhd_rbac.Log.Info("Dashboard Role assigned successfully to the Team")
	return response.Success("Team role added.")
}

func (p *PluginsAPI) RemoveTeamBHDRole(c *contextmodel.ReqContext) response.Response {
	bhd_rbac.Log.Info("Request to remove Dashboard Role assigned to the Team")
	cmd := bhd_team.AddTeamRoleCommand{}
	var err error
	cmd.OrgID = c.OrgID
	cmd.ID, err = strconv.ParseInt(web.Params(c.Req)[":teamId"], 10, 64)
	if err != nil {
		return response.Error(http.StatusBadRequest, "Team Id is invalid", err)
	}
	cmd.RoleId, err = strconv.ParseInt(web.Params(c.Req)[":roleId"], 10, 64)
	if err != nil {
		return response.Error(http.StatusBadRequest, "Role Id is invalid", err)
	}

	// if hs.AccessControl.IsDisabled() {
	// 	if err := hs.teamGuardian.CanAdmin(c.Req.Context(), cmd.OrgID, cmd.ID, c.SignedInUser); err != nil {
	// 		return response.Error(403, "Not allowed to remove team role", err)
	// 	}
	// }

	if err := bhd_team.RemoveTeamBHDRole(c.Req.Context(), p.store, &cmd); err != nil {
		if errors.Is(err, team.ErrTeamNotFound) {
			return response.Error(400, "Team does not exists.", err)
		}
		return response.Error(500, "Failed to remove team role", err)
	}

	bhd_rbac.Log.Info("Dashboard Role assigned to the Team, removed successfully")
	return response.Success("Team role removed.")
}
