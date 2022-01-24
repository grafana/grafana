package api

import (
	"errors"
	"net/http"
	"strconv"

	"github.com/grafana/grafana/pkg/api/dtos"
	"github.com/grafana/grafana/pkg/api/response"
	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/util"
	"github.com/grafana/grafana/pkg/web"
)

// GET /api/teams/:teamId/members
func (hs *HTTPServer) GetTeamMembers(c *models.ReqContext) response.Response {
	teamId, err := strconv.ParseInt(web.Params(c.Req)[":teamId"], 10, 64)
	if err != nil {
		return response.Error(http.StatusBadRequest, "teamId is invalid", err)
	}

	query := models.GetTeamMembersQuery{OrgId: c.OrgId, TeamId: teamId}

	if err := bus.Dispatch(c.Req.Context(), &query); err != nil {
		return response.Error(500, "Failed to get Team Members", err)
	}

	filteredMembers := make([]*models.TeamMemberDTO, 0, len(query.Result))
	for _, member := range query.Result {
		if dtos.IsHiddenUser(member.Login, c.SignedInUser, hs.Cfg) {
			continue
		}

		member.AvatarUrl = dtos.GetGravatarUrl(member.Email)
		member.Labels = []string{}

		if hs.License.FeatureEnabled("teamgroupsync") && member.External {
			authProvider := GetAuthProviderLabel(member.AuthModule)
			member.Labels = append(member.Labels, authProvider)
		}

		filteredMembers = append(filteredMembers, member)
	}

	return response.JSON(200, filteredMembers)
}

// POST /api/teams/:teamId/members
func (hs *HTTPServer) AddTeamMember(c *models.ReqContext) response.Response {
	cmd := models.AddTeamMemberCommand{}
	var err error
	if err := web.Bind(c.Req, &cmd); err != nil {
		return response.Error(http.StatusBadRequest, "bad request data", err)
	}
	cmd.OrgId = c.OrgId
	cmd.TeamId, err = strconv.ParseInt(web.Params(c.Req)[":teamId"], 10, 64)
	if err != nil {
		return response.Error(http.StatusBadRequest, "teamId is invalid", err)
	}

	if err := hs.teamGuardian.CanAdmin(c.Req.Context(), cmd.OrgId, cmd.TeamId, c.SignedInUser); err != nil {
		return response.Error(403, "Not allowed to add team member", err)
	}

	err = addTeamMember(hs.SQLStore, cmd.UserId, cmd.OrgId, cmd.TeamId, cmd.External, cmd.Permission)
	if err != nil {
		if errors.Is(err, models.ErrTeamNotFound) {
			return response.Error(404, "Team not found", nil)
		}

		if errors.Is(err, models.ErrTeamMemberAlreadyAdded) {
			return response.Error(400, "User is already added to this team", nil)
		}

		return response.Error(500, "Failed to add Member to Team", err)
	}

	return response.JSON(200, &util.DynMap{
		"message": "Member added to Team",
	})
}

// PUT /:teamId/members/:userId
func (hs *HTTPServer) UpdateTeamMember(c *models.ReqContext) response.Response {
	cmd := models.UpdateTeamMemberCommand{}
	if err := web.Bind(c.Req, &cmd); err != nil {
		return response.Error(http.StatusBadRequest, "bad request data", err)
	}
	teamId, err := strconv.ParseInt(web.Params(c.Req)[":teamId"], 10, 64)
	if err != nil {
		return response.Error(http.StatusBadRequest, "teamId is invalid", err)
	}
	orgId := c.OrgId

	if err := hs.teamGuardian.CanAdmin(c.Req.Context(), orgId, teamId, c.SignedInUser); err != nil {
		return response.Error(403, "Not allowed to update team member", err)
	}

	if c.OrgRole != models.ROLE_ADMIN {
		cmd.ProtectLastAdmin = true
	}

	cmd.TeamId = teamId
	cmd.UserId, err = strconv.ParseInt(web.Params(c.Req)[":userId"], 10, 64)
	if err != nil {
		return response.Error(http.StatusBadRequest, "userId is invalid", err)
	}
	cmd.OrgId = orgId

	if err := hs.Bus.Dispatch(c.Req.Context(), &cmd); err != nil {
		if errors.Is(err, models.ErrTeamMemberNotFound) {
			return response.Error(404, "Team member not found.", nil)
		}
		return response.Error(500, "Failed to update team member.", err)
	}
	return response.Success("Team member updated")
}

// DELETE /api/teams/:teamId/members/:userId
func (hs *HTTPServer) RemoveTeamMember(c *models.ReqContext) response.Response {
	orgId := c.OrgId
	teamId, err := strconv.ParseInt(web.Params(c.Req)[":teamId"], 10, 64)
	if err != nil {
		return response.Error(http.StatusBadRequest, "teamId is invalid", err)
	}
	userId, err := strconv.ParseInt(web.Params(c.Req)[":userId"], 10, 64)
	if err != nil {
		return response.Error(http.StatusBadRequest, "userId is invalid", err)
	}

	if err := hs.teamGuardian.CanAdmin(c.Req.Context(), orgId, teamId, c.SignedInUser); err != nil {
		return response.Error(403, "Not allowed to remove team member", err)
	}

	protectLastAdmin := false
	if c.OrgRole != models.ROLE_ADMIN {
		protectLastAdmin = true
	}

	if err := hs.Bus.Dispatch(c.Req.Context(), &models.RemoveTeamMemberCommand{OrgId: orgId, TeamId: teamId, UserId: userId, ProtectLastAdmin: protectLastAdmin}); err != nil {
		if errors.Is(err, models.ErrTeamNotFound) {
			return response.Error(404, "Team not found", nil)
		}

		if errors.Is(err, models.ErrTeamMemberNotFound) {
			return response.Error(404, "Team member not found", nil)
		}

		return response.Error(500, "Failed to remove Member from Team", err)
	}
	return response.Success("Team Member removed")
}

// addTeamMember adds a team member.
//
// Stubbable by tests.
var addTeamMember = func(sqlStore *sqlstore.SQLStore, userID, orgID, teamID int64, isExternal bool,
	permission models.PermissionType) error {
	return sqlStore.AddTeamMember(userID, orgID, teamID, isExternal, permission)
}
