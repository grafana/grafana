package api

import (
	"context"
	"errors"
	"net/http"
	"net/mail"
	"net/url"
	"strconv"
	"strings"
	"time"

	"github.com/grafana/grafana/pkg/api/dtos"
	"github.com/grafana/grafana/pkg/api/response"
	"github.com/grafana/grafana/pkg/services/auth/identity"
	contextmodel "github.com/grafana/grafana/pkg/services/contexthandler/model"
	"github.com/grafana/grafana/pkg/services/login"
	"github.com/grafana/grafana/pkg/services/notifications"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/services/team"
	tempuser "github.com/grafana/grafana/pkg/services/temp_user"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/util"
	"github.com/grafana/grafana/pkg/web"
)

// swagger:route GET /user signed_in_user getSignedInUser
//
// Get (current authenticated user)
//
// Responses:
// 200: userResponse
// 401: unauthorisedError
// 403: forbiddenError
// 404: notFoundError
// 500: internalServerError
func (hs *HTTPServer) GetSignedInUser(c *contextmodel.ReqContext) response.Response {
	userID, errResponse := getUserID(c)
	if errResponse != nil {
		return errResponse
	}
	return hs.getUserUserProfile(c, userID)
}

// swagger:route GET /users/{user_id} users getUserByID
//
// Get user by id.
//
// Responses:
// 200: userResponse
// 401: unauthorisedError
// 403: forbiddenError
// 404: notFoundError
// 500: internalServerError
func (hs *HTTPServer) GetUserByID(c *contextmodel.ReqContext) response.Response {
	id, err := strconv.ParseInt(web.Params(c.Req)[":id"], 10, 64)
	if err != nil {
		return response.Error(http.StatusBadRequest, "id is invalid", err)
	}
	return hs.getUserUserProfile(c, id)
}

func (hs *HTTPServer) getUserUserProfile(c *contextmodel.ReqContext, userID int64) response.Response {
	query := user.GetUserProfileQuery{UserID: userID}

	userProfile, err := hs.userService.GetProfile(c.Req.Context(), &query)
	if err != nil {
		if errors.Is(err, user.ErrUserNotFound) {
			return response.Error(http.StatusNotFound, user.ErrUserNotFound.Error(), nil)
		}
		return response.Error(http.StatusInternalServerError, "Failed to get user", err)
	}

	getAuthQuery := login.GetAuthInfoQuery{UserId: userID}
	userProfile.AuthLabels = []string{}
	if authInfo, err := hs.authInfoService.GetAuthInfo(c.Req.Context(), &getAuthQuery); err == nil {
		authLabel := login.GetAuthProviderLabel(authInfo.AuthModule)
		userProfile.AuthLabels = append(userProfile.AuthLabels, authLabel)
		userProfile.IsExternal = true

		oauthInfo := hs.SocialService.GetOAuthInfoProvider(authInfo.AuthModule)
		userProfile.IsExternallySynced = login.IsExternallySynced(hs.Cfg, authInfo.AuthModule, oauthInfo)
		userProfile.IsGrafanaAdminExternallySynced = login.IsGrafanaAdminExternallySynced(hs.Cfg, oauthInfo, authInfo.AuthModule)
	}

	userProfile.AccessControl = hs.getAccessControlMetadata(c, "global.users:id:", strconv.FormatInt(userID, 10))
	userProfile.AvatarURL = dtos.GetGravatarUrl(hs.Cfg, userProfile.Email)

	return response.JSON(http.StatusOK, userProfile)
}

// swagger:route GET /users/lookup users getUserByLoginOrEmail
//
// Get user by login or email.
//
// Responses:
// 200: userResponse
// 401: unauthorisedError
// 403: forbiddenError
// 404: notFoundError
// 500: internalServerError
func (hs *HTTPServer) GetUserByLoginOrEmail(c *contextmodel.ReqContext) response.Response {
	query := user.GetUserByLoginQuery{LoginOrEmail: c.Query("loginOrEmail")}
	usr, err := hs.userService.GetByLogin(c.Req.Context(), &query)
	if err != nil {
		if errors.Is(err, user.ErrUserNotFound) {
			return response.Error(http.StatusNotFound, user.ErrUserNotFound.Error(), nil)
		}
		return response.Error(http.StatusInternalServerError, "Failed to get user", err)
	}
	result := user.UserProfileDTO{
		ID:             usr.ID,
		Name:           usr.Name,
		Email:          usr.Email,
		Login:          usr.Login,
		Theme:          usr.Theme,
		IsGrafanaAdmin: usr.IsAdmin,
		OrgID:          usr.OrgID,
		UpdatedAt:      usr.Updated,
		CreatedAt:      usr.Created,
	}
	return response.JSON(http.StatusOK, &result)
}

