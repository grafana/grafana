package api

import (
	"github.com/grafana/grafana/pkg/api/dtos"
	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/middleware"
	m "github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/util"
)

func GetPendingOrgInvites(c *middleware.Context) Response {
	query := m.GetTempUsersForOrgQuery{OrgId: c.OrgId, Status: m.TmpUserInvitePending}

	if err := bus.Dispatch(&query); err != nil {
		return ApiError(500, "Failed to get invites from db", err)
	}

	return Json(200, query.Result)
}

func AddOrgInvite(c *middleware.Context, inviteDto dtos.AddInviteForm) Response {
	if !inviteDto.Role.IsValid() {
		return ApiError(400, "Invalid role specified", nil)
	}
	if !util.IsEmail(inviteDto.Email) {
		return ApiError(400, "Invalid email specified", nil)
	}

	// first try get existing user
	userQuery := m.GetUserByLoginQuery{LoginOrEmail: inviteDto.Email}
	if err := bus.Dispatch(&userQuery); err != nil {
		if err != m.ErrUserNotFound {
			return ApiError(500, "Failed to query db for existing user check", err)
		}
	} else {
		// user exists, add org role
		createOrgUserCmd := m.AddOrgUserCommand{OrgId: c.OrgId, UserId: userQuery.Result.Id, Role: inviteDto.Role}
		if err := bus.Dispatch(&createOrgUserCmd); err != nil {
			return ApiError(500, "Error while trying to create org user", err)
		} else {
			return ApiSuccess("Existing Grafana user added to org " + c.OrgName)
		}
	}

	cmd := m.CreateTempUserCommand{}
	cmd.OrgId = c.OrgId
	cmd.Email = inviteDto.Email
	cmd.Name = inviteDto.Name
	cmd.Status = m.TmpUserInvitePending
	cmd.InvitedByUserId = c.UserId
	cmd.Code = util.GetRandomString(30)
	cmd.Role = inviteDto.Role
	cmd.RemoteAddr = c.Req.RemoteAddr

	if err := bus.Dispatch(&cmd); err != nil {
		return ApiError(500, "Failed to save invite to database", err)
	}

	// send invite email
	if !inviteDto.SkipEmails {
		emailCmd := m.SendEmailCommand{
			To:       []string{inviteDto.Email},
			Template: "new_user_invite.html",
			Data: map[string]interface{}{
				"NameOrEmail": util.StringsFallback2(cmd.Name, cmd.Email),
				"OrgName":     c.OrgName,
				"Email":       c.Email,
				"LinkUrl":     setting.ToAbsUrl("signup/invited/" + cmd.Code),
				"InvitedBy":   util.StringsFallback2(c.Name, c.Email),
			},
		}

		if err := bus.Dispatch(&emailCmd); err != nil {
			return ApiError(500, "Failed to send email invite", err)
		}
	}

	return ApiSuccess("ok, done!")
}

func RevokeInvite(c *middleware.Context) Response {
	cmd := m.UpdateTempUserStatusCommand{
		Id:     c.ParamsInt64(":id"),
		OrgId:  c.OrgId,
		Status: m.TmpUserRevoked,
	}

	if err := bus.Dispatch(&cmd); err != nil {
		return ApiError(500, "Failed to update invite status", err)
	}

	return ApiSuccess("Invite revoked")
}
