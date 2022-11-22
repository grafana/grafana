package api

import (
	"errors"
	"net/http"
	"strconv"

	"github.com/grafana/grafana/pkg/api/dtos"
	"github.com/grafana/grafana/pkg/api/response"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/util"
	"github.com/grafana/grafana/pkg/web"
)

// swagger:route POST /teams teams createTeam
//
// Add Team.
//
// Responses:
// 200: createTeamResponse
// 401: unauthorisedError
// 403: forbiddenError
// 409: conflictError
// 500: internalServerError
func (hs *HTTPServer) CreateTeam(c *models.ReqContext) response.Response {
	cmd := models.CreateTeamCommand{}
	if err := web.Bind(c.Req, &cmd); err != nil {
		return response.Error(http.StatusBadRequest, "bad request data", err)
	}
	accessControlEnabled := !hs.AccessControl.IsDisabled()
	if !accessControlEnabled && c.OrgRole == org.RoleViewer {
		return response.Error(403, "Not allowed to create team.", nil)
	}

	team, err := hs.teamService.CreateTeam(cmd.Name, cmd.Email, c.OrgID)
	if err != nil {
		if errors.Is(err, models.ErrTeamNameTaken) {
			return response.Error(409, "Team name taken", err)
		}
		return response.Error(500, "Failed to create Team", err)
	}

	// Reload permission cache for the user who's created the team, so that they can access this data source immediately
	if !hs.AccessControl.IsDisabled() {
		// Clear permission cache for the user who's created the team, so that new permissions are fetched for their next call
		// Required for cases when caller wants to immediately interact with the newly created object
		if err := hs.accesscontrolService.ClearUserPermissionCache(c.SignedInUser); err != nil {
			return response.Error(500, "Failed to clear permission cache after team creation", err)
		}
	}

	if accessControlEnabled || (c.OrgRole == org.RoleEditor && hs.Cfg.EditorsCanAdmin) {
		// if the request is authenticated using API tokens
		// the SignedInUser is an empty struct therefore
		// an additional check whether it is an actual user is required
		if c.SignedInUser.IsRealUser() {
			if err := addOrUpdateTeamMember(c.Req.Context(), hs.teamPermissionsService, c.SignedInUser.UserID, c.OrgID, team.Id, models.PERMISSION_ADMIN.String()); err != nil {
				c.Logger.Error("Could not add creator to team", "error", err)
			}
		} else {
			c.Logger.Warn("Could not add creator to team because is not a real user")
		}
	}
	return response.JSON(http.StatusOK, &util.DynMap{
		"teamId":  team.Id,
		"message": "Team created",
	})
}

// swagger:route PUT /teams/{team_id} teams updateTeam
//
// Update Team.
//
// Responses:
// 200: okResponse
// 401: unauthorisedError
// 403: forbiddenError
// 404: notFoundError
// 409: conflictError
// 500: internalServerError
func (hs *HTTPServer) UpdateTeam(c *models.ReqContext) response.Response {
	cmd := models.UpdateTeamCommand{}
	var err error
	if err := web.Bind(c.Req, &cmd); err != nil {
		return response.Error(http.StatusBadRequest, "bad request data", err)
	}
	cmd.OrgId = c.OrgID
	cmd.Id, err = strconv.ParseInt(web.Params(c.Req)[":teamId"], 10, 64)
	if err != nil {
		return response.Error(http.StatusBadRequest, "teamId is invalid", err)
	}

	if hs.AccessControl.IsDisabled() {
		if err := hs.teamGuardian.CanAdmin(c.Req.Context(), cmd.OrgId, cmd.Id, c.SignedInUser); err != nil {
			return response.Error(403, "Not allowed to update team", err)
		}
	}

	if err := hs.teamService.UpdateTeam(c.Req.Context(), &cmd); err != nil {
		if errors.Is(err, models.ErrTeamNameTaken) {
			return response.Error(400, "Team name taken", err)
		}
		return response.Error(500, "Failed to update Team", err)
	}

	return response.Success("Team updated")
}

