package api

import (
	"net/http"

	"github.com/grafana/grafana/pkg/api/response"
	contextmodel "github.com/grafana/grafana/pkg/services/contexthandler/model"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/web"
)

type startUserSimulationCommand struct {
	UserID int64 `json:"userId"`
}

// POST /api/admin/user-simulation
func (hs *HTTPServer) StartUserSimulation(c *contextmodel.ReqContext) response.Response {
	if !c.IsGrafanaAdmin {
		return response.Error(http.StatusForbidden, "Forbidden", nil)
	}
	if c.UserToken == nil || c.UserToken.Id < 1 {
		return response.Error(http.StatusBadRequest, "A browser session is required", nil)
	}

	var cmd startUserSimulationCommand
	if err := web.Bind(c.Req, &cmd); err != nil {
		return response.Error(http.StatusBadRequest, "Invalid request body", err)
	}
	if cmd.UserID < 1 {
		return response.Error(http.StatusBadRequest, "userId is required", nil)
	}

	target, err := hs.userService.GetByID(c.Req.Context(), &user.GetUserByIDQuery{ID: cmd.UserID})
	if err != nil || target == nil {
		return response.Error(http.StatusNotFound, "User not found", err)
	}
	if target.IsServiceAccount {
		return response.Error(http.StatusBadRequest, "Cannot simulate a service account", nil)
	}
	if target.IsDisabled {
		return response.Error(http.StatusBadRequest, "Cannot simulate a disabled user", nil)
	}

	orgs, err := hs.orgService.GetUserOrgList(c.Req.Context(), &org.GetUserOrgListQuery{UserID: cmd.UserID})
	if err != nil {
		return response.Error(http.StatusInternalServerError, "Failed to resolve user organizations", err)
	}
	inOrg := false
	for _, o := range orgs {
		if o.OrgID == c.OrgID {
			inOrg = true
			break
		}
	}
	if !inOrg {
		return response.Error(http.StatusBadRequest, "User is not a member of the current organization", nil)
	}

	if err := hs.AuthTokenService.SetTokenSimulation(c.Req.Context(), c.UserToken.Id, c.UserToken.UserId, cmd.UserID, c.Login); err != nil {
		return response.Error(http.StatusInternalServerError, "Failed to start simulation", err)
	}

	return response.JSON(http.StatusOK, map[string]any{
		"message":   "Simulation started; reload the page to apply.",
		"userId":    cmd.UserID,
		"userLogin": target.Login,
	})
}

// DELETE /api/admin/user-simulation
func (hs *HTTPServer) StopUserSimulation(c *contextmodel.ReqContext) response.Response {
	if !c.IsGrafanaAdmin {
		return response.Error(http.StatusForbidden, "Forbidden", nil)
	}
	if c.UserToken == nil || c.UserToken.Id < 1 {
		return response.JSON(http.StatusOK, map[string]any{"active": false})
	}
	if err := hs.AuthTokenService.ClearTokenSimulation(c.Req.Context(), c.UserToken.Id, c.UserToken.UserId); err != nil {
		return response.Error(http.StatusInternalServerError, "Failed to stop simulation", err)
	}
	return response.JSON(http.StatusOK, map[string]any{"message": "Simulation stopped; reload the page."})
}

// GET /api/admin/user-simulation
func (hs *HTTPServer) GetUserSimulationStatus(c *contextmodel.ReqContext) response.Response {
	if !c.IsGrafanaAdmin {
		return response.Error(http.StatusForbidden, "Forbidden", nil)
	}
	if c.UserToken == nil || c.UserToken.SimulateUserID < 1 {
		return response.JSON(http.StatusOK, map[string]any{"active": false})
	}
	simLogin := ""
	if u, err := hs.userService.GetByID(c.Req.Context(), &user.GetUserByIDQuery{ID: c.UserToken.SimulateUserID}); err == nil && u != nil {
		simLogin = u.Login
	}
	return response.JSON(http.StatusOK, map[string]any{
		"active":             true,
		"simulatedUserId":    c.UserToken.SimulateUserID,
		"simulatedUserLogin": simLogin,
		"actorLogin":         c.UserToken.SimulationActorLogin,
	})
}
