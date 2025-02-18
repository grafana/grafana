package teamapi

import (
	"errors"
	"net/http"
	"strconv"

	claims "github.com/grafana/authlib/types"
	"github.com/grafana/grafana/pkg/api/dtos"
	"github.com/grafana/grafana/pkg/api/response"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	contextmodel "github.com/grafana/grafana/pkg/services/contexthandler/model"
	"github.com/grafana/grafana/pkg/services/dashboards/dashboardaccess"
	"github.com/grafana/grafana/pkg/services/preference/prefapi"
	"github.com/grafana/grafana/pkg/services/team"
	"github.com/grafana/grafana/pkg/services/team/sortopts"
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
func (tapi *TeamAPI) createTeam(c *contextmodel.ReqContext) response.Response {
	cmd := team.CreateTeamCommand{}
	if err := web.Bind(c.Req, &cmd); err != nil {
		return response.Error(http.StatusBadRequest, "bad request data", err)
	}

	t, err := tapi.teamService.CreateTeam(c.Req.Context(), cmd.Name, cmd.Email, c.SignedInUser.GetOrgID())
	if err != nil {
		if errors.Is(err, team.ErrTeamNameTaken) {
			return response.Error(http.StatusConflict, "Team name taken", err)
		}
		return response.Error(http.StatusInternalServerError, "Failed to create Team", err)
	}

	// Clear permission cache for the user who's created the team, so that new permissions are fetched for their next call
	// Required for cases when caller wants to immediately interact with the newly created object
	tapi.ac.ClearUserPermissionCache(c.SignedInUser)

	// if the request is authenticated using API tokens
	// the SignedInUser is an empty struct therefore
	// an additional check whether it is an actual user is required
	if c.SignedInUser.IsIdentityType(claims.TypeUser) {
		userID, _ := c.SignedInUser.GetInternalID()
		if err := addOrUpdateTeamMember(c.Req.Context(), tapi.teamPermissionsService, userID, c.SignedInUser.GetOrgID(),
			t.ID, dashboardaccess.PERMISSION_ADMIN.String()); err != nil {
			c.Logger.Error("Could not add creator to team", "error", err)
		}
	}

	return response.JSON(http.StatusOK, &util.DynMap{
		"teamId":  t.ID,
		"uid":     t.UID,
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
func (tapi *TeamAPI) updateTeam(c *contextmodel.ReqContext) response.Response {
	cmd := team.UpdateTeamCommand{}
	var err error
	if err := web.Bind(c.Req, &cmd); err != nil {
		return response.Error(http.StatusBadRequest, "bad request data", err)
	}
	cmd.OrgID = c.SignedInUser.GetOrgID()
	cmd.ID, err = strconv.ParseInt(web.Params(c.Req)[":teamId"], 10, 64)
	if err != nil {
		return response.Error(http.StatusBadRequest, "teamId is invalid", err)
	}

	if err := tapi.teamService.UpdateTeam(c.Req.Context(), &cmd); err != nil {
		if errors.Is(err, team.ErrTeamNameTaken) {
			return response.Error(http.StatusBadRequest, "Team name taken", err)
		}
		return response.Error(http.StatusInternalServerError, "Failed to update Team", err)
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
func (tapi *TeamAPI) deleteTeamByID(c *contextmodel.ReqContext) response.Response {
	orgID := c.SignedInUser.GetOrgID()
	teamID, err := strconv.ParseInt(web.Params(c.Req)[":teamId"], 10, 64)
	if err != nil {
		return response.Error(http.StatusBadRequest, "teamId is invalid", err)
	}

	if err := tapi.teamService.DeleteTeam(c.Req.Context(), &team.DeleteTeamCommand{OrgID: orgID, ID: teamID}); err != nil {
		if errors.Is(err, team.ErrTeamNotFound) {
			return response.Error(http.StatusNotFound, "Failed to delete Team. ID not found", nil)
		}
		return response.Error(http.StatusInternalServerError, "Failed to delete Team", err)
	}

	// Clear associated team assignments, managed role and permissions
	if err := tapi.ac.DeleteTeamPermissions(c.Req.Context(), orgID, teamID); err != nil {
		return response.Error(http.StatusInternalServerError, "Failed to delete Team permissions", err)
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
func (tapi *TeamAPI) searchTeams(c *contextmodel.ReqContext) response.Response {
	perPage := c.QueryInt("perpage")
	if perPage <= 0 {
		perPage = 1000
	}
	page := c.QueryInt("page")
	if page < 1 {
		page = 1
	}

	sortOpts, err := sortopts.ParseSortQueryParam(c.Query("sort"))
	if err != nil {
		return response.Err(err)
	}

	stringTeamIDs := c.QueryStrings("teamId")
	queryTeamIDs := make([]int64, 0)
	for _, id := range stringTeamIDs {
		teamID, err := strconv.ParseInt(id, 10, 64)
		if err == nil {
			queryTeamIDs = append(queryTeamIDs, teamID)
		}
	}

	query := team.SearchTeamsQuery{
		OrgID:        c.SignedInUser.GetOrgID(),
		Query:        c.Query("query"),
		Name:         c.Query("name"),
		TeamIds:      queryTeamIDs,
		Page:         page,
		Limit:        perPage,
		SignedInUser: c.SignedInUser,
		HiddenUsers:  tapi.cfg.HiddenUsers,
		SortOpts:     sortOpts,
	}

	queryResult, err := tapi.teamService.SearchTeams(c.Req.Context(), &query)
	if err != nil {
		return response.Error(http.StatusInternalServerError, "Failed to search Teams", err)
	}

	teamIDs := map[string]bool{}
	for _, team := range queryResult.Teams {
		team.AvatarURL = dtos.GetGravatarUrlWithDefault(tapi.cfg, team.Email, team.Name)
		teamIDs[strconv.FormatInt(team.ID, 10)] = true
	}

	metadata := tapi.getMultiAccessControlMetadata(c, "teams:id:", teamIDs)
	if len(metadata) > 0 {
		for _, team := range queryResult.Teams {
			team.AccessControl = metadata[strconv.FormatInt(team.ID, 10)]
		}
	}

	queryResult.Page = page
	queryResult.PerPage = perPage

	return response.JSON(http.StatusOK, queryResult)
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
func (tapi *TeamAPI) getTeamByID(c *contextmodel.ReqContext) response.Response {
	teamId, err := strconv.ParseInt(web.Params(c.Req)[":teamId"], 10, 64)
	if err != nil {
		return response.Error(http.StatusBadRequest, "teamId is invalid", err)
	}

	query := team.GetTeamByIDQuery{
		OrgID:        c.SignedInUser.GetOrgID(),
		ID:           teamId,
		SignedInUser: c.SignedInUser,
		HiddenUsers:  tapi.cfg.HiddenUsers,
	}

	queryResult, err := tapi.teamService.GetTeamByID(c.Req.Context(), &query)
	if err != nil {
		if errors.Is(err, team.ErrTeamNotFound) {
			return response.Error(http.StatusNotFound, "Team not found", err)
		}

		return response.Error(http.StatusInternalServerError, "Failed to get Team", err)
	}

	// Add accesscontrol metadata
	queryResult.AccessControl = tapi.getAccessControlMetadata(c, "teams:id:", strconv.FormatInt(queryResult.ID, 10))

	queryResult.AvatarURL = dtos.GetGravatarUrlWithDefault(tapi.cfg, queryResult.Email, queryResult.Name)
	return response.JSON(http.StatusOK, &queryResult)
}

// swagger:route GET /teams/{team_id}/preferences teams getTeamPreferences
//
// Get Team Preferences.
//
// Responses:
// 200: getPreferencesResponse
// 401: unauthorisedError
// 500: internalServerError
func (tapi *TeamAPI) getTeamPreferences(c *contextmodel.ReqContext) response.Response {
	teamId, err := strconv.ParseInt(web.Params(c.Req)[":teamId"], 10, 64)
	if err != nil {
		return response.Error(http.StatusBadRequest, "teamId is invalid", err)
	}

	return prefapi.GetPreferencesFor(c.Req.Context(), tapi.ds, tapi.preferenceService, c.SignedInUser.GetOrgID(), 0, teamId)
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
func (tapi *TeamAPI) updateTeamPreferences(c *contextmodel.ReqContext) response.Response {
	dtoCmd := dtos.UpdatePrefsCmd{}
	if err := web.Bind(c.Req, &dtoCmd); err != nil {
		return response.Error(http.StatusBadRequest, "bad request data", err)
	}

	teamId, err := strconv.ParseInt(web.Params(c.Req)[":teamId"], 10, 64)
	if err != nil {
		return response.Error(http.StatusBadRequest, "teamId is invalid", err)
	}

	return prefapi.UpdatePreferencesFor(c.Req.Context(), tapi.ds, tapi.preferenceService, c.SignedInUser.GetOrgID(), 0, teamId, &dtoCmd)
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
	Body team.CreateTeamCommand `json:"body"`
}

// swagger:parameters updateTeam
type UpdateTeamParams struct {
	// in:body
	// required:true
	Body team.UpdateTeamCommand `json:"body"`
	// in:path
	// required:true
	TeamID string `json:"team_id"`
}

// swagger:response searchTeamsResponse
type SearchTeamsResponse struct {
	// The response message
	// in: body
	Body team.SearchTeamQueryResult `json:"body"`
}

// swagger:response getTeamByIDResponse
type GetTeamByIDResponse struct {
	// The response message
	// in: body
	Body *team.TeamDTO `json:"body"`
}

// swagger:response createTeamResponse
type CreateTeamResponse struct {
	// The response message
	// in: body
	Body struct {
		TeamId  int64  `json:"teamId"`
		Uid     string `json:"uid"`
		Message string `json:"message"`
	} `json:"body"`
}

// getMultiAccessControlMetadata returns the accesscontrol metadata associated with a given set of resources
// Context must contain permissions in the given org (see LoadPermissionsMiddleware or AuthorizeInOrgMiddleware)
func (tapi *TeamAPI) getMultiAccessControlMetadata(c *contextmodel.ReqContext,
	prefix string, resourceIDs map[string]bool) map[string]accesscontrol.Metadata {
	if !c.QueryBool("accesscontrol") {
		return map[string]accesscontrol.Metadata{}
	}

	if len(c.SignedInUser.GetPermissions()) == 0 {
		return map[string]accesscontrol.Metadata{}
	}

	return accesscontrol.GetResourcesMetadata(c.Req.Context(), c.SignedInUser.GetPermissions(), prefix, resourceIDs)
}

// Metadata helpers
// getAccessControlMetadata returns the accesscontrol metadata associated with a given resource
func (tapi *TeamAPI) getAccessControlMetadata(c *contextmodel.ReqContext,
	prefix string, resourceID string) accesscontrol.Metadata {
	ids := map[string]bool{resourceID: true}
	return tapi.getMultiAccessControlMetadata(c, prefix, ids)[resourceID]
}
