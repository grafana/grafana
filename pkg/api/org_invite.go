package api

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"strconv"
	"strings"

	"github.com/grafana/grafana/pkg/api/dtos"
	"github.com/grafana/grafana/pkg/api/response"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/events"
	"github.com/grafana/grafana/pkg/infra/metrics"
	ac "github.com/grafana/grafana/pkg/services/accesscontrol"
	contextmodel "github.com/grafana/grafana/pkg/services/contexthandler/model"
	"github.com/grafana/grafana/pkg/services/notifications"
	"github.com/grafana/grafana/pkg/services/org"
	tempuser "github.com/grafana/grafana/pkg/services/temp_user"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/util"
	"github.com/grafana/grafana/pkg/web"
)

// swagger:route GET /org/invites org_invites getPendingOrgInvites
//
// Get pending invites.
//
// Responses:
// 200: getPendingOrgInvitesResponse
// 401: unauthorisedError
// 403: forbiddenError
// 500: internalServerError
func (hs *HTTPServer) GetPendingOrgInvites(c *contextmodel.ReqContext) response.Response {
	query := tempuser.GetTempUsersQuery{OrgID: c.GetOrgID(), Status: tempuser.TmpUserInvitePending}

	queryResult, err := hs.tempUserService.GetTempUsersQuery(c.Req.Context(), &query)
	if err != nil {
		return response.Error(http.StatusInternalServerError, "Failed to get invites from db", err)
	}

	for _, invite := range queryResult {
		invite.URL = setting.ToAbsUrl("invite/" + invite.Code)
	}

	return response.JSON(http.StatusOK, queryResult)
}