// swagger:route PUT /user signed_in_user updateSignedInUser
//
// Update signed in User.
//
// Responses:
// 200: okResponse
// 401: unauthorisedError
// 403: forbiddenError
// 409: conflictError
// 500: internalServerError
func (hs *HTTPServer) UpdateSignedInUser(c *contextmodel.ReqContext) response.Response {
	cmd := user.UpdateUserCommand{}
	var err error
	if err = web.Bind(c.Req, &cmd); err != nil {
		return response.Error(http.StatusBadRequest, "bad request data", err)
	}

	cmd.Email = strings.TrimSpace(cmd.Email)
	cmd.Login = strings.TrimSpace(cmd.Login)

	userID, errResponse := getUserID(c)
	if errResponse != nil {
		return errResponse
	}

	if hs.Cfg.AuthProxy.Enabled {
		if hs.Cfg.AuthProxy.HeaderProperty == "email" && cmd.Email != c.SignedInUser.GetEmail() {
			return response.Error(http.StatusBadRequest, "Not allowed to change email when auth proxy is using email property", nil)
		}
		if hs.Cfg.AuthProxy.HeaderProperty == "username" && cmd.Login != c.SignedInUser.GetLogin() {
			return response.Error(http.StatusBadRequest, "Not allowed to change username when auth proxy is using username property", nil)
		}
	}

	cmd.UserID = userID
	return hs.handleUpdateUser(c.Req.Context(), cmd)
}

// swagger:route PUT /users/{user_id} users updateUser
//
// Update user.
//
// Update the user identified by id.
//
// Responses:
// 200: okResponse
// 401: unauthorisedError
// 403: forbiddenError
// 404: notFoundError
// 409: conflictError
// 500: internalServerError
func (hs *HTTPServer) UpdateUser(c *contextmodel.ReqContext) response.Response {
	cmd := user.UpdateUserCommand{}
	var err error
	if err = web.Bind(c.Req, &cmd); err != nil {
		return response.Error(http.StatusBadRequest, "bad request data", err)
	}

	cmd.Email = strings.TrimSpace(cmd.Email)
	cmd.Login = strings.TrimSpace(cmd.Login)

	cmd.UserID, err = strconv.ParseInt(web.Params(c.Req)[":id"], 10, 64)
	if err != nil {
		return response.Error(http.StatusBadRequest, "id is invalid", err)
	}

	return hs.handleUpdateUser(c.Req.Context(), cmd)
}

// POST /api/users/:id/using/:orgId
func (hs *HTTPServer) UpdateUserActiveOrg(c *contextmodel.ReqContext) response.Response {
	userID, err := strconv.ParseInt(web.Params(c.Req)[":id"], 10, 64)
	if err != nil {
		return response.Error(http.StatusBadRequest, "id is invalid", err)
	}
	orgID, err := strconv.ParseInt(web.Params(c.Req)[":orgId"], 10, 64)
	if err != nil {
		return response.Error(http.StatusBadRequest, "orgId is invalid", err)
	}

	if !hs.validateUsingOrg(c.Req.Context(), userID, orgID) {
		return response.Error(http.StatusUnauthorized, "Not a valid organization", nil)
	}

	cmd := user.SetUsingOrgCommand{UserID: userID, OrgID: orgID}

	if err := hs.userService.SetUsingOrg(c.Req.Context(), &cmd); err != nil {
		return response.Error(http.StatusInternalServerError, "Failed to change active organization", err)
	}

	return response.Success("Active organization changed")
}

