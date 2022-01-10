package api

import (
	"errors"
	"net/http"

	"github.com/grafana/grafana/pkg/api/dtos"
	"github.com/grafana/grafana/pkg/api/response"
	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/util"
	"github.com/grafana/grafana/pkg/web"
)

// POST /api/teams
func (hs *HTTPServer) CreateTeam(c *models.ReqContext) response.Response {
	cmd := models.CreateTeamCommand{}
	if err := web.Bind(c.Req, &cmd); err != nil {
		return response.Error(http.StatusBadRequest, "bad request data", err)
	}
	accessControlEnabled := hs.Cfg.FeatureToggles["accesscontrol"]
	if !accessControlEnabled && c.OrgRole == models.ROLE_VIEWER {
		return response.Error(403, "Not allowed to create team.", nil)
	}

	team, err := createTeam(hs.SQLStore, cmd.Name, cmd.Email, c.OrgId)
	if err != nil {
		if errors.Is(err, models.ErrTeamNameTaken) {
			return response.Error(409, "Team name taken", err)
		}
		return response.Error(500, "Failed to create Team", err)
	}

	if accessControlEnabled || (c.OrgRole == models.ROLE_EDITOR && hs.Cfg.EditorsCanAdmin) {
		// if the request is authenticated using API tokens
		// the SignedInUser is an empty struct therefore
		// an additional check whether it is an actual user is required
		if c.SignedInUser.IsRealUser() {
			if err := addTeamMember(hs.SQLStore, c.SignedInUser.UserId, c.OrgId, team.Id, false,
				models.PERMISSION_ADMIN); err != nil {
				c.Logger.Error("Could not add creator to team", "error", err)
			}
		} else {
			c.Logger.Warn("Could not add creator to team because is not a real user")
		}
	}

	return response.JSON(200, &util.DynMap{
		"teamId":  team.Id,
		"message": "Team created",
	})
}

// PUT /api/teams/:teamId
func (hs *HTTPServer) UpdateTeam(c *models.ReqContext) response.Response {
	cmd := models.UpdateTeamCommand{}
	if err := web.Bind(c.Req, &cmd); err != nil {
		return response.Error(http.StatusBadRequest, "bad request data", err)
	}
	cmd.OrgId = c.OrgId
	cmd.Id = c.ParamsInt64(":teamId")

	if err := hs.teamGuardian.CanAdmin(c.Req.Context(), cmd.OrgId, cmd.Id, c.SignedInUser); err != nil {
		return response.Error(403, "Not allowed to update team", err)
	}

	if err := hs.Bus.Dispatch(c.Req.Context(), &cmd); err != nil {
		if errors.Is(err, models.ErrTeamNameTaken) {
			return response.Error(400, "Team name taken", err)
		}
		return response.Error(500, "Failed to update Team", err)
	}

	return response.Success("Team updated")
}

// DELETE /api/teams/:teamId
func (hs *HTTPServer) DeleteTeamByID(c *models.ReqContext) response.Response {
	orgId := c.OrgId
	teamId := c.ParamsInt64(":teamId")
	user := c.SignedInUser

	if err := hs.teamGuardian.CanAdmin(c.Req.Context(), orgId, teamId, user); err != nil {
		return response.Error(403, "Not allowed to delete team", err)
	}

	if err := hs.Bus.Dispatch(c.Req.Context(), &models.DeleteTeamCommand{OrgId: orgId, Id: teamId}); err != nil {
		if errors.Is(err, models.ErrTeamNotFound) {
			return response.Error(404, "Failed to delete Team. ID not found", nil)
		}
		return response.Error(500, "Failed to delete Team", err)
	}
	return response.Success("Team deleted")
}

// GET /api/teams/search
func (hs *HTTPServer) SearchTeams(c *models.ReqContext) response.Response {
	perPage := c.QueryInt("perpage")
	if perPage <= 0 {
		perPage = 1000
	}
	page := c.QueryInt("page")
	if page < 1 {
		page = 1
	}

	var userIdFilter int64
	if hs.Cfg.EditorsCanAdmin && c.OrgRole != models.ROLE_ADMIN {
		userIdFilter = c.SignedInUser.UserId
	}

	query := models.SearchTeamsQuery{
		OrgId:        c.OrgId,
		Query:        c.Query("query"),
		Name:         c.Query("name"),
		UserIdFilter: userIdFilter,
		Page:         page,
		Limit:        perPage,
		SignedInUser: c.SignedInUser,
		HiddenUsers:  hs.Cfg.HiddenUsers,
	}

	if err := bus.Dispatch(c.Req.Context(), &query); err != nil {
		return response.Error(500, "Failed to search Teams", err)
	}

	for _, team := range query.Result.Teams {
		team.AvatarUrl = dtos.GetGravatarUrlWithDefault(team.Email, team.Name)
	}

	query.Result.Page = page
	query.Result.PerPage = perPage

	return response.JSON(200, query.Result)
}

// GET /api/teams/:teamId
func (hs *HTTPServer) GetTeamByID(c *models.ReqContext) response.Response {
	query := models.GetTeamByIdQuery{
		OrgId:        c.OrgId,
		Id:           c.ParamsInt64(":teamId"),
		SignedInUser: c.SignedInUser,
		HiddenUsers:  hs.Cfg.HiddenUsers,
	}

	if err := bus.Dispatch(c.Req.Context(), &query); err != nil {
		if errors.Is(err, models.ErrTeamNotFound) {
			return response.Error(404, "Team not found", err)
		}

		return response.Error(500, "Failed to get Team", err)
	}

	query.Result.AvatarUrl = dtos.GetGravatarUrlWithDefault(query.Result.Email, query.Result.Name)
	return response.JSON(200, &query.Result)
}

// GET /api/teams/:teamId/preferences
func (hs *HTTPServer) GetTeamPreferences(c *models.ReqContext) response.Response {
	teamId := c.ParamsInt64(":teamId")
	orgId := c.OrgId

	if err := hs.teamGuardian.CanAdmin(c.Req.Context(), orgId, teamId, c.SignedInUser); err != nil {
		return response.Error(403, "Not allowed to view team preferences.", err)
	}

	return hs.getPreferencesFor(c.Req.Context(), orgId, 0, teamId)
}

// PUT /api/teams/:teamId/preferences
func (hs *HTTPServer) UpdateTeamPreferences(c *models.ReqContext) response.Response {
	dtoCmd := dtos.UpdatePrefsCmd{}
	if err := web.Bind(c.Req, &dtoCmd); err != nil {
		return response.Error(http.StatusBadRequest, "bad request data", err)
	}
	teamId := c.ParamsInt64(":teamId")
	orgId := c.OrgId

	if err := hs.teamGuardian.CanAdmin(c.Req.Context(), orgId, teamId, c.SignedInUser); err != nil {
		return response.Error(403, "Not allowed to update team preferences.", err)
	}

	return hs.updatePreferencesFor(c.Req.Context(), orgId, 0, teamId, &dtoCmd)
}

// createTeam creates a team.
//
// Stubbable by tests.
var createTeam = func(sqlStore *sqlstore.SQLStore, name, email string, orgID int64) (models.Team, error) {
	return sqlStore.CreateTeam(name, email, orgID)
}
