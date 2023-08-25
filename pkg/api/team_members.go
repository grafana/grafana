package api

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"strconv"

	"github.com/grafana/grafana/pkg/api/dtos"
	"github.com/grafana/grafana/pkg/api/response"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	contextmodel "github.com/grafana/grafana/pkg/services/contexthandler/model"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/login"
	"github.com/grafana/grafana/pkg/services/team"
	"github.com/grafana/grafana/pkg/util"
	"github.com/grafana/grafana/pkg/web"
)

// swagger:route GET /teams/{team_id}/members teams getTeamMembers
//
// Get Team Members.
//
// Responses:
// 200: getTeamMembersResponse
// 401: unauthorisedError
// 403: forbiddenError
// 404: notFoundError
// 500: internalServerError
func (hs *HTTPServer) GetTeamMembers(c *contextmodel.ReqContext) response.Response {
	teamId, err := strconv.ParseInt(web.Params(c.Req)[":teamId"], 10, 64)
	if err != nil {
		return response.Error(http.StatusBadRequest, "teamId is invalid", err)
	}

	query := team.GetTeamMembersQuery{OrgID: c.OrgID, TeamID: teamId, SignedInUser: c.SignedInUser}

	queryResult, err := hs.teamService.GetTeamMembers(c.Req.Context(), &query)
	if err != nil {
		return response.Error(500, "Failed to get Team Members", err)
	}

	filteredMembers := make([]*team.TeamMemberDTO, 0, len(queryResult))
	for _, member := range queryResult {
		if dtos.IsHiddenUser(member.Login, c.SignedInUser, hs.Cfg) {
			continue
		}

		member.AvatarURL = dtos.GetGravatarUrl(member.Email)
		member.Labels = []string{}

		if hs.License.FeatureEnabled("teamgroupsync") && member.External {
			authProvider := login.GetAuthProviderLabel(member.AuthModule)
			member.Labels = append(member.Labels, authProvider)
		}

		filteredMembers = append(filteredMembers, member)
	}

	return response.JSON(http.StatusOK, filteredMembers)
}

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
func (hs *HTTPServer) AddTeamMember(c *contextmodel.ReqContext) response.Response {
	cmd := team.AddTeamMemberCommand{}
	var err error
	if err := web.Bind(c.Req, &cmd); err != nil {
		return response.Error(http.StatusBadRequest, "bad request data", err)
	}
	cmd.OrgID = c.OrgID
	cmd.TeamID, err = strconv.ParseInt(web.Params(c.Req)[":teamId"], 10, 64)
	if err != nil {
		return response.Error(http.StatusBadRequest, "teamId is invalid", err)
	}

	isTeamMember, err := hs.teamService.IsTeamMember(c.OrgID, cmd.TeamID, cmd.UserID)
	if err != nil {
		return response.Error(500, "Failed to add team member.", err)
	}
	if isTeamMember {
		return response.Error(400, "User is already added to this team", nil)
	}

	err = addOrUpdateTeamMember(c.Req.Context(), hs.teamPermissionsService, cmd.UserID, cmd.OrgID, cmd.TeamID, getPermissionName(cmd.Permission))
	if err != nil {
		return response.Error(500, "Failed to add Member to Team", err)
	}

	return response.JSON(http.StatusOK, &util.DynMap{
		"message": "Member added to Team",
	})
}

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
func (hs *HTTPServer) UpdateTeamMember(c *contextmodel.ReqContext) response.Response {
	cmd := team.UpdateTeamMemberCommand{}
	if err := web.Bind(c.Req, &cmd); err != nil {
		return response.Error(http.StatusBadRequest, "bad request data", err)
	}
	teamId, err := strconv.ParseInt(web.Params(c.Req)[":teamId"], 10, 64)
	if err != nil {
		return response.Error(http.StatusBadRequest, "teamId is invalid", err)
	}
	userId, err := strconv.ParseInt(web.Params(c.Req)[":userId"], 10, 64)
	if err != nil {
		return response.Error(http.StatusBadRequest, "userId is invalid", err)
	}
	orgId := c.OrgID

	isTeamMember, err := hs.teamService.IsTeamMember(orgId, teamId, userId)
	if err != nil {
		return response.Error(500, "Failed to update team member.", err)
	}
	if !isTeamMember {
		return response.Error(404, "Team member not found.", nil)
	}

	err = addOrUpdateTeamMember(c.Req.Context(), hs.teamPermissionsService, userId, orgId, teamId, getPermissionName(cmd.Permission))
	if err != nil {
		return response.Error(500, "Failed to update team member.", err)
	}
	return response.Success("Team member updated")
}

