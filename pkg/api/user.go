package api

import (
	"context"
	"errors"
	"net/http"
	"strconv"
	"strings"

	"github.com/grafana/grafana/pkg/api/dtos"
	"github.com/grafana/grafana/pkg/api/response"
	contextmodel "github.com/grafana/grafana/pkg/services/contexthandler/model"
	"github.com/grafana/grafana/pkg/services/login"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/services/team"
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
	return hs.getUserUserProfile(c, c.UserID)
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
			return response.Error(404, user.ErrUserNotFound.Error(), nil)
		}
		return response.Error(500, "Failed to get user", err)
	}

	getAuthQuery := login.GetAuthInfoQuery{UserId: userID}
	userProfile.AuthLabels = []string{}
	if authInfo, err := hs.authInfoService.GetAuthInfo(c.Req.Context(), &getAuthQuery); err == nil {
		authLabel := login.GetAuthProviderLabel(authInfo.AuthModule)
		userProfile.AuthLabels = append(userProfile.AuthLabels, authLabel)
		userProfile.IsExternal = true
		userProfile.IsExternallySynced = login.IsExternallySynced(hs.Cfg, authInfo.AuthModule)
	}

	userProfile.AccessControl = hs.getAccessControlMetadata(c, c.OrgID, "global.users:id:", strconv.FormatInt(userID, 10))
	userProfile.AvatarURL = dtos.GetGravatarUrl(userProfile.Email)

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
			return response.Error(404, user.ErrUserNotFound.Error(), nil)
		}
		return response.Error(500, "Failed to get user", err)
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
// 500: internalServerError
func (hs *HTTPServer) UpdateSignedInUser(c *contextmodel.ReqContext) response.Response {
	cmd := user.UpdateUserCommand{}
	var err error
	if err = web.Bind(c.Req, &cmd); err != nil {
		return response.Error(http.StatusBadRequest, "bad request data", err)
	}

	cmd.Email = strings.TrimSpace(cmd.Email)
	cmd.Login = strings.TrimSpace(cmd.Login)

	if hs.Cfg.AuthProxyEnabled {
		if hs.Cfg.AuthProxyHeaderProperty == "email" && cmd.Email != c.Email {
			return response.Error(400, "Not allowed to change email when auth proxy is using email property", nil)
		}
		if hs.Cfg.AuthProxyHeaderProperty == "username" && cmd.Login != c.Login {
			return response.Error(400, "Not allowed to change username when auth proxy is using username property", nil)
		}
	}
	cmd.UserID = c.UserID
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
		return response.Error(401, "Not a valid organization", nil)
	}

	cmd := user.SetUsingOrgCommand{UserID: userID, OrgID: orgID}

	if err := hs.userService.SetUsingOrg(c.Req.Context(), &cmd); err != nil {
		return response.Error(500, "Failed to change active organization", err)
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
		if len(cmd.Login) == 0 {
			return response.Error(http.StatusBadRequest, "Validation error, need to specify either username or email", nil)
		}
	}

	if err := hs.userService.Update(ctx, &cmd); err != nil {
		if errors.Is(err, user.ErrCaseInsensitive) {
			return response.Error(http.StatusConflict, "Update would result in user login conflict", err)
		}
		return response.Error(http.StatusInternalServerError, "Failed to update user", err)
	}

	return response.Success("User updated")
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
	return hs.getUserOrgList(c.Req.Context(), c.UserID)
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
	return hs.getUserTeamList(c, c.OrgID, c.UserID)
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
	return hs.getUserTeamList(c, c.OrgID, id)
}

func (hs *HTTPServer) getUserTeamList(c *contextmodel.ReqContext, orgID int64, userID int64) response.Response {
	query := team.GetTeamsByUserQuery{OrgID: orgID, UserID: userID, SignedInUser: c.SignedInUser}

	queryResult, err := hs.teamService.GetTeamsByUser(c.Req.Context(), &query)
	if err != nil {
		return response.Error(500, "Failed to get user teams", err)
	}

	for _, team := range queryResult {
		team.AvatarURL = dtos.GetGravatarUrlWithDefault(team.Email, team.Name)
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
		return response.Error(500, "Failed to get user organizations", err)
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

	if !hs.validateUsingOrg(c.Req.Context(), c.UserID, orgID) {
		return response.Error(401, "Not a valid organization", nil)
	}

	cmd := user.SetUsingOrgCommand{UserID: c.UserID, OrgID: orgID}

	if err := hs.userService.SetUsingOrg(c.Req.Context(), &cmd); err != nil {
		return response.Error(500, "Failed to change active organization", err)
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

	if !hs.validateUsingOrg(c.Req.Context(), c.UserID, orgID) {
		hs.NotFoundHandler(c)
	}

	cmd := user.SetUsingOrgCommand{UserID: c.UserID, OrgID: orgID}

	if err := hs.userService.SetUsingOrg(c.Req.Context(), &cmd); err != nil {
		hs.NotFoundHandler(c)
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

	userQuery := user.GetUserByIDQuery{ID: c.UserID}

	usr, err := hs.userService.GetByID(c.Req.Context(), &userQuery)
	if err != nil {
		return response.Error(500, "Could not read user from database", err)
	}

	getAuthQuery := login.GetAuthInfoQuery{UserId: usr.ID}
	if authInfo, err := hs.authInfoService.GetAuthInfo(c.Req.Context(), &getAuthQuery); err == nil {
		authModule := authInfo.AuthModule
		if authModule == login.LDAPAuthModule || authModule == login.AuthProxyAuthModule {
			return response.Error(400, "Not allowed to reset password for LDAP or Auth Proxy user", nil)
		}
	}

	passwordHashed, err := util.EncodePassword(cmd.OldPassword, usr.Salt)
	if err != nil {
		return response.Error(500, "Failed to encode password", err)
	}
	if passwordHashed != usr.Password {
		return response.Error(401, "Invalid old password", nil)
	}

	password := user.Password(cmd.NewPassword)
	if password.IsWeak() {
		return response.Error(400, "New password is too short", nil)
	}

	cmd.UserID = c.UserID
	cmd.NewPassword, err = util.EncodePassword(cmd.NewPassword, usr.Salt)
	if err != nil {
		return response.Error(500, "Failed to encode password", err)
	}

	if err := hs.userService.ChangePassword(c.Req.Context(), &cmd); err != nil {
		return response.Error(500, "Failed to change user password", err)
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

	bitmask := &c.HelpFlags1
	bitmask.AddFlag(user.HelpFlags1(flag))

	cmd := user.SetUserHelpFlagCommand{
		UserID:     c.UserID,
		HelpFlags1: *bitmask,
	}

	if err := hs.userService.SetUserHelpFlag(c.Req.Context(), &cmd); err != nil {
		return response.Error(500, "Failed to update help flag", err)
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
	cmd := user.SetUserHelpFlagCommand{
		UserID:     c.UserID,
		HelpFlags1: user.HelpFlags1(0),
	}

	if err := hs.userService.SetUserHelpFlag(c.Req.Context(), &cmd); err != nil {
		return response.Error(500, "Failed to update help flag", err)
	}

	return response.JSON(http.StatusOK, &util.DynMap{"message": "Help flag set", "helpFlags1": cmd.HelpFlags1})
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

// swagger:response searchUsersResponse
type SearchUsersResponse struct {
	// The response message
	// in: body
	Body user.SearchUserQueryResult `json:"body"`
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
