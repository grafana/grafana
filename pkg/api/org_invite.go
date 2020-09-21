package api

import (
	"errors"
	"fmt"

	"github.com/grafana/grafana/pkg/api/dtos"
	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/events"
	"github.com/grafana/grafana/pkg/infra/metrics"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/util"
)

func GetPendingOrgInvites(c *models.ReqContext) Response {
	query := models.GetTempUsersQuery{OrgId: c.OrgId, Status: models.TmpUserInvitePending}

	if err := bus.Dispatch(&query); err != nil {
		return Error(500, "Failed to get invites from db", err)
	}

	for _, invite := range query.Result {
		invite.Url = setting.ToAbsUrl("invite/" + invite.Code)
	}

	return JSON(200, query.Result)
}

func AddOrgInvite(c *models.ReqContext, inviteDto dtos.AddInviteForm) Response {
	if !inviteDto.Role.IsValid() {
		return Error(400, "Invalid role specified", nil)
	}

	// first try get existing user
	userQuery := models.GetUserByLoginQuery{LoginOrEmail: inviteDto.LoginOrEmail}
	if err := bus.Dispatch(&userQuery); err != nil {
		if err != models.ErrUserNotFound {
			return Error(500, "Failed to query db for existing user check", err)
		}
	} else {
		return inviteExistingUserToOrg(c, userQuery.Result, &inviteDto)
	}

	if setting.DisableLoginForm {
		return Error(400, "Cannot invite when login is disabled.", nil)
	}

	cmd := models.CreateTempUserCommand{}
	cmd.OrgId = c.OrgId
	cmd.Email = inviteDto.LoginOrEmail
	cmd.Name = inviteDto.Name
	cmd.Status = models.TmpUserInvitePending
	cmd.InvitedByUserId = c.UserId
	var err error
	cmd.Code, err = util.GetRandomString(30)
	if err != nil {
		return Error(500, "Could not generate random string", err)
	}
	cmd.Role = inviteDto.Role
	cmd.RemoteAddr = c.Req.RemoteAddr

	if err := bus.Dispatch(&cmd); err != nil {
		return Error(500, "Failed to save invite to database", err)
	}

	// send invite email
	if inviteDto.SendEmail && util.IsEmail(inviteDto.LoginOrEmail) {
		emailCmd := models.SendEmailCommand{
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
			if err == models.ErrSmtpNotEnabled {
				return Error(412, err.Error(), err)
			}

			return Error(500, "Failed to send email invite", err)
		}

		emailSentCmd := models.UpdateTempUserWithEmailSentCommand{Code: cmd.Result.Code}
		if err := bus.Dispatch(&emailSentCmd); err != nil {
			return Error(500, "Failed to update invite with email sent info", err)
		}

		return Success(fmt.Sprintf("Sent invite to %s", inviteDto.LoginOrEmail))
	}

	return Success(fmt.Sprintf("Created invite for %s", inviteDto.LoginOrEmail))
}

func inviteExistingUserToOrg(c *models.ReqContext, user *models.User, inviteDto *dtos.AddInviteForm) Response {
	// user exists, add org role
	createOrgUserCmd := models.AddOrgUserCommand{OrgId: c.OrgId, UserId: user.Id, Role: inviteDto.Role}
	if err := bus.Dispatch(&createOrgUserCmd); err != nil {
		if err == models.ErrOrgUserAlreadyAdded {
			return Error(412, fmt.Sprintf("User %s is already added to organization", inviteDto.LoginOrEmail), err)
		}
		return Error(500, "Error while trying to create org user", err)
	}

	if inviteDto.SendEmail && util.IsEmail(user.Email) {
		emailCmd := models.SendEmailCommand{
			To:       []string{user.Email},
			Template: "invited_to_org.html",
			Data: map[string]interface{}{
				"Name":      user.NameOrFallback(),
				"OrgName":   c.OrgName,
				"InvitedBy": util.StringsFallback3(c.Name, c.Email, c.Login),
			},
		}

		if err := bus.Dispatch(&emailCmd); err != nil {
			return Error(500, "Failed to send email invited_to_org", err)
		}
	}

	return JSON(200, util.DynMap{
		"message": fmt.Sprintf("Existing Grafana user %s added to org %s", user.NameOrFallback(), c.OrgName),
		"userId":  user.Id,
	})
}