// swagger:route DELETE /teams/{team_id} teams deleteTeamByID
//
// Delete Team By ID.
//
// Responses:
// 200: okResponse
// 401: unauthorisedError
// 403: forbiddenError
// 404: notFoundError
// 500: internalServerError
func (hs *HTTPServer) DeleteTeamByID(c *models.ReqContext) response.Response {
	orgId := c.OrgID
	teamId, err := strconv.ParseInt(web.Params(c.Req)[":teamId"], 10, 64)
	if err != nil {
		return response.Error(http.StatusBadRequest, "teamId is invalid", err)
	}
	user := c.SignedInUser

	if hs.AccessControl.IsDisabled() {
		if err := hs.teamGuardian.CanAdmin(c.Req.Context(), orgId, teamId, user); err != nil {
			return response.Error(403, "Not allowed to delete team", err)
		}
	}

	if err := hs.teamService.DeleteTeam(c.Req.Context(), &models.DeleteTeamCommand{OrgId: orgId, Id: teamId}); err != nil {
		if errors.Is(err, models.ErrTeamNotFound) {
			return response.Error(404, "Failed to delete Team. ID not found", nil)
		}
		return response.Error(500, "Failed to delete Team", err)
	}
	return response.Success("Team deleted")
}

// swagger:route GET /teams/search teams searchTeams
//
// Team Search With Paging.
//
// Responses:
// 200: searchTeamsResponse
// 401: unauthorisedError
// 403: forbiddenError
// 500: internalServerError
func (hs *HTTPServer) SearchTeams(c *models.ReqContext) response.Response {
	perPage := c.QueryInt("perpage")
	if perPage <= 0 {
		perPage = 1000
	}
	page := c.QueryInt("page")
	if page < 1 {
		page = 1
	}

	// Using accesscontrol the filtering is done based on user permissions
	userIdFilter := models.FilterIgnoreUser
	if hs.AccessControl.IsDisabled() {
		userIdFilter = userFilter(c)
	}

	query := models.SearchTeamsQuery{
		OrgId:        c.OrgID,
		Query:        c.Query("query"),
		Name:         c.Query("name"),
		UserIdFilter: userIdFilter,
		Page:         page,
		Limit:        perPage,
		SignedInUser: c.SignedInUser,
		HiddenUsers:  hs.Cfg.HiddenUsers,
	}

	if err := hs.teamService.SearchTeams(c.Req.Context(), &query); err != nil {
		return response.Error(500, "Failed to search Teams", err)
	}

	teamIDs := map[string]bool{}
	for _, team := range query.Result.Teams {
		team.AvatarUrl = dtos.GetGravatarUrlWithDefault(team.Email, team.Name)
		teamIDs[strconv.FormatInt(team.Id, 10)] = true
	}

	metadata := hs.getMultiAccessControlMetadata(c, c.OrgID, "teams:id:", teamIDs)
	if len(metadata) > 0 {
		for _, team := range query.Result.Teams {
			team.AccessControl = metadata[strconv.FormatInt(team.Id, 10)]
		}
	}

	query.Result.Page = page
	query.Result.PerPage = perPage

	return response.JSON(http.StatusOK, query.Result)
}

// UserFilter returns the user ID used in a filter when querying a team
// 1. If the user is a viewer or editor, this will return the user's ID.
// 2. If the user is an admin, this will return models.FilterIgnoreUser (0)
func userFilter(c *models.ReqContext) int64 {
	userIdFilter := c.SignedInUser.UserID
	if c.OrgRole == org.RoleAdmin {
		userIdFilter = models.FilterIgnoreUser
	}
	return userIdFilter
}

// swagger:route GET /teams/{team_id} teams getTeamByID
//
// Get Team By ID.
//
// Responses:
// 200: getTeamByIDResponse
// 401: unauthorisedError
// 403: forbiddenError
// 404: notFoundError
// 500: internalServerError
func (hs *HTTPServer) GetTeamByID(c *models.ReqContext) response.Response {
	teamId, err := strconv.ParseInt(web.Params(c.Req)[":teamId"], 10, 64)
	if err != nil {
		return response.Error(http.StatusBadRequest, "teamId is invalid", err)
	}

	// Using accesscontrol the filtering has already been performed at middleware layer
	userIdFilter := models.FilterIgnoreUser
	if hs.AccessControl.IsDisabled() {
		userIdFilter = userFilter(c)
	}

	query := models.GetTeamByIdQuery{
		OrgId:        c.OrgID,
		Id:           teamId,
		SignedInUser: c.SignedInUser,
		HiddenUsers:  hs.Cfg.HiddenUsers,
		UserIdFilter: userIdFilter,
	}

	if err := hs.teamService.GetTeamById(c.Req.Context(), &query); err != nil {
		if errors.Is(err, models.ErrTeamNotFound) {
			return response.Error(404, "Team not found", err)
		}

		return response.Error(500, "Failed to get Team", err)
	}

	// Add accesscontrol metadata
	query.Result.AccessControl = hs.getAccessControlMetadata(c, c.OrgID, "teams:id:", strconv.FormatInt(query.Result.Id, 10))

	query.Result.AvatarUrl = dtos.GetGravatarUrlWithDefault(query.Result.Email, query.Result.Name)
	return response.JSON(http.StatusOK, &query.Result)
}