func (hs *HTTPServer) handleUpdateUser(ctx context.Context, cmd user.UpdateUserCommand) response.Response {
	// external user -> user data cannot be updated
	isExternal, err := hs.isExternalUser(ctx, cmd.UserID)
	if err != nil {
		return response.Error(http.StatusInternalServerError, "Failed to validate User", err)
	}

	if isExternal {
		return response.Error(http.StatusForbidden, "User info cannot be updated for external Users", nil)
	}

	if len(cmd.Login) == 0 {
		cmd.Login = cmd.Email
	}

	// if login is still empty both email and login field is missing
	if len(cmd.Login) == 0 {
		return response.Err(user.ErrEmptyUsernameAndEmail.Errorf("user cannot be created with empty username and email"))
	}

	// If email is being updated, we need to verify it. Likewise, if username is being updated and the new username
	// is an email, we also need to verify it.
	// To avoid breaking changes, email verification is implemented in a way that if the email field is being updated,
	// all the other fields being updated in the same request are disregarded. We do this because email might need to
	// be verified and if so, it goes through a different code flow.
	if hs.Cfg.Smtp.Enabled && hs.Cfg.VerifyEmailEnabled {
		query := user.GetUserByIDQuery{ID: cmd.UserID}
		usr, err := hs.userService.GetByID(ctx, &query)
		if err != nil {
			if errors.Is(err, user.ErrUserNotFound) {
				return response.Error(http.StatusNotFound, user.ErrUserNotFound.Error(), nil)
			}
			return response.Error(http.StatusInternalServerError, "Failed to get user", err)
		}

		if len(cmd.Email) != 0 && usr.Email != cmd.Email {
			// Email is being updated
			newEmail, err := ValidateAndNormalizeEmail(cmd.Email)
			if err != nil {
				return response.Error(http.StatusBadRequest, "Invalid email address", err)
			}

			return hs.verifyEmailUpdate(ctx, newEmail, user.EmailUpdateAction, usr)
		}
		if len(cmd.Login) != 0 && usr.Login != cmd.Login {
			// Username is being updated. If it's an email, go through the email verification flow
			newEmailLogin, err := ValidateAndNormalizeEmail(cmd.Login)
			if err == nil && newEmailLogin != usr.Email {
				return hs.verifyEmailUpdate(ctx, newEmailLogin, user.LoginUpdateAction, usr)
			}
		}
	}

	if err := hs.userService.Update(ctx, &cmd); err != nil {
		if errors.Is(err, user.ErrCaseInsensitive) {
			return response.Error(http.StatusConflict, "Update would result in user login conflict", err)
		}
		return response.ErrOrFallback(http.StatusInternalServerError, "Failed to update user", err)
	}

	return response.Success("User updated")
}

func (hs *HTTPServer) verifyEmailUpdate(ctx context.Context, email string, field user.UpdateEmailActionType, usr *user.User) response.Response {
	// Verify that email is not already being used
	query := user.GetUserByLoginQuery{LoginOrEmail: email}
	existingUsr, err := hs.userService.GetByLogin(ctx, &query)
	if err != nil && !errors.Is(err, user.ErrUserNotFound) {
		return response.Error(http.StatusInternalServerError, "Failed to validate if email is already in use", err)
	}
	if existingUsr != nil {
		return response.Error(http.StatusConflict, "Email is already being used", nil)
	}

	// Invalidate any pending verifications for this user
	expireCmd := tempuser.ExpirePreviousVerificationsCommand{InvitedByUserID: usr.ID}
	err = hs.tempUserService.ExpirePreviousVerifications(ctx, &expireCmd)
	if err != nil {
		return response.Error(http.StatusInternalServerError, "Could not invalidate pending email verifications", err)
	}

	code, err := util.GetRandomString(20)
	if err != nil {
		return response.Error(http.StatusInternalServerError, "Failed to generate random string", err)
	}

	tempCmd := tempuser.CreateTempUserCommand{
		OrgID:  -1,
		Email:  email,
		Code:   code,
		Status: tempuser.TmpUserEmailUpdateStarted,
		// used to fetch the User in the second step of the verification flow
		InvitedByUserID: usr.ID,
		// used to determine if the user was updating their email or username in the second step of the verification flow
		Name: string(field),
	}

	tempUser, err := hs.tempUserService.CreateTempUser(ctx, &tempCmd)
	if err != nil {
		return response.Error(http.StatusInternalServerError, "Failed to create email change", err)
	}

	emailCmd := notifications.SendVerifyEmailCommand{Email: tempUser.Email, Code: tempUser.Code, User: usr}
	err = hs.NotificationService.SendVerificationEmail(ctx, &emailCmd)
	if err != nil {
		return response.Error(http.StatusInternalServerError, "Failed to send verification email", err)
	}

	// Record email as sent
	emailSentCmd := tempuser.UpdateTempUserWithEmailSentCommand{Code: tempUser.Code}
	err = hs.tempUserService.UpdateTempUserWithEmailSent(ctx, &emailSentCmd)
	if err != nil {
		return response.Error(http.StatusInternalServerError, "Failed to record verification email", err)
	}

	return response.Success("Email sent for verification")
}