func RevokeInvite(c *models.ReqContext) Response {
	if ok, rsp := updateTempUserStatus(c.Params(":code"), models.TmpUserRevoked); !ok {
		return rsp
	}

	return Success("Invite revoked")
}

// GetInviteInfoByCode gets a pending user invite corresponding to a certain code.
// A response containing an InviteInfo object is returned if the invite is found.
// If a (pending) invite is not found, 404 is returned.
func GetInviteInfoByCode(c *models.ReqContext) Response {
	query := models.GetTempUserByCodeQuery{Code: c.Params(":code")}
	if err := bus.Dispatch(&query); err != nil {
		if err == models.ErrTempUserNotFound {
			return Error(404, "Invite not found", nil)
		}
		return Error(500, "Failed to get invite", err)
	}

	invite := query.Result
	if invite.Status != models.TmpUserInvitePending {
		return Error(404, "Invite not found", nil)
	}

	return JSON(200, dtos.InviteInfo{
		Email:     invite.Email,
		Name:      invite.Name,
		Username:  invite.Email,
		InvitedBy: util.StringsFallback3(invite.InvitedByName, invite.InvitedByLogin, invite.InvitedByEmail),
	})
}

func (hs *HTTPServer) CompleteInvite(c *models.ReqContext, completeInvite dtos.CompleteInviteForm) Response {
	query := models.GetTempUserByCodeQuery{Code: completeInvite.InviteCode}

	if err := bus.Dispatch(&query); err != nil {
		if err == models.ErrTempUserNotFound {
			return Error(404, "Invite not found", nil)
		}
		return Error(500, "Failed to get invite", err)
	}

	invite := query.Result
	if invite.Status != models.TmpUserInvitePending {
		return Error(412, fmt.Sprintf("Invite cannot be used in status %s", invite.Status), nil)
	}

	cmd := models.CreateUserCommand{
		Email:        completeInvite.Email,
		Name:         completeInvite.Name,
		Login:        completeInvite.Username,
		Password:     completeInvite.Password,
		SkipOrgSetup: true,
	}

	if err := bus.Dispatch(&cmd); err != nil {
		if errors.Is(err, models.ErrUserAlreadyExists) {
			return Error(412, fmt.Sprintf("User with email '%s' or username '%s' already exists", completeInvite.Email, completeInvite.Username), err)
		}

		return Error(500, "failed to create user", err)
	}

	user := &cmd.Result

	if err := bus.Publish(&events.SignUpCompleted{
		Name:  user.NameOrFallback(),
		Email: user.Email,
	}); err != nil {
		return Error(500, "failed to publish event", err)
	}

	if ok, rsp := applyUserInvite(user, invite, true); !ok {
		return rsp
	}

	err := hs.loginUserWithUser(user, c)
	if err != nil {
		return Error(500, "failed to accept invite", err)
	}

	metrics.MApiUserSignUpCompleted.Inc()
	metrics.MApiUserSignUpInvite.Inc()

	return JSON(200, util.DynMap{
		"message": "User created and logged in",
		"id":      user.Id,
	})
}

func updateTempUserStatus(code string, status models.TempUserStatus) (bool, Response) {
	// update temp user status
	updateTmpUserCmd := models.UpdateTempUserStatusCommand{Code: code, Status: status}
	if err := bus.Dispatch(&updateTmpUserCmd); err != nil {
		return false, Error(500, "Failed to update invite status", err)
	}

	return true, nil
}

func applyUserInvite(user *models.User, invite *models.TempUserDTO, setActive bool) (bool, Response) {
	// add to org
	addOrgUserCmd := models.AddOrgUserCommand{OrgId: invite.OrgId, UserId: user.Id, Role: invite.Role}
	if err := bus.Dispatch(&addOrgUserCmd); err != nil {
		if err != models.ErrOrgUserAlreadyAdded {
			return false, Error(500, "Error while trying to create org user", err)
		}
	}

	// update temp user status
	if ok, rsp := updateTempUserStatus(invite.Code, models.TmpUserCompleted); !ok {
		return false, rsp
	}

	if setActive {
		// set org to active
		if err := bus.Dispatch(&models.SetUsingOrgCommand{OrgId: invite.OrgId, UserId: user.Id}); err != nil {
			return false, Error(500, "Failed to set org as active", err)
		}
	}

	return true, nil
}
