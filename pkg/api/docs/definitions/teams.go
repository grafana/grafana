package definitions

import "github.com/grafana/grafana/pkg/models"

// swagger:route GET /teams/search teams searchTeams
//
// Team Search With Paging.
//
// Responses:
// 200: searchTeamsResponse
// 401: unauthorisedError
// 403: forbiddenError
// 500: internalServerError

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

// swagger:route GET /teams/{team_id} teams getTeam
//
// Get Team By ID.
//
// Responses:
// 200: getTeamResponse
// 401: unauthorisedError
// 403: forbiddenError
// 404: notFoundError
// 500: internalServerError

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

// swagger:route GET /teams/{team_id}/members teams getTeamMembers
//
// Get Team Members.
//
// Responses:
// 200: okResponse
// 401: unauthorisedError
// 403: forbiddenError
// 404: notFoundError
// 500: internalServerError

// swagger:route POST /teams/{team_id}/members teams addTeamMember
//
// Add Team Member.
//
// Responses:
// 200: okResponse
// 401: unauthorisedError
// 403: forbiddenError
// 404: notFoundError
// 500: internalServerError

// swagger:route PUT /teams/{team_id}/members/{user_id} teams updateTeamMember
//
// Update Team Member.
//
// Responses:
// 200: okResponse
// 401: unauthorisedError
// 403: forbiddenError
// 404: notFoundError
// 500: internalServerError

// swagger:route DELETE /teams/{team_id}/members/{user_id} teams removeTeamMember
//
// Remove Member From Team.
//
// Responses:
// 200: okResponse
// 401: unauthorisedError
// 403: forbiddenError
// 404: notFoundError
// 500: internalServerError

// swagger:route GET /teams/{team_id}/preferences teams getTeamPreferences
//
// Get Team Preferences.
//
// Responses:
// 200: getPreferencesResponse
// 401: unauthorisedError
// 500: internalServerError

// swagger:route PUT /teams/{team_id}/preferences teams updateTeamPreferences
//
// Update Team Preferences.
//
// Responses:
// 200: okResponse
// 400: badRequestError
// 401: unauthorisedError
// 500: internalServerError

// swagger:parameters getTeam updateTeam deleteTeamByID getTeamMembers addTeamMember updateTeamMember
// swagger:parameters removeTeamMember getTeamPreferences updateTeamPreferences
type TeamIDParam struct {
	// in:path
	// required:true
	TeamID string `json:"team_id"`
}

// swagger:parameters createTeam
type CreateTeamParam struct {
	// in:body
	// required:true
	Body models.CreateTeamCommand `json:"body"`
}

// swagger:parameters updateTeam
type UpdateTeamParam struct {
	// in:body
	// required:true
	Body models.UpdateTeamCommand `json:"body"`
}

// swagger:parameters addTeamMemberTeam
type AddTeamMemberParam struct {
	// in:body
	// required:true
	Body models.AddTeamMemberCommand `json:"body"`
}

// swagger:parameters updateTeamMember
type UpdateTeamMember struct {
	// in:body
	// required:true
	Body models.UpdateTeamMemberCommand `json:"body"`
}

// swagger:response searchTeamsResponse
type SearchTeamsResponse struct {
	// The response message
	// in: body
	Body models.SearchTeamQueryResult `json:"body"`
}

// swagger:response getTeamResponse
type GetTeamResponse struct {
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

// swagger:response getTeamMembersResponse
type GetTeamMembersResponse struct {
	// The response message
	// in: body
	Body []*models.TeamMemberDTO `json:"body"`
}