// swagger:route GET /user/email/update user updateUserEmail
//
// Update user email.
//
// Update the email of user given a verification code.
//
// Responses:
// 302: okResponse
func (hs *HTTPServer) UpdateUserEmail(c *contextmodel.ReqContext) response.Response {
	var err error

	q := c.Req.URL.Query()
	code, err := url.QueryUnescape(q.Get("code"))
	if err != nil || code == "" {
		return hs.RedirectResponseWithError(c, errors.New("bad request data"))
	}

	tempUser, err := hs.validateEmailCode(c.Req.Context(), code)
	if err != nil {
		return hs.RedirectResponseWithError(c, err)
	}

	cmd, err := hs.updateCmdFromEmailVerification(c.Req.Context(), tempUser)
	if err != nil {
		return hs.RedirectResponseWithError(c, err)
	}

	if err := hs.userService.Update(c.Req.Context(), cmd); err != nil {
		if errors.Is(err, user.ErrCaseInsensitive) {
			return hs.RedirectResponseWithError(c, errors.New("update would result in user login conflict"))
		}
		return hs.RedirectResponseWithError(c, errors.New("failed to update user"))
	}

	// Mark temp user as completed
	updateTmpUserCmd := tempuser.UpdateTempUserStatusCommand{Code: code, Status: tempuser.TmpUserEmailUpdateCompleted}
	if err := hs.tempUserService.UpdateTempUserStatus(c.Req.Context(), &updateTmpUserCmd); err != nil {
		return hs.RedirectResponseWithError(c, errors.New("failed to update verification status"))
	}

	return response.Redirect(hs.Cfg.AppSubURL + "/profile")
}

func (hs *HTTPServer) isExternalUser(ctx context.Context, userID int64) (bool, error) {
	getAuthQuery := login.GetAuthInfoQuery{UserId: userID}
	var err error
	if _, err = hs.authInfoService.GetAuthInfo(ctx, &getAuthQuery); err == nil {
		return true, nil
	}

	if errors.Is(err, user.ErrUserNotFound) {
		return false, nil
	}

	return false, err
}

// swagger:route GET /user/orgs signed_in_user getSignedInUserOrgList
//
// Organizations of the actual User.
//
// Return a list of all organizations of the current user.
//
// Security:
// - basic:
//
// Responses:
// 200: getSignedInUserOrgListResponse
// 401: unauthorisedError
// 403: forbiddenError
// 500: internalServerError
func (hs *HTTPServer) GetSignedInUserOrgList(c *contextmodel.ReqContext) response.Response {
	userID, errResponse := getUserID(c)
	if errResponse != nil {
		return errResponse
	}

	return hs.getUserOrgList(c.Req.Context(), userID)
}

// swagger:route GET /user/teams signed_in_user getSignedInUserTeamList
//
// Teams that the actual User is member of.
//
// Return a list of all teams that the current user is member of.
//
// Responses:
// 200: getSignedInUserTeamListResponse
// 401: unauthorisedError
// 403: forbiddenError
// 500: internalServerError
func (hs *HTTPServer) GetSignedInUserTeamList(c *contextmodel.ReqContext) response.Response {
	userID, errResponse := getUserID(c)
	if errResponse != nil {
		return errResponse
	}

	return hs.getUserTeamList(c, c.SignedInUser.GetOrgID(), userID)
}