// swagger:route POST /org/invites org_invites addOrgInvite
//
// Add invite.
//
// Responses:
// 200: okResponse
// 400: badRequestError
// 401: unauthorisedError
// 403: forbiddenError
// 412: SMTPNotEnabledError
// 500: internalServerError
func (hs *HTTPServer) AddOrgInvite(c *contextmodel.ReqContext) response.Response {
	inviteDto := dtos.AddInviteForm{}
	if err := web.Bind(c.Req, &inviteDto); err != nil {
		return response.Error(http.StatusBadRequest, "bad request data", err)
	}
	if !inviteDto.Role.IsValid() {
		return response.Error(http.StatusBadRequest, "Invalid role specified", nil)
	}
	if !c.SignedInUser.GetOrgRole().Includes(inviteDto.Role) && !c.GetIsGrafanaAdmin() {
		return response.Error(http.StatusForbidden, "Cannot assign a role higher than user's role", nil)
	}

	// first try get existing user
	userQuery := user.GetUserByLoginQuery{LoginOrEmail: inviteDto.LoginOrEmail}
	usr, err := hs.userService.GetByLogin(c.Req.Context(), &userQuery)
	if err != nil {
		if !errors.Is(err, user.ErrUserNotFound) {
			return response.Error(http.StatusInternalServerError, "Failed to query db for existing user check", err)
		}
	} else {
		// Evaluate permissions for adding an existing user to the organization
		userIDScope := ac.Scope("users", "id", strconv.Itoa(int(usr.ID)))
		hasAccess, err := hs.AccessControl.Evaluate(c.Req.Context(), c.SignedInUser, ac.EvalPermission(ac.ActionOrgUsersAdd, userIDScope))
		if err != nil {
			return response.Error(http.StatusInternalServerError, "Failed to evaluate permissions", err)
		}
		if !hasAccess {
			return response.Error(http.StatusForbidden, "Permission denied: not permitted to add an existing user to this organisation", err)
		}
		return hs.inviteExistingUserToOrg(c, usr, &inviteDto)
	}

	if hs.Cfg.DisableLoginForm {
		return response.Error(http.StatusBadRequest, "Cannot invite external user when login is disabled.", nil)
	}

	cmd := tempuser.CreateTempUserCommand{}
	cmd.OrgID = c.GetOrgID()
	cmd.Email = inviteDto.LoginOrEmail
	cmd.Name = inviteDto.Name
	cmd.Status = tempuser.TmpUserInvitePending

	var userID int64
	if id, err := identity.UserIdentifier(c.GetID()); err == nil {
		userID = id
	}

	cmd.InvitedByUserID = userID
	cmd.Code, err = util.GetRandomString(30)
	if err != nil {
		return response.Error(http.StatusInternalServerError, "Could not generate random string", err)
	}
	cmd.Role = inviteDto.Role
	cmd.RemoteAddr = c.RemoteAddr()

	cmdResult, err := hs.tempUserService.CreateTempUser(c.Req.Context(), &cmd)
	if err != nil {
		return response.Error(http.StatusInternalServerError, "Failed to save invite to database", err)
	}

	// send invite email
	if inviteDto.SendEmail && util.IsEmail(inviteDto.LoginOrEmail) {
		emailCmd := notifications.SendEmailCommand{
			To:       []string{inviteDto.LoginOrEmail},
			Template: "new_user_invite",
			Data: map[string]any{
				"Name":      util.StringsFallback2(cmd.Name, cmd.Email),
				"OrgName":   c.GetOrgName(),
				"Email":     c.GetEmail(),
				"LinkUrl":   setting.ToAbsUrl("invite/" + cmd.Code),
				"InvitedBy": c.GetName(),
			},
		}

		if err := hs.AlertNG.NotificationService.SendEmailCommandHandler(c.Req.Context(), &emailCmd); err != nil {
			if errors.Is(err, notifications.ErrSmtpNotEnabled) {
				return response.Error(http.StatusPreconditionFailed, err.Error(), err)
			}

			return response.Error(http.StatusInternalServerError, "Failed to send email invite", err)
		}

		emailSentCmd := tempuser.UpdateTempUserWithEmailSentCommand{Code: cmdResult.Code}
		if err := hs.tempUserService.UpdateTempUserWithEmailSent(c.Req.Context(), &emailSentCmd); err != nil {
			return response.Error(http.StatusInternalServerError, "Failed to update invite with email sent info", err)
		}

		return response.Success(fmt.Sprintf("Sent invite to %s", inviteDto.LoginOrEmail))
	}

	return response.Success(fmt.Sprintf("Created invite for %s", inviteDto.LoginOrEmail))
}

func (hs *HTTPServer) inviteExistingUserToOrg(c *contextmodel.ReqContext, user *user.User, inviteDto *dtos.AddInviteForm) response.Response {
	// user exists, add org role
	createOrgUserCmd := org.AddOrgUserCommand{OrgID: c.GetOrgID(), UserID: user.ID, Role: inviteDto.Role}
	if err := hs.orgService.AddOrgUser(c.Req.Context(), &createOrgUserCmd); err != nil {
		if errors.Is(err, org.ErrOrgUserAlreadyAdded) {
			return response.Error(http.StatusPreconditionFailed, fmt.Sprintf("User %s is already added to organization", inviteDto.LoginOrEmail), err)
		}
		return response.Error(http.StatusInternalServerError, "Error while trying to create org user", err)
	}

	if inviteDto.SendEmail && util.IsEmail(user.Email) {
		emailCmd := notifications.SendEmailCommand{
			To:       []string{user.Email},
			Template: "invited_to_org",
			Data: map[string]any{
				"Name":      user.NameOrFallback(),
				"OrgName":   c.GetOrgName(),
				"InvitedBy": c.GetName(),
			},
		}

		if err := hs.AlertNG.NotificationService.SendEmailCommandHandler(c.Req.Context(), &emailCmd); err != nil {
			return response.Error(http.StatusInternalServerError, "Failed to send email invited_to_org", err)
		}
	}

	return response.JSON(http.StatusOK, util.DynMap{
		"message": fmt.Sprintf("Existing Grafana user %s added to org %s", user.NameOrFallback(), c.GetOrgName()),
		"userId":  user.ID,
	})
}

