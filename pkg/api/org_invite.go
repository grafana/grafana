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
	query := m.GetTempUsersQuery{OrgId: c.OrgId, Status: m.TmpUserInvitePending}

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

	// first try get existing user
	userQuery := m.GetUserByLoginQuery{LoginOrEmail: inviteDto.LoginOrEmail}
	if err := bus.Dispatch(&userQuery); err != nil {
		if err != m.ErrUserNotFound {
			return ApiError(500, "Failed to query db for existing user check", err)
		}
	} else {
		return inviteExistingUserToOrg(c, userQuery.Result, &inviteDto)
	}

	cmd := m.CreateTempUserCommand{}
	cmd.OrgId = c.OrgId
	cmd.Email = inviteDto.LoginOrEmail
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
	if !inviteDto.SkipEmails && util.IsEmail(inviteDto.LoginOrEmail) {
		emailCmd := m.SendEmailCommand{
			To:       []string{inviteDto.LoginOrEmail},
			Template: "new_user_invite.html",
			Data: map[string]interface{}{
				"Name":      util.StringsFallback2(cmd.Name, cmd.Email),
				"OrgName":   c.OrgName,
				"Email":     c.Email,
				"LinkUrl":   setting.ToAbsUrl("invite/" + cmd.Code),
				"InvitedBy": util.StringsFallback3(c.Name, c.Email, c.Login),
			},
		}

		if err := bus.Dispatch(&emailCmd); err != nil {
			return ApiError(500, "Failed to send email invite", err)
		}

		return ApiSuccess(fmt.Sprintf("Sent invite to %s", inviteDto.LoginOrEmail))
	}

	return ApiSuccess(fmt.Sprintf("Created invite for %s", inviteDto.LoginOrEmail))
}

func inviteExistingUserToOrg(c *middleware.Context, user *m.User, inviteDto *dtos.AddInviteForm) Response {
	// user exists, add org role
	createOrgUserCmd := m.AddOrgUserCommand{OrgId: c.OrgId, UserId: user.Id, Role: inviteDto.Role}
	if err := bus.Dispatch(&createOrgUserCmd); err != nil {
		if err == m.ErrOrgUserAlreadyAdded {
			return ApiError(412, fmt.Sprintf("User %s is already added to organization", inviteDto.LoginOrEmail), err)
		}
		return ApiError(500, "Error while trying to create org user", err)
	} else {

		if !inviteDto.SkipEmails && util.IsEmail(user.Email) {
			emailCmd := m.SendEmailCommand{
				To:       []string{user.Email},
				Template: "invited_to_org.html",
				Data: map[string]interface{}{
					"Name":      user.NameOrFallback(),
					"OrgName":   c.OrgName,
					"InvitedBy": util.StringsFallback3(c.Name, c.Email, c.Login),
				},
			}

			if err := bus.Dispatch(&emailCmd); err != nil {
				return ApiError(500, "Failed to send email invited_to_org", err)
			}
		}

		return ApiSuccess(fmt.Sprintf("Existing Grafana user %s added to org %s", user.NameOrFallback(), c.OrgName))
	}
}

func RevokeInvite(c *middleware.Context) Response {
	if ok, rsp := updateTempUserStatus(c.Params(":code"), m.TmpUserRevoked); !ok {
		return rsp
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

	invite := query.Result

	return Json(200, dtos.InviteInfo{
		Email:     invite.Email,
		Name:      invite.Name,
		Username:  invite.Email,
		InvitedBy: util.StringsFallback3(invite.InvitedByName, invite.InvitedByLogin, invite.InvitedByEmail),
	})
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
		Email:        completeInvite.Email,
		Name:         completeInvite.Name,
		Login:        completeInvite.Username,
		Password:     completeInvite.Password,
		SkipOrgSetup: true,
	}

	if err := bus.Dispatch(&cmd); err != nil {
		return ApiError(500, "failed to create user", err)
	}

	user := &cmd.Result

	bus.Publish(&events.SignUpCompleted{
		Name:  user.NameOrFallback(),
		Email: user.Email,
	})

	if ok, rsp := applyUserInvite(user, invite, true); !ok {
		return rsp
	}

	loginUserWithUser(user, c)

	metrics.M_Api_User_SignUpCompleted.Inc(1)
	metrics.M_Api_User_SignUpInvite.Inc(1)

	return ApiSuccess("User created and logged in")
}

func updateTempUserStatus(code string, status m.TempUserStatus) (bool, Response) {
	// update temp user status
	updateTmpUserCmd := m.UpdateTempUserStatusCommand{Code: code, Status: status}
	if err := bus.Dispatch(&updateTmpUserCmd); err != nil {
		return false, ApiError(500, "Failed to update invite status", err)
	}

	return true, nil
}

func applyUserInvite(user *m.User, invite *m.TempUserDTO, setActive bool) (bool, Response) {
	// add to org
	addOrgUserCmd := m.AddOrgUserCommand{OrgId: invite.OrgId, UserId: user.Id, Role: invite.Role}
	if err := bus.Dispatch(&addOrgUserCmd); err != nil {
		if err != m.ErrOrgUserAlreadyAdded {
			return false, ApiError(500, "Error while trying to create org user", err)
		}
	}

	// update temp user status
	if ok, rsp := updateTempUserStatus(invite.Code, m.TmpUserCompleted); !ok {
		return false, rsp
	}

	if setActive {
		// set org to active
		if err := bus.Dispatch(&m.SetUsingOrgCommand{OrgId: invite.OrgId, UserId: user.Id}); err != nil {
			return false, ApiError(500, "Failed to set org as active", err)
		}
	}

	return true, nil
}