// swagger:route GET /users/{user_id}/teams users getUserTeams
//
// Get teams for user.
//
// Get teams for user identified by id.
//
// Responses:
// 200: getUserTeamsResponse
// 401: unauthorisedError
// 403: forbiddenError
// 404: notFoundError
// 500: internalServerError
func (hs *HTTPServer) GetUserTeams(c *contextmodel.ReqContext) response.Response {
	id, err := strconv.ParseInt(web.Params(c.Req)[":id"], 10, 64)
	if err != nil {
		return response.Error(http.StatusBadRequest, "id is invalid", err)
	}
	return hs.getUserTeamList(c, c.SignedInUser.GetOrgID(), id)
}

func (hs *HTTPServer) getUserTeamList(c *contextmodel.ReqContext, orgID int64, userID int64) response.Response {
	query := team.GetTeamsByUserQuery{OrgID: orgID, UserID: userID, SignedInUser: c.SignedInUser}

	queryResult, err := hs.teamService.GetTeamsByUser(c.Req.Context(), &query)
	if err != nil {
		return response.Error(http.StatusInternalServerError, "Failed to get user teams", err)
	}

	for _, team := range queryResult {
		team.AvatarURL = dtos.GetGravatarUrlWithDefault(hs.Cfg, team.Email, team.Name)
	}
	return response.JSON(http.StatusOK, queryResult)
}

// swagger:route GET /users/{user_id}/orgs users getUserOrgList
//
// Get organizations for user.
//
// Get organizations for user identified by id.
//
// Responses:
// 200: getUserOrgListResponse
// 401: unauthorisedError
// 403: forbiddenError
// 404: notFoundError
// 500: internalServerError
func (hs *HTTPServer) GetUserOrgList(c *contextmodel.ReqContext) response.Response {
	id, err := strconv.ParseInt(web.Params(c.Req)[":id"], 10, 64)
	if err != nil {
		return response.Error(http.StatusBadRequest, "id is invalid", err)
	}
	return hs.getUserOrgList(c.Req.Context(), id)
}

func (hs *HTTPServer) getUserOrgList(ctx context.Context, userID int64) response.Response {
	query := org.GetUserOrgListQuery{UserID: userID}

	result, err := hs.orgService.GetUserOrgList(ctx, &query)
	if err != nil {
		return response.Error(http.StatusInternalServerError, "Failed to get user organizations", err)
	}

	return response.JSON(http.StatusOK, result)
}

func (hs *HTTPServer) validateUsingOrg(ctx context.Context, userID int64, orgID int64) bool {
	query := org.GetUserOrgListQuery{UserID: userID}

	result, err := hs.orgService.GetUserOrgList(ctx, &query)
	if err != nil {
		return false
	}

	// validate that the org id in the list
	valid := false
	for _, other := range result {
		if other.OrgID == orgID {
			valid = true
		}
	}

	return valid
}

// swagger:route POST /user/using/{org_id} signed_in_user userSetUsingOrg
//
// Switch user context for signed in user.
//
// Switch user context to the given organization.
//
// Responses:
// 200: okResponse
// 400: badRequestError
// 401: unauthorisedError
// 403: forbiddenError
// 500: internalServerError
func (hs *HTTPServer) UserSetUsingOrg(c *contextmodel.ReqContext) response.Response {
	orgID, err := strconv.ParseInt(web.Params(c.Req)[":id"], 10, 64)
	if err != nil {
		return response.Error(http.StatusBadRequest, "id is invalid", err)
	}

	userID, errResponse := getUserID(c)
	if errResponse != nil {
		return errResponse
	}

	if !hs.validateUsingOrg(c.Req.Context(), userID, orgID) {
		return response.Error(http.StatusUnauthorized, "Not a valid organization", nil)
	}

	cmd := user.SetUsingOrgCommand{UserID: userID, OrgID: orgID}

	if err := hs.userService.SetUsingOrg(c.Req.Context(), &cmd); err != nil {
		return response.Error(http.StatusInternalServerError, "Failed to change active organization", err)
	}

	return response.Success("Active organization changed")
}