// swagger:route DELETE /org/invites/{invitation_code}/revoke org_invites revokeInvite
//
// Revoke invite.
//
// Responses:
// 200: okResponse
// 401: unauthorisedError
// 403: forbiddenError
// 404: notFoundError
// 500: internalServerError
func (hs *HTTPServer) RevokeInvite(c *contextmodel.ReqContext) response.Response {
	query := tempuser.GetTempUserByCodeQuery{Code: web.Params(c.Req)[":code"]}
	queryResult, err := hs.tempUserService.GetTempUserByCode(c.Req.Context(), &query)
	if err != nil {
		if errors.Is(err, tempuser.ErrTempUserNotFound) {
			return response.Error(http.StatusNotFound, "Invite not found", nil)
		}
		return response.Error(http.StatusInternalServerError, "Failed to get invite", err)
	}

	canRevoke := c.GetOrgID() == queryResult.OrgID || c.GetIsGrafanaAdmin()
	if !canRevoke {
		return response.Error(http.StatusForbidden, "Permission denied: not permitted to revoke invite", nil)
	}

	if ok, rsp := hs.updateTempUserStatus(c.Req.Context(), web.Params(c.Req)[":code"], tempuser.TmpUserRevoked); !ok {
		return rsp
	}

	return response.Success("Invite revoked")
}

// GetInviteInfoByCode gets a pending user invite corresponding to a certain code.
// A response containing an InviteInfo object is returned if the invite is found.
// If a (pending) invite is not found, 404 is returned.
func (hs *HTTPServer) GetInviteInfoByCode(c *contextmodel.ReqContext) response.Response {
	query := tempuser.GetTempUserByCodeQuery{Code: web.Params(c.Req)[":code"]}
	queryResult, err := hs.tempUserService.GetTempUserByCode(c.Req.Context(), &query)
	if err != nil {
		if errors.Is(err, tempuser.ErrTempUserNotFound) {
			return response.Error(http.StatusNotFound, "Invite not found", nil)
		}
		return response.Error(http.StatusInternalServerError, "Failed to get invite", err)
	}

	invite := queryResult
	if invite.Status != tempuser.TmpUserInvitePending {
		return response.Error(http.StatusNotFound, "Invite not found", nil)
	}

	orgResult, err := hs.orgService.GetByID(c.Req.Context(), &org.GetOrgByIDQuery{
		ID: invite.OrgID,
	})
	if err != nil {
		if errors.Is(err, org.ErrOrgNotFound) {
			return response.Error(http.StatusNotFound, "org not found", nil)
		}
		return response.Error(http.StatusInternalServerError, "Failed to get org", err)
	}

	return response.JSON(http.StatusOK, dtos.InviteInfo{
		Email:     invite.Email,
		Name:      invite.Name,
		Username:  invite.Email,
		InvitedBy: util.StringsFallback3(invite.InvitedByName, invite.InvitedByLogin, invite.InvitedByEmail),
		OrgName:   orgResult.Name,
	})
}

