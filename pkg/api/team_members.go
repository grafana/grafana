package api

import (
	"errors"

	"github.com/grafana/grafana/pkg/api/dtos"
	"github.com/grafana/grafana/pkg/api/response"
	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/teamguardian"
	"github.com/grafana/grafana/pkg/util"
)

// GET /api/teams/:teamId/members
func (hs *HTTPServer) GetTeamMembers(c *models.ReqContext) response.Response {
	query := models.GetTeamMembersQuery{OrgId: c.OrgId, TeamId: c.ParamsInt64(":teamId")}

	if err := bus.Dispatch(&query); err != nil {
		return response.Error(500, "Failed to get Team Members", err)
	}

	filteredMembers := make([]*models.TeamMemberDTO, 0, len(query.Result))
	for _, member := range query.Result {
		if dtos.IsHiddenUser(member.Login, c.SignedInUser, hs.Cfg) {
			continue
		}

		member.AvatarUrl = dtos.GetGravatarUrl(member.Email)
		member.Labels = []string{}

		if hs.License.HasValidLicense() && member.External {
			authProvider := GetAuthProviderLabel(member.AuthModule)
			member.Labels = append(member.Labels, authProvider)
		}

		filteredMembers = append(filteredMembers, member)
	}

	return response.JSON(200, filteredMembers)
}

// POST /api/teams/:teamId/members
func (hs *HTTPServer) AddTeamMember(c *models.ReqContext, cmd models.AddTeamMemberCommand) response.Response {
	cmd.OrgId = c.OrgId
	cmd.TeamId = c.ParamsInt64(":teamId")

	if err := teamguardian.CanAdmin(hs.Bus, cmd.OrgId, cmd.TeamId, c.SignedInUser); err != nil {
		return response.Error(403, "Not allowed to add team member", err)
	}

	if err := hs.Bus.Dispatch(&cmd); err != nil {
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
func (hs *HTTPServer) UpdateTeamMember(c *models.ReqContext, cmd models.UpdateTeamMemberCommand) response.Response {
	teamId := c.ParamsInt64(":teamId")
	orgId := c.OrgId

	if err := teamguardian.CanAdmin(hs.Bus, orgId, teamId, c.SignedInUser); err != nil {
		return response.Error(403, "Not allowed to update team member", err)
	}

	if c.OrgRole != models.ROLE_ADMIN {
		cmd.ProtectLastAdmin = true
	}

	cmd.TeamId = teamId
	cmd.UserId = c.ParamsInt64(":userId")
	cmd.OrgId = orgId

	if err := hs.Bus.Dispatch(&cmd); err != nil {
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
	teamId := c.ParamsInt64(":teamId")
	userId := c.ParamsInt64(":userId")

	if err := teamguardian.CanAdmin(hs.Bus, orgId, teamId, c.SignedInUser); err != nil {
		return response.Error(403, "Not allowed to remove team member", err)
	}

	protectLastAdmin := false
	if c.OrgRole != models.ROLE_ADMIN {
		protectLastAdmin = true
	}

	if err := hs.Bus.Dispatch(&models.RemoveTeamMemberCommand{OrgId: orgId, TeamId: teamId, UserId: userId, ProtectLastAdmin: protectLastAdmin}); err != nil {
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