// GET /profile/switch-org/:id
func (hs *HTTPServer) ChangeActiveOrgAndRedirectToHome(c *contextmodel.ReqContext) {
	orgID, err := strconv.ParseInt(web.Params(c.Req)[":id"], 10, 64)
	if err != nil {
		c.JsonApiErr(http.StatusBadRequest, "id is invalid", err)
		return
	}

	namespace, identifier := c.SignedInUser.GetNamespacedID()
	if namespace != identity.NamespaceUser {
		c.JsonApiErr(http.StatusForbidden, "Endpoint only available for users", nil)
		return
	}

	userID, err := identity.IntIdentifier(namespace, identifier)
	if err != nil {
		c.JsonApiErr(http.StatusInternalServerError, "Failed to parse user id", err)
		return
	}

	if !hs.validateUsingOrg(c.Req.Context(), userID, orgID) {
		hs.NotFoundHandler(c)
		return
	}

	cmd := user.SetUsingOrgCommand{UserID: userID, OrgID: orgID}
	if err := hs.userService.SetUsingOrg(c.Req.Context(), &cmd); err != nil {
		hs.NotFoundHandler(c)
		return
	}

	c.Redirect(hs.Cfg.AppSubURL + "/")
}

// swagger:route PUT /user/password signed_in_user changeUserPassword
//
// Change Password.
//
// Changes the password for the user.
//
// Security:
// - basic:
//
// Responses:
// 200: okResponse
// 400: badRequestError
// 401: unauthorisedError
// 403: forbiddenError
// 500: internalServerError
func (hs *HTTPServer) ChangeUserPassword(c *contextmodel.ReqContext) response.Response {
	cmd := user.ChangeUserPasswordCommand{}
	if err := web.Bind(c.Req, &cmd); err != nil {
		return response.Error(http.StatusBadRequest, "bad request data", err)
	}

	userID, errResponse := getUserID(c)
	if errResponse != nil {
		return errResponse
	}

	userQuery := user.GetUserByIDQuery{ID: userID}

	usr, err := hs.userService.GetByID(c.Req.Context(), &userQuery)
	if err != nil {
		return response.Error(http.StatusInternalServerError, "Could not read user from database", err)
	}

	getAuthQuery := login.GetAuthInfoQuery{UserId: usr.ID}
	if authInfo, err := hs.authInfoService.GetAuthInfo(c.Req.Context(), &getAuthQuery); err == nil {
		oauthInfo := hs.SocialService.GetOAuthInfoProvider(authInfo.AuthModule)
		if login.IsProviderEnabled(hs.Cfg, authInfo.AuthModule, oauthInfo) {
			return response.Error(http.StatusBadRequest, "Cannot update external user password", err)
		}
	}

	passwordHashed, err := util.EncodePassword(string(cmd.OldPassword), usr.Salt)
	if err != nil {
		return response.Error(http.StatusInternalServerError, "Failed to encode password", err)
	}
	if user.Password(passwordHashed) != usr.Password {
		return response.Error(http.StatusUnauthorized, "Invalid old password", nil)
	}

	if err := cmd.NewPassword.Validate(hs.Cfg); err != nil {
		c.Logger.Warn("the new password doesn't meet the password policy criteria", "err", err)
		return response.Err(err)
	}

	cmd.UserID = userID
	encodedPassword, err := util.EncodePassword(string(cmd.NewPassword), usr.Salt)
	if err != nil {
		return response.Error(http.StatusInternalServerError, "Failed to encode password", err)
	}
	cmd.NewPassword = user.Password(encodedPassword)

	if err := hs.userService.ChangePassword(c.Req.Context(), &cmd); err != nil {
		return response.Error(http.StatusInternalServerError, "Failed to change user password", err)
	}

	return response.Success("User password changed")
}

// redirectToChangePassword handles GET /.well-known/change-password.
func redirectToChangePassword(c *contextmodel.ReqContext) {
	c.Redirect("/profile/password", 302)
}

