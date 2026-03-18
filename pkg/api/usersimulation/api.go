package usersimulation

import (
	"net/http"

	"github.com/grafana/grafana/pkg/api/response"
	"github.com/grafana/grafana/pkg/services/auth"
	contextmodel "github.com/grafana/grafana/pkg/services/contexthandler/model"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/web"
)

// API handles Grafana admin user-simulation session endpoints.
type API struct {
	UserService user.Service
	OrgService  org.Service
	AuthTokens  auth.UserTokenService
}

func New(userSvc user.Service, orgSvc org.Service, tokens auth.UserTokenService) *API {
	return &API{
		UserService: userSvc,
		OrgService:  orgSvc,
		AuthTokens:  tokens,
	}
}

type startUserSimulationCommand struct {
	UserID int64 `json:"userId"`
}

// StartUserSimulation POST /api/admin/user-simulation
func (a *API) StartUserSimulation(c *contextmodel.ReqContext) response.Response {
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

	target, err := a.UserService.GetByID(c.Req.Context(), &user.GetUserByIDQuery{ID: cmd.UserID})
	if err != nil || target == nil {
		return response.Error(http.StatusNotFound, "User not found", err)
	}
	if target.IsServiceAccount {
		return response.Error(http.StatusBadRequest, "Cannot simulate a service account", nil)
	}
	if target.IsDisabled {
		return response.Error(http.StatusBadRequest, "Cannot simulate a disabled user", nil)
	}

	orgs, err := a.OrgService.GetUserOrgList(c.Req.Context(), &org.GetUserOrgListQuery{UserID: cmd.UserID})
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

	if err := a.AuthTokens.SetTokenSimulation(c.Req.Context(), c.UserToken.Id, c.UserToken.UserId, cmd.UserID, c.Login); err != nil {
		return response.Error(http.StatusInternalServerError, "Failed to start simulation", err)
	}

	return response.JSON(http.StatusOK, map[string]any{
		"message":   "Simulation started, reload the page to apply.",
		"userId":    cmd.UserID,
		"userLogin": target.Login,
	})
}

// StopUserSimulation DELETE /api/admin/user-simulation
func (a *API) StopUserSimulation(c *contextmodel.ReqContext) response.Response {
	if !c.IsGrafanaAdmin {
		return response.Error(http.StatusForbidden, "Forbidden", nil)
	}
	if c.UserToken == nil || c.UserToken.Id < 1 {
		return response.JSON(http.StatusOK, map[string]any{"active": false})
	}
	if err := a.AuthTokens.ClearTokenSimulation(c.Req.Context(), c.UserToken.Id, c.UserToken.UserId); err != nil {
		return response.Error(http.StatusInternalServerError, "Failed to stop simulation", err)
	}
	return response.JSON(http.StatusOK, map[string]any{"message": "Simulation stopped, reload the page."})
}

// GetUserSimulationStatus GET /api/admin/user-simulation
func (a *API) GetUserSimulationStatus(c *contextmodel.ReqContext) response.Response {
	if !c.IsGrafanaAdmin {
		return response.Error(http.StatusForbidden, "Forbidden", nil)
	}
	if c.UserToken == nil || c.UserToken.SimulateUserID < 1 {
		return response.JSON(http.StatusOK, map[string]any{"active": false})
	}
	simLogin := ""
	if u, err := a.UserService.GetByID(c.Req.Context(), &user.GetUserByIDQuery{ID: c.UserToken.SimulateUserID}); err == nil && u != nil {
		simLogin = u.Login
	}
	return response.JSON(http.StatusOK, map[string]any{
		"active":             true,
		"simulatedUserId":    c.UserToken.SimulateUserID,
		"simulatedUserLogin": simLogin,
		"actorLogin":         c.UserToken.SimulationActorLogin,
	})
}
