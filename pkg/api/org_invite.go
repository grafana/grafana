package api

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"strings"

	"github.com/grafana/grafana/pkg/api/dtos"
	"github.com/grafana/grafana/pkg/api/response"
	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/events"
	"github.com/grafana/grafana/pkg/infra/metrics"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/util"
	"github.com/grafana/grafana/pkg/web"
)

func (hs *HTTPServer) GetPendingOrgInvites(c *models.ReqContext) response.Response {
	query := models.GetTempUsersQuery{OrgId: c.OrgId, Status: models.TmpUserInvitePending}

	if err := hs.SQLStore.GetTempUsersQuery(c.Req.Context(), &query); err != nil {
		return response.Error(500, "Failed to get invites from db", err)
	}

	for _, invite := range query.Result {
		invite.Url = setting.ToAbsUrl("invite/" + invite.Code)
	}

	return response.JSON(200, query.Result)
}

func (hs *HTTPServer) AddOrgInvite(c *models.ReqContext) response.Response {
	inviteDto := dtos.AddInviteForm{}
	if err := web.Bind(c.Req, &inviteDto); err != nil {
		return response.Error(http.StatusBadRequest, "bad request data", err)
	}
	if !inviteDto.Role.IsValid() {
		return response.Error(400, "Invalid role specified", nil)
	}

	// first try get existing user
	userQuery := models.GetUserByLoginQuery{LoginOrEmail: inviteDto.LoginOrEmail}
	if err := hs.SQLStore.GetUserByLogin(c.Req.Context(), &userQuery); err != nil {
		if !errors.Is(err, models.ErrUserNotFound) {
			return response.Error(500, "Failed to query db for existing user check", err)
		}
	} else {
		return hs.inviteExistingUserToOrg(c, userQuery.Result, &inviteDto)
	}

	if setting.DisableLoginForm {
		return response.Error(400, "Cannot invite when login is disabled.", nil)
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
		return response.Error(500, "Could not generate random string", err)
	}
	cmd.Role = inviteDto.Role
	cmd.RemoteAddr = c.Req.RemoteAddr

	if err := hs.SQLStore.CreateTempUser(c.Req.Context(), &cmd); err != nil {
		return response.Error(500, "Failed to save invite to database", err)
	}

	// send invite email
	if inviteDto.SendEmail && util.IsEmail(inviteDto.LoginOrEmail) {
		emailCmd := models.SendEmailCommand{
			To:       []string{inviteDto.LoginOrEmail},
			Template: "new_user_invite",
			Data: map[string]interface{}{
				"Name":      util.StringsFallback2(cmd.Name, cmd.Email),
				"OrgName":   c.OrgName,
				"Email":     c.Email,
				"LinkUrl":   setting.ToAbsUrl("invite/" + cmd.Code),
				"InvitedBy": util.StringsFallback3(c.Name, c.Email, c.Login),
			},
		}

		if err := hs.AlertNG.NotificationService.SendEmailCommandHandler(c.Req.Context(), &emailCmd); err != nil {
			if errors.Is(err, models.ErrSmtpNotEnabled) {
				return response.Error(412, err.Error(), err)
			}

			return response.Error(500, "Failed to send email invite", err)
		}

		emailSentCmd := models.UpdateTempUserWithEmailSentCommand{Code: cmd.Result.Code}
		if err := hs.SQLStore.UpdateTempUserWithEmailSent(c.Req.Context(), &emailSentCmd); err != nil {
			return response.Error(500, "Failed to update invite with email sent info", err)
		}

		return response.Success(fmt.Sprintf("Sent invite to %s", inviteDto.LoginOrEmail))
	}

	return response.Success(fmt.Sprintf("Created invite for %s", inviteDto.LoginOrEmail))
}

func (hs *HTTPServer) inviteExistingUserToOrg(c *models.ReqContext, user *models.User, inviteDto *dtos.AddInviteForm) response.Response {
	// user exists, add org role
	createOrgUserCmd := models.AddOrgUserCommand{OrgId: c.OrgId, UserId: user.Id, Role: inviteDto.Role}
	if err := hs.SQLStore.AddOrgUser(c.Req.Context(), &createOrgUserCmd); err != nil {
		if errors.Is(err, models.ErrOrgUserAlreadyAdded) {
			return response.Error(412, fmt.Sprintf("User %s is already added to organization", inviteDto.LoginOrEmail), err)
		}
		return response.Error(500, "Error while trying to create org user", err)
	}

	if inviteDto.SendEmail && util.IsEmail(user.Email) {
		emailCmd := models.SendEmailCommand{
			To:       []string{user.Email},
			Template: "invited_to_org",
			Data: map[string]interface{}{
				"Name":      user.NameOrFallback(),
				"OrgName":   c.OrgName,
				"InvitedBy": util.StringsFallback3(c.Name, c.Email, c.Login),
			},
		}

		if err := hs.AlertNG.NotificationService.SendEmailCommandHandler(c.Req.Context(), &emailCmd); err != nil {
			return response.Error(500, "Failed to send email invited_to_org", err)
		}
	}

	return response.JSON(200, util.DynMap{
		"message": fmt.Sprintf("Existing Grafana user %s added to org %s", user.NameOrFallback(), c.OrgName),
		"userId":  user.Id,
	})
}

func (hs *HTTPServer) RevokeInvite(c *models.ReqContext) response.Response {
	if ok, rsp := hs.updateTempUserStatus(c.Req.Context(), web.Params(c.Req)[":code"], models.TmpUserRevoked); !ok {
		return rsp
	}

	return response.Success("Invite revoked")
}