// swagger:route PUT /user/helpflags/{flag_id} signed_in_user setHelpFlag
//
// Set user help flag.
//
// Responses:
// 200: helpFlagResponse
// 401: unauthorisedError
// 403: forbiddenError
// 500: internalServerError
func (hs *HTTPServer) SetHelpFlag(c *contextmodel.ReqContext) response.Response {
	flag, err := strconv.ParseInt(web.Params(c.Req)[":id"], 10, 64)
	if err != nil {
		return response.Error(http.StatusBadRequest, "id is invalid", err)
	}

	userID, errResponse := getUserID(c)
	if errResponse != nil {
		return errResponse
	}

	usr, err := hs.userService.GetByID(c.Req.Context(), &user.GetUserByIDQuery{ID: userID})
	if err != nil {
		return response.Error(http.StatusInternalServerError, "Failed to get user", err)
	}

	bitmask := &usr.HelpFlags1
	bitmask.AddFlag(user.HelpFlags1(flag))

	cmd := user.SetUserHelpFlagCommand{
		UserID:     userID,
		HelpFlags1: *bitmask,
	}

	if err := hs.userService.SetUserHelpFlag(c.Req.Context(), &cmd); err != nil {
		return response.Error(http.StatusInternalServerError, "Failed to update help flag", err)
	}

	return response.JSON(http.StatusOK, &util.DynMap{"message": "Help flag set", "helpFlags1": cmd.HelpFlags1})
}

// swagger:route GET /user/helpflags/clear signed_in_user clearHelpFlags
//
// Clear user help flag.
//
// Responses:
// 200: helpFlagResponse
// 401: unauthorisedError
// 403: forbiddenError
// 500: internalServerError
func (hs *HTTPServer) ClearHelpFlags(c *contextmodel.ReqContext) response.Response {
	userID, errResponse := getUserID(c)
	if errResponse != nil {
		return errResponse
	}

	cmd := user.SetUserHelpFlagCommand{
		UserID:     userID,
		HelpFlags1: user.HelpFlags1(0),
	}

	if err := hs.userService.SetUserHelpFlag(c.Req.Context(), &cmd); err != nil {
		return response.Error(http.StatusInternalServerError, "Failed to update help flag", err)
	}

	return response.JSON(http.StatusOK, &util.DynMap{"message": "Help flag set", "helpFlags1": cmd.HelpFlags1})
}

func getUserID(c *contextmodel.ReqContext) (int64, *response.NormalResponse) {
	namespace, identifier := c.SignedInUser.GetNamespacedID()
	if namespace != identity.NamespaceUser {
		return 0, response.Error(http.StatusForbidden, "Endpoint only available for users", nil)
	}

	userID, err := identity.IntIdentifier(namespace, identifier)
	if err != nil {
		return 0, response.Error(http.StatusInternalServerError, "Failed to parse user id", err)
	}

	return userID, nil
}

func (hs *HTTPServer) updateCmdFromEmailVerification(ctx context.Context, tempUser *tempuser.TempUserDTO) (*user.UpdateUserCommand, error) {
	userQuery := user.GetUserByLoginQuery{LoginOrEmail: tempUser.InvitedByLogin}
	usr, err := hs.userService.GetByLogin(ctx, &userQuery)
	if err != nil {
		if errors.Is(err, user.ErrUserNotFound) {
			return nil, user.ErrUserNotFound
		}
		return nil, errors.New("failed to get user")
	}

	cmd := &user.UpdateUserCommand{UserID: usr.ID, Email: tempUser.Email}

	switch tempUser.Name {
	case string(user.EmailUpdateAction):
		// User updated the email field
		if _, err := mail.ParseAddress(usr.Login); err == nil {
			// If username was also an email, we update it to keep it in sync with the email field
			cmd.Login = tempUser.Email
		}
	case string(user.LoginUpdateAction):
		// User updated the username field with a new email
		cmd.Login = tempUser.Email
	default:
		return nil, errors.New("trying to update email on unknown field")
	}
	return cmd, nil
}

func (hs *HTTPServer) validateEmailCode(ctx context.Context, code string) (*tempuser.TempUserDTO, error) {
	tempUserQuery := tempuser.GetTempUserByCodeQuery{Code: code}
	tempUser, err := hs.tempUserService.GetTempUserByCode(ctx, &tempUserQuery)
	if err != nil {
		if errors.Is(err, tempuser.ErrTempUserNotFound) {
			return nil, errors.New("invalid email verification code")
		}
		return nil, errors.New("failed to read temp user")
	}

	if tempUser.Status != tempuser.TmpUserEmailUpdateStarted {
		return nil, errors.New("invalid email verification code")
	}
	if !tempUser.EmailSent {
		return nil, errors.New("verification email was not recorded as sent")
	}
	if tempUser.EmailSentOn.Add(hs.Cfg.VerificationEmailMaxLifetime).Before(time.Now()) {
		return nil, errors.New("invalid email verification code")
	}

	return tempUser, nil
}