// swagger:route GET /teams/{team_id}/preferences teams getTeamPreferences
//
// Get Team Preferences.
//
// Responses:
// 200: getPreferencesResponse
// 401: unauthorisedError
// 500: internalServerError
func (hs *HTTPServer) GetTeamPreferences(c *models.ReqContext) response.Response {
	teamId, err := strconv.ParseInt(web.Params(c.Req)[":teamId"], 10, 64)
	if err != nil {
		return response.Error(http.StatusBadRequest, "teamId is invalid", err)
	}

	orgId := c.OrgID

	if hs.AccessControl.IsDisabled() {
		if err := hs.teamGuardian.CanAdmin(c.Req.Context(), orgId, teamId, c.SignedInUser); err != nil {
			return response.Error(403, "Not allowed to view team preferences.", err)
		}
	}

	return hs.getPreferencesFor(c.Req.Context(), orgId, 0, teamId)
}

// swagger:route PUT /teams/{team_id}/preferences teams updateTeamPreferences
//
// Update Team Preferences.
//
// Responses:
// 200: okResponse
// 400: badRequestError
// 401: unauthorisedError
// 500: internalServerError
func (hs *HTTPServer) UpdateTeamPreferences(c *models.ReqContext) response.Response {
	dtoCmd := dtos.UpdatePrefsCmd{}
	if err := web.Bind(c.Req, &dtoCmd); err != nil {
		return response.Error(http.StatusBadRequest, "bad request data", err)
	}

	teamId, err := strconv.ParseInt(web.Params(c.Req)[":teamId"], 10, 64)
	if err != nil {
		return response.Error(http.StatusBadRequest, "teamId is invalid", err)
	}

	orgId := c.OrgID

	if hs.AccessControl.IsDisabled() {
		if err := hs.teamGuardian.CanAdmin(c.Req.Context(), orgId, teamId, c.SignedInUser); err != nil {
			return response.Error(403, "Not allowed to update team preferences.", err)
		}
	}

	return hs.updatePreferencesFor(c.Req.Context(), orgId, 0, teamId, &dtoCmd)
}

// swagger:parameters updateTeamPreferences
type UpdateTeamPreferencesParams struct {
	// in:path
	// required:true
	TeamID string `json:"team_id"`
	// in:body
	// required:true
	Body dtos.UpdatePrefsCmd `json:"body"`
}

// swagger:parameters getTeamByID
type GetTeamByIDParams struct {
	// in:path
	// required:true
	TeamID string `json:"team_id"`
}

// swagger:parameters deleteTeamByID
type DeleteTeamByIDParams struct {
	// in:path
	// required:true
	TeamID string `json:"team_id"`
}

// swagger:parameters getTeamPreferences
type GetTeamPreferencesParams struct {
	// in:path
	// required:true
	TeamID string `json:"team_id"`
}

// swagger:parameters searchTeams
type SearchTeamsParams struct {
	// in:query
	// required:false
	// default: 1
	Page int `json:"page"`
	// Number of items per page
	// The totalCount field in the response can be used for pagination list E.g. if totalCount is equal to 100 teams and the perpage parameter is set to 10 then there are 10 pages of teams.
	// in:query
	// required:false
	// default: 1000
	PerPage int    `json:"perpage"`
	Name    string `json:"name"`
	// If set it will return results where the query value is contained in the name field. Query values with spaces need to be URL encoded.
	// required:false
	Query string `json:"query"`
}

// swagger:parameters createTeam
type CreateTeamParams struct {
	// in:body
	// required:true
	Body models.CreateTeamCommand `json:"body"`
}

// swagger:parameters updateTeam
type UpdateTeamParams struct {
	// in:body
	// required:true
	Body models.UpdateTeamCommand `json:"body"`
	// in:path
	// required:true
	TeamID string `json:"team_id"`
}

// swagger:response searchTeamsResponse
type SearchTeamsResponse struct {
	// The response message
	// in: body
	Body models.SearchTeamQueryResult `json:"body"`
}

// swagger:response getTeamByIDResponse
type GetTeamByIDResponse struct {
	// The response message
	// in: body
	Body *models.TeamDTO `json:"body"`
}

// swagger:response createTeamResponse
type CreateTeamResponse struct {
	// The response message
	// in: body
	Body struct {
		TeamId  int64  `json:"teamId"`
		Message string `json:"message"`
	} `json:"body"`
}
