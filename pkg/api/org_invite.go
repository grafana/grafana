package api

import (
	"fmt"

	"github.com/grafana/grafana/pkg/api/dtos"
	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/events"
	"github.com/grafana/grafana/pkg/metrics"
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

	for _, invite := range query.Result {
		invite.Url = setting.ToAbsUrl("invite/" + invite.Code)
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
			if err == m.ErrOrgUserAlreadyAdded {
				return ApiError(412, fmt.Sprintf("User %s is already added to organization", inviteDto.Email), err)
			}
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
		return ApiSuccess(fmt.Sprintf("Sent invite to %s", inviteDto.Email))
	}

	return ApiSuccess(fmt.Sprintf("Created invite for %s", inviteDto.Email))
}

func RevokeInvite(c *middleware.Context) Response {
	cmd := m.UpdateTempUserStatusCommand{
		Code:   c.Params(":code"),
		Status: m.TmpUserRevoked,
	}

	if err := bus.Dispatch(&cmd); err != nil {
		return ApiError(500, "Failed to update invite status", err)
	}

	return ApiSuccess("Invite revoked")
}

func GetInviteInfoByCode(c *middleware.Context) Response {
	query := m.GetTempUserByCodeQuery{Code: c.Params(":code")}

	if err := bus.Dispatch(&query); err != nil {
		if err == m.ErrTempUserNotFound {
			return ApiError(404, "Invite not found", nil)
		}
		return ApiError(500, "Failed to get invite", err)
	}

	info := dtos.InviteInfo{
		Email:    query.Result.Email,
		Name:     query.Result.Name,
		Username: query.Result.Email,
	}

	return Json(200, &info)
}

func CompleteInvite(c *middleware.Context, completeInvite dtos.CompleteInviteForm) Response {
	query := m.GetTempUserByCodeQuery{Code: completeInvite.InviteCode}

	if err := bus.Dispatch(&query); err != nil {
		if err == m.ErrTempUserNotFound {
			return ApiError(404, "Invite not found", nil)
		}
		return ApiError(500, "Failed to get invite", err)
	}

	invite := query.Result
	if invite.Status != m.TmpUserInvitePending {
		return ApiError(412, fmt.Sprintf("Invite cannot be used in status %s", invite.Status), nil)
	}

	cmd := m.CreateUserCommand{
		Email:    completeInvite.Email,
		Name:     completeInvite.Name,
		Login:    completeInvite.Username,
		Password: completeInvite.Password,
	}

	if err := bus.Dispatch(&cmd); err != nil {
		return ApiError(500, "failed to create user", err)
	}

	user := cmd.Result

	bus.Publish(&events.UserSignedUp{
		Id:    user.Id,
		Name:  user.Name,
		Email: user.Email,
		Login: user.Login,
	})

	// update temp user status
	updateTmpUserCmd := m.UpdateTempUserStatusCommand{Code: invite.Code, Status: m.TmpUserCompleted}
	if err := bus.Dispatch(&updateTmpUserCmd); err != nil {
		return ApiError(500, "Failed to update invite status", err)
	}

	loginUserWithUser(&user, c)

	metrics.M_Api_User_SignUp.Inc(1)
	metrics.M_Api_User_SignUpInvite.Inc(1)

	return ApiSuccess("User created and logged in")
}