// swagger:parameters searchUsers
type SearchUsersParams struct {
	// Limit the maximum number of users to return per page
	// in:query
	// required:false
	// default:1000
	Limit int64 `json:"perpage"`
	// Page index for starting fetching users
	// in:query
	// required:false
	// default:1
	Page int64 `json:"page"`
}

// swagger:parameters searchUsersWithPaging

type SearchUsersWithPagingParams struct {
	// Limit the maximum number of users to return per page
	// in:query
	// required:false
	// default:1000
	Limit int64 `json:"perpage"`
	// Page index for starting fetching users
	// in:query
	// required:false
	// default:1
	Page int64 `json:"page"`
	// Query allows return results where the query value is contained in one of the name, login or email fields. Query values with spaces need to be URL encoded e.g. query=Jane%20Doe
	// in:query
	// required:false
	Query string `json:"query"`
}

// swagger:parameters updateSignedInUser
type UpdateSignedInUserParams struct {
	// To change the email, name, login, theme, provide another one.
	// in:body
	// required:true
	Body user.UpdateUserCommand `json:"body"`
}

// swagger:parameters userSetUsingOrg
type UserSetUsingOrgParams struct {
	// in:path
	// required:true
	OrgID int64 `json:"org_id"`
}

// swagger:parameters setHelpFlag
type SetHelpFlagParams struct {
	// in:path
	// required:true
	FlagID string `json:"flag_id"`
}

// swagger:parameters changeUserPassword
type ChangeUserPasswordParams struct {
	// To change the email, name, login, theme, provide another one.
	// in:body
	// required:true
	Body user.ChangeUserPasswordCommand `json:"body"`
}

// swagger:parameters getUserByID
type GetUserByIDParams struct {
	// in:path
	// required:true
	UserID int64 `json:"user_id"`
}

// swagger:parameters getUserOrgList
type GetUserOrgListParams struct {
	// in:path
	// required:true
	UserID int64 `json:"user_id"`
}

// swagger:parameters getUserTeams
type GetUserTeamsParams struct {
	// in:path
	// required:true
	UserID int64 `json:"user_id"`
}

// swagger:parameters getUserByLoginOrEmail
type GetUserByLoginOrEmailParams struct {
	// loginOrEmail of the user
	// in:query
	// required:true
	LoginOrEmail string `json:"loginOrEmail"`
}

// swagger:parameters updateUser
type UpdateUserParams struct {
	// To change the email, name, login, theme, provide another one.
	// in:body
	// required:true
	Body user.UpdateUserCommand `json:"body"`
	// in:path
	// required:true
	UserID int64 `json:"user_id"`
}

// swagger:response userResponse
type UserResponse struct {
	// The response message
	// in: body
	Body user.UserProfileDTO `json:"body"`
}

// swagger:response getUserOrgListResponse
type GetUserOrgListResponse struct {
	// The response message
	// in: body
	Body []*org.UserOrgDTO `json:"body"`
}

// swagger:response getSignedInUserOrgListResponse
type GetSignedInUserOrgListResponse struct {
	// The response message
	// in: body
	Body []*org.UserOrgDTO `json:"body"`
}

// swagger:response getUserTeamsResponse
type GetUserTeamsResponse struct {
	// The response message
	// in: body
	Body []*team.TeamDTO `json:"body"`
}

// swagger:response getSignedInUserTeamListResponse
type GetSignedInUserTeamListResponse struct {
	// The response message
	// in: body
	Body []*team.TeamDTO `json:"body"`
}

// swagger:response helpFlagResponse
type HelpFlagResponse struct {
	// The response message
	// in: body
	Body struct {
		HelpFlags1 int64  `json:"helpFlags1"`
		Message    string `json:"message"`
	} `json:"body"`
}