func (hs *HTTPServer) CompleteInvite(c *contextmodel.ReqContext) response.Response {
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

	query := tempuser.GetTempUserByCodeQuery{Code: completeInvite.InviteCode}
	queryResult, err := hs.tempUserService.GetTempUserByCode(c.Req.Context(), &query)
	if err != nil {
		if errors.Is(err, tempuser.ErrTempUserNotFound) {
			return response.Error(http.StatusNotFound, "Invite not found", nil)
		}
		return response.Error(http.StatusInternalServerError, "Failed to get invite", err)
	}

	invite := queryResult
	if invite.Status != tempuser.TmpUserInvitePending {
		return response.Error(http.StatusPreconditionFailed, fmt.Sprintf("Invite cannot be used in status %s", invite.Status), nil)
	}

	// In case the user is invited by email address
	if inviteMail, err := ValidateAndNormalizeEmail(invite.Email); err == nil {
		// Make sure that the email address is not amended
		if completeInvite.Email != inviteMail {
			return response.Error(http.StatusBadRequest, "The provided email is different from the address that is found in the invite", nil)
		}
	}

	cmd := user.CreateUserCommand{
		Email:        completeInvite.Email,
		Name:         completeInvite.Name,
		Login:        completeInvite.Username,
		Password:     completeInvite.Password,
		SkipOrgSetup: true,
	}

	usr, err := hs.userService.Create(c.Req.Context(), &cmd)
	if err != nil {
		if errors.Is(err, user.ErrUserAlreadyExists) {
			return response.Error(http.StatusPreconditionFailed, fmt.Sprintf("User with email '%s' or username '%s' already exists", completeInvite.Email, completeInvite.Username), err)
		}

		return response.Error(http.StatusInternalServerError, "failed to create user", err)
	}

	if err := hs.bus.Publish(c.Req.Context(), &events.SignUpCompleted{
		Name:  usr.NameOrFallback(),
		Email: usr.Email,
	}); err != nil {
		return response.Error(http.StatusInternalServerError, "failed to publish event", err)
	}

	if ok, rsp := hs.applyUserInvite(c.Req.Context(), usr, invite, true); !ok {
		return rsp
	}

	err = hs.loginUserWithUser(usr, c)
	if err != nil {
		return response.Error(http.StatusInternalServerError, "failed to accept invite", err)
	}

	metrics.MApiUserSignUpCompleted.Inc()
	metrics.MApiUserSignUpInvite.Inc()

	return response.JSON(http.StatusOK, util.DynMap{
		"message": "User created and logged in",
		"id":      usr.ID,
	})
}

func (hs *HTTPServer) updateTempUserStatus(ctx context.Context, code string, status tempuser.TempUserStatus) (bool, response.Response) {
	// update temp user status
	updateTmpUserCmd := tempuser.UpdateTempUserStatusCommand{Code: code, Status: status}
	if err := hs.tempUserService.UpdateTempUserStatus(ctx, &updateTmpUserCmd); err != nil {
		return false, response.Error(http.StatusInternalServerError, "Failed to update invite status", err)
	}

	return true, nil
}

func (hs *HTTPServer) applyUserInvite(ctx context.Context, usr *user.User, invite *tempuser.TempUserDTO, setActive bool) (bool, response.Response) {
	// add to org
	addOrgUserCmd := org.AddOrgUserCommand{OrgID: invite.OrgID, UserID: usr.ID, Role: invite.Role}
	if err := hs.orgService.AddOrgUser(ctx, &addOrgUserCmd); err != nil {
		if !errors.Is(err, org.ErrOrgUserAlreadyAdded) {
			return false, response.Error(http.StatusInternalServerError, "Error while trying to create org user", err)
		}
	}

	// update temp user status
	if ok, rsp := hs.updateTempUserStatus(ctx, invite.Code, tempuser.TmpUserCompleted); !ok {
		return false, rsp
	}

	if setActive {
		// set org to active
		if err := hs.userService.Update(ctx, &user.UpdateUserCommand{OrgID: &invite.OrgID, UserID: usr.ID}); err != nil {
			return false, response.Error(http.StatusInternalServerError, "Failed to set org as active", err)
		}
	}

	return true, nil
}

// swagger:response SMTPNotEnabledError
type SMTPNotEnabledError PreconditionFailedError

// swagger:parameters addOrgInvite
type AddInviteParams struct {
	// in:body
	// required:true
	Body dtos.AddInviteForm `json:"body"`
}

// swagger:parameters revokeInvite
type RevokeInviteParams struct {
	// in:path
	// required:true
	Code string `json:"invitation_code"`
}

// swagger:response getPendingOrgInvitesResponse
type GetPendingOrgInvitesResponse struct {
	// The response message
	// in: body
	Body []*tempuser.TempUserDTO `json:"body"`
}