func getPermissionName(permission dashboards.PermissionType) string {
	permissionName := permission.String()
	// Team member permission is 0, which maps to an empty string.
	// However, we want the team permission service to display "Member" for team members. This is a hack to make it work.
	if permissionName == "" {
		permissionName = "Member"
	}
	return permissionName
}

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
func (hs *HTTPServer) RemoveTeamMember(c *contextmodel.ReqContext) response.Response {
	orgId := c.OrgID
	teamId, err := strconv.ParseInt(web.Params(c.Req)[":teamId"], 10, 64)
	if err != nil {
		return response.Error(http.StatusBadRequest, "teamId is invalid", err)
	}
	userId, err := strconv.ParseInt(web.Params(c.Req)[":userId"], 10, 64)
	if err != nil {
		return response.Error(http.StatusBadRequest, "userId is invalid", err)
	}

	teamIDString := strconv.FormatInt(teamId, 10)
	if _, err := hs.teamPermissionsService.SetUserPermission(c.Req.Context(), orgId, accesscontrol.User{ID: userId}, teamIDString, ""); err != nil {
		if errors.Is(err, team.ErrTeamNotFound) {
			return response.Error(404, "Team not found", nil)
		}

		if errors.Is(err, team.ErrTeamMemberNotFound) {
			return response.Error(404, "Team member not found", nil)
		}

		return response.Error(500, "Failed to remove Member from Team", err)
	}
	return response.Success("Team Member removed")
}

// addOrUpdateTeamMember adds or updates a team member.
//
// Stubbable by tests.
var addOrUpdateTeamMember = func(ctx context.Context, resourcePermissionService accesscontrol.TeamPermissionsService, userID, orgID, teamID int64, permission string) error {
	teamIDString := strconv.FormatInt(teamID, 10)
	if _, err := resourcePermissionService.SetUserPermission(ctx, orgID, accesscontrol.User{ID: userID}, teamIDString, permission); err != nil {
		return fmt.Errorf("failed setting permissions for user %d in team %d: %w", userID, teamID, err)
	}
	return nil
}

// swagger:parameters getTeamMembers
type GetTeamMembersParams struct {
	// in:path
	// required:true
	TeamID string `json:"team_id"`
}

// swagger:parameters addTeamMember
type AddTeamMemberParams struct {
	// in:body
	// required:true
	Body team.AddTeamMemberCommand `json:"body"`
	// in:path
	// required:true
	TeamID string `json:"team_id"`
}

// swagger:parameters updateTeamMember
type UpdateTeamMemberParams struct {
	// in:body
	// required:true
	Body team.UpdateTeamMemberCommand `json:"body"`
	// in:path
	// required:true
	TeamID string `json:"team_id"`
	// in:path
	// required:true
	UserID int64 `json:"user_id"`
}

// swagger:parameters removeTeamMember
type RemoveTeamMemberParams struct {
	// in:path
	// required:true
	TeamID string `json:"team_id"`
	// in:path
	// required:true
	UserID int64 `json:"user_id"`
}

// swagger:response getTeamMembersResponse
type GetTeamMembersResponse struct {
	// The response message
	// in: body
	Body []*team.TeamMemberDTO `json:"body"`
}