// GetInviteInfoByCode gets a pending user invite corresponding to a certain code.
// A response containing an InviteInfo object is returned if the invite is found.
// If a (pending) invite is not found, 404 is returned.
func (hs *HTTPServer) GetInviteInfoByCode(c *models.ReqContext) response.Response {
	query := models.GetTempUserByCodeQuery{Code: web.Params(c.Req)[":code"]}
	if err := hs.SQLStore.GetTempUserByCode(c.Req.Context(), &query); err != nil {
		if errors.Is(err, models.ErrTempUserNotFound) {
			return response.Error(404, "Invite not found", nil)
		}
		return response.Error(500, "Failed to get invite", err)
	}

	invite := query.Result
	if invite.Status != models.TmpUserInvitePending {
		return response.Error(404, "Invite not found", nil)
	}

	return response.JSON(200, dtos.InviteInfo{
		Email:     invite.Email,
		Name:      invite.Name,
		Username:  invite.Email,
		InvitedBy: util.StringsFallback3(invite.InvitedByName, invite.InvitedByLogin, invite.InvitedByEmail),
	})
}

func (hs *HTTPServer) CompleteInvite(c *models.ReqContext) response.Response {
	completeInvite := dtos.CompleteInviteForm{}
	var err error
	if err = web.Bind(c.Req, &completeInvite); err != nil {
		return response.Error(http.StatusBadRequest, "bad request data", err)
	}

	completeInvite.Email, err = ValidateAndNormalizeEmail(completeInvite.Email)
	if err != nil {
		return response.Error(http.StatusBadRequest, "Invalid email address provided", nil)
	}

	completeInvite.Username = strings.TrimSpace(completeInvite.Username)

	query := models.GetTempUserByCodeQuery{Code: completeInvite.InviteCode}
	if err := hs.SQLStore.GetTempUserByCode(c.Req.Context(), &query); err != nil {
		if errors.Is(err, models.ErrTempUserNotFound) {
			return response.Error(http.StatusNotFound, "Invite not found", nil)
		}
		return response.Error(http.StatusInternalServerError, "Failed to get invite", err)
	}

	invite := query.Result
	if invite.Status != models.TmpUserInvitePending {
		return response.Error(http.StatusPreconditionFailed, fmt.Sprintf("Invite cannot be used in status %s", invite.Status), nil)
	}

	// In case the user is invited by email address
	if inviteMail, err := ValidateAndNormalizeEmail(invite.Email); err == nil {
		// Make sure that the email address is not amended
		if completeInvite.Email != inviteMail {
			return response.Error(http.StatusBadRequest, "The provided email is different from the address that is found in the invite", nil)
		}
	}

	cmd := models.CreateUserCommand{
		Email:        completeInvite.Email,
		Name:         completeInvite.Name,
		Login:        completeInvite.Username,
		Password:     completeInvite.Password,
		SkipOrgSetup: true,
	}

	user, err := hs.Login.CreateUser(cmd)
	if err != nil {
		if errors.Is(err, models.ErrUserAlreadyExists) {
			return response.Error(412, fmt.Sprintf("User with email '%s' or username '%s' already exists", completeInvite.Email, completeInvite.Username), err)
		}

		return response.Error(500, "failed to create user", err)
	}

	if err := bus.Publish(c.Req.Context(), &events.SignUpCompleted{
		Name:  user.NameOrFallback(),
		Email: user.Email,
	}); err != nil {
		return response.Error(500, "failed to publish event", err)
	}

	if ok, rsp := hs.applyUserInvite(c.Req.Context(), user, invite, true); !ok {
		return rsp
	}

	err = hs.loginUserWithUser(user, c)
	if err != nil {
		return response.Error(500, "failed to accept invite", err)
	}

	metrics.MApiUserSignUpCompleted.Inc()
	metrics.MApiUserSignUpInvite.Inc()

	return response.JSON(200, util.DynMap{
		"message": "User created and logged in",
		"id":      user.Id,
	})
}

func (hs *HTTPServer) updateTempUserStatus(ctx context.Context, code string, status models.TempUserStatus) (bool, response.Response) {
	// update temp user status
	updateTmpUserCmd := models.UpdateTempUserStatusCommand{Code: code, Status: status}
	if err := hs.SQLStore.UpdateTempUserStatus(ctx, &updateTmpUserCmd); err != nil {
		return false, response.Error(500, "Failed to update invite status", err)
	}

	return true, nil
}

func (hs *HTTPServer) applyUserInvite(ctx context.Context, user *models.User, invite *models.TempUserDTO, setActive bool) (bool, response.Response) {
	// add to org
	addOrgUserCmd := models.AddOrgUserCommand{OrgId: invite.OrgId, UserId: user.Id, Role: invite.Role}
	if err := hs.SQLStore.AddOrgUser(ctx, &addOrgUserCmd); err != nil {
		if !errors.Is(err, models.ErrOrgUserAlreadyAdded) {
			return false, response.Error(500, "Error while trying to create org user", err)
		}
	}

	// update temp user status
	if ok, rsp := hs.updateTempUserStatus(ctx, invite.Code, models.TmpUserCompleted); !ok {
		return false, rsp
	}

	if setActive {
		// set org to active
		if err := hs.SQLStore.SetUsingOrg(ctx, &models.SetUsingOrgCommand{OrgId: invite.OrgId, UserId: user.Id}); err != nil {
			return false, response.Error(500, "Failed to set org as active", err)
		}
	}

	return true, nil
}
