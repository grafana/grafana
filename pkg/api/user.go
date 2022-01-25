package api

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"strconv"

	"github.com/grafana/grafana/pkg/api/dtos"
	"github.com/grafana/grafana/pkg/api/response"
	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/util"
	"github.com/grafana/grafana/pkg/web"
)

// GET /api/user  (current authenticated user)
func (hs *HTTPServer) GetSignedInUser(c *models.ReqContext) response.Response {
	return hs.getUserUserProfile(c, c.UserId)
}

// GET /api/users/:id
func (hs *HTTPServer) GetUserByID(c *models.ReqContext) response.Response {
	id, err := strconv.ParseInt(web.Params(c.Req)[":id"], 10, 64)
	if err != nil {
		return response.Error(http.StatusBadRequest, "id is invalid", err)
	}
	return hs.getUserUserProfile(c, id)
}

func (hs *HTTPServer) getUserUserProfile(c *models.ReqContext, userID int64) response.Response {
	query := models.GetUserProfileQuery{UserId: userID}

	if err := bus.Dispatch(c.Req.Context(), &query); err != nil {
		if errors.Is(err, models.ErrUserNotFound) {
			return response.Error(404, models.ErrUserNotFound.Error(), nil)
		}
		return response.Error(500, "Failed to get user", err)
	}

	getAuthQuery := models.GetAuthInfoQuery{UserId: userID}
	query.Result.AuthLabels = []string{}
	if err := bus.Dispatch(c.Req.Context(), &getAuthQuery); err == nil {
		authLabel := GetAuthProviderLabel(getAuthQuery.Result.AuthModule)
		query.Result.AuthLabels = append(query.Result.AuthLabels, authLabel)
		query.Result.IsExternal = true
	}

	accessControlMetadata, errAC := hs.getGlobalUserAccessControlMetadata(c, userID)
	if errAC != nil {
		hs.log.Error("Failed to get access control metadata", "error", errAC)
	}

	query.Result.AccessControl = accessControlMetadata
	query.Result.AvatarUrl = dtos.GetGravatarUrl(query.Result.Email)

	return response.JSON(200, query.Result)
}

func (hs *HTTPServer) getGlobalUserAccessControlMetadata(c *models.ReqContext, userID int64) (accesscontrol.Metadata, error) {
	if hs.AccessControl == nil || hs.AccessControl.IsDisabled() || !c.QueryBool("accesscontrol") {
		return nil, nil
	}

	userPermissions, err := hs.AccessControl.GetUserPermissions(c.Req.Context(), c.SignedInUser)
	if err != nil || len(userPermissions) == 0 {
		return nil, err
	}

	key := fmt.Sprintf("%d", userID)
	userIDs := map[string]bool{key: true}

	return accesscontrol.GetResourcesMetadata(c.Req.Context(), userPermissions, "global:users", userIDs)[key], nil
}

// GET /api/users/lookup
func GetUserByLoginOrEmail(c *models.ReqContext) response.Response {
	query := models.GetUserByLoginQuery{LoginOrEmail: c.Query("loginOrEmail")}
	if err := bus.Dispatch(c.Req.Context(), &query); err != nil {
		if errors.Is(err, models.ErrUserNotFound) {
			return response.Error(404, models.ErrUserNotFound.Error(), nil)
		}
		return response.Error(500, "Failed to get user", err)
	}
	user := query.Result
	result := models.UserProfileDTO{
		Id:             user.Id,
		Name:           user.Name,
		Email:          user.Email,
		Login:          user.Login,
		Theme:          user.Theme,
		IsGrafanaAdmin: user.IsAdmin,
		OrgId:          user.OrgId,
		UpdatedAt:      user.Updated,
		CreatedAt:      user.Created,
	}
	return response.JSON(200, &result)
}

// POST /api/user
func UpdateSignedInUser(c *models.ReqContext) response.Response {
	cmd := models.UpdateUserCommand{}
	if err := web.Bind(c.Req, &cmd); err != nil {
		return response.Error(http.StatusBadRequest, "bad request data", err)
	}
	if setting.AuthProxyEnabled {
		if setting.AuthProxyHeaderProperty == "email" && cmd.Email != c.Email {
			return response.Error(400, "Not allowed to change email when auth proxy is using email property", nil)
		}
		if setting.AuthProxyHeaderProperty == "username" && cmd.Login != c.Login {
			return response.Error(400, "Not allowed to change username when auth proxy is using username property", nil)
		}
	}
	cmd.UserId = c.UserId
	return handleUpdateUser(c.Req.Context(), cmd)
}

// POST /api/users/:id
func UpdateUser(c *models.ReqContext) response.Response {
	cmd := models.UpdateUserCommand{}
	var err error
	if err := web.Bind(c.Req, &cmd); err != nil {
		return response.Error(http.StatusBadRequest, "bad request data", err)
	}
	cmd.UserId, err = strconv.ParseInt(web.Params(c.Req)[":id"], 10, 64)
	if err != nil {
		return response.Error(http.StatusBadRequest, "id is invalid", err)
	}
	return handleUpdateUser(c.Req.Context(), cmd)
}

// POST /api/users/:id/using/:orgId
func UpdateUserActiveOrg(c *models.ReqContext) response.Response {
	userID, err := strconv.ParseInt(web.Params(c.Req)[":id"], 10, 64)
	if err != nil {
		return response.Error(http.StatusBadRequest, "id is invalid", err)
	}
	orgID, err := strconv.ParseInt(web.Params(c.Req)[":orgId"], 10, 64)
	if err != nil {
		return response.Error(http.StatusBadRequest, "orgId is invalid", err)
	}

	if !validateUsingOrg(c.Req.Context(), userID, orgID) {
		return response.Error(401, "Not a valid organization", nil)
	}

	cmd := models.SetUsingOrgCommand{UserId: userID, OrgId: orgID}

	if err := bus.Dispatch(c.Req.Context(), &cmd); err != nil {
		return response.Error(500, "Failed to change active organization", err)
	}

	return response.Success("Active organization changed")
}

func handleUpdateUser(ctx context.Context, cmd models.UpdateUserCommand) response.Response {
	if len(cmd.Login) == 0 {
		cmd.Login = cmd.Email
		if len(cmd.Login) == 0 {
			return response.Error(400, "Validation error, need to specify either username or email", nil)
		}
	}

	if err := bus.Dispatch(ctx, &cmd); err != nil {
		return response.Error(500, "Failed to update user", err)
	}

	return response.Success("User updated")
}

// GET /api/user/orgs
func GetSignedInUserOrgList(c *models.ReqContext) response.Response {
	return getUserOrgList(c.Req.Context(), c.UserId)
}

// GET /api/user/teams
func GetSignedInUserTeamList(c *models.ReqContext) response.Response {
	return getUserTeamList(c.Req.Context(), c.OrgId, c.UserId)
}

// GET /api/users/:id/teams
func GetUserTeams(c *models.ReqContext) response.Response {
	id, err := strconv.ParseInt(web.Params(c.Req)[":id"], 10, 64)
	if err != nil {
		return response.Error(http.StatusBadRequest, "id is invalid", err)
	}
	return getUserTeamList(c.Req.Context(), c.OrgId, id)
}

func getUserTeamList(ctx context.Context, orgID int64, userID int64) response.Response {
	query := models.GetTeamsByUserQuery{OrgId: orgID, UserId: userID}

	if err := bus.Dispatch(ctx, &query); err != nil {
		return response.Error(500, "Failed to get user teams", err)
	}

	for _, team := range query.Result {
		team.AvatarUrl = dtos.GetGravatarUrlWithDefault(team.Email, team.Name)
	}
	return response.JSON(200, query.Result)
}

// GET /api/users/:id/orgs
func GetUserOrgList(c *models.ReqContext) response.Response {
	id, err := strconv.ParseInt(web.Params(c.Req)[":id"], 10, 64)
	if err != nil {
		return response.Error(http.StatusBadRequest, "id is invalid", err)
	}
	return getUserOrgList(c.Req.Context(), id)
}

func getUserOrgList(ctx context.Context, userID int64) response.Response {
	query := models.GetUserOrgListQuery{UserId: userID}

	if err := bus.Dispatch(ctx, &query); err != nil {
		return response.Error(500, "Failed to get user organizations", err)
	}

	return response.JSON(200, query.Result)
}

func validateUsingOrg(ctx context.Context, userID int64, orgID int64) bool {
	query := models.GetUserOrgListQuery{UserId: userID}

	if err := bus.Dispatch(ctx, &query); err != nil {
		return false
	}

	// validate that the org id in the list
	valid := false
	for _, other := range query.Result {
		if other.OrgId == orgID {
			valid = true
		}
	}

	return valid
}

// POST /api/user/using/:id
func UserSetUsingOrg(c *models.ReqContext) response.Response {
	orgID, err := strconv.ParseInt(web.Params(c.Req)[":id"], 10, 64)
	if err != nil {
		return response.Error(http.StatusBadRequest, "id is invalid", err)
	}

	if !validateUsingOrg(c.Req.Context(), c.UserId, orgID) {
		return response.Error(401, "Not a valid organization", nil)
	}

	cmd := models.SetUsingOrgCommand{UserId: c.UserId, OrgId: orgID}

	if err := bus.Dispatch(c.Req.Context(), &cmd); err != nil {
		return response.Error(500, "Failed to change active organization", err)
	}

	return response.Success("Active organization changed")
}

// GET /profile/switch-org/:id
func (hs *HTTPServer) ChangeActiveOrgAndRedirectToHome(c *models.ReqContext) {
	orgID, err := strconv.ParseInt(web.Params(c.Req)[":id"], 10, 64)
	if err != nil {
		c.JsonApiErr(http.StatusBadRequest, "id is invalid", err)
		return
	}

	if !validateUsingOrg(c.Req.Context(), c.UserId, orgID) {
		hs.NotFoundHandler(c)
	}

	cmd := models.SetUsingOrgCommand{UserId: c.UserId, OrgId: orgID}

	if err := bus.Dispatch(c.Req.Context(), &cmd); err != nil {
		hs.NotFoundHandler(c)
	}

	c.Redirect(hs.Cfg.AppSubURL + "/")
}

func ChangeUserPassword(c *models.ReqContext) response.Response {
	cmd := models.ChangeUserPasswordCommand{}
	if err := web.Bind(c.Req, &cmd); err != nil {
		return response.Error(http.StatusBadRequest, "bad request data", err)
	}
	if setting.LDAPEnabled || setting.AuthProxyEnabled {
		return response.Error(400, "Not allowed to change password when LDAP or Auth Proxy is enabled", nil)
	}

	userQuery := models.GetUserByIdQuery{Id: c.UserId}

	if err := bus.Dispatch(c.Req.Context(), &userQuery); err != nil {
		return response.Error(500, "Could not read user from database", err)
	}

	passwordHashed, err := util.EncodePassword(cmd.OldPassword, userQuery.Result.Salt)
	if err != nil {
		return response.Error(500, "Failed to encode password", err)
	}
	if passwordHashed != userQuery.Result.Password {
		return response.Error(401, "Invalid old password", nil)
	}

	password := models.Password(cmd.NewPassword)
	if password.IsWeak() {
		return response.Error(400, "New password is too short", nil)
	}

	cmd.UserId = c.UserId
	cmd.NewPassword, err = util.EncodePassword(cmd.NewPassword, userQuery.Result.Salt)
	if err != nil {
		return response.Error(500, "Failed to encode password", err)
	}

	if err := bus.Dispatch(c.Req.Context(), &cmd); err != nil {
		return response.Error(500, "Failed to change user password", err)
	}

	return response.Success("User password changed")
}

// redirectToChangePassword handles GET /.well-known/change-password.
func redirectToChangePassword(c *models.ReqContext) {
	c.Redirect("/profile/password", 302)
}

func SetHelpFlag(c *models.ReqContext) response.Response {
	flag, err := strconv.ParseInt(web.Params(c.Req)[":id"], 10, 64)
	if err != nil {
		return response.Error(http.StatusBadRequest, "id is invalid", err)
	}

	bitmask := &c.HelpFlags1
	bitmask.AddFlag(models.HelpFlags1(flag))

	cmd := models.SetUserHelpFlagCommand{
		UserId:     c.UserId,
		HelpFlags1: *bitmask,
	}

	if err := bus.Dispatch(c.Req.Context(), &cmd); err != nil {
		return response.Error(500, "Failed to update help flag", err)
	}

	return response.JSON(200, &util.DynMap{"message": "Help flag set", "helpFlags1": cmd.HelpFlags1})
}

func ClearHelpFlags(c *models.ReqContext) response.Response {
	cmd := models.SetUserHelpFlagCommand{
		UserId:     c.UserId,
		HelpFlags1: models.HelpFlags1(0),
	}

	if err := bus.Dispatch(c.Req.Context(), &cmd); err != nil {
		return response.Error(500, "Failed to update help flag", err)
	}

	return response.JSON(200, &util.DynMap{"message": "Help flag set", "helpFlags1": cmd.HelpFlags1})
}

func GetAuthProviderLabel(authModule string) string {
	switch authModule {
	case "oauth_github":
		return "GitHub"
	case "oauth_google":
		return "Google"
	case "oauth_azuread":
		return "AzureAD"
	case "oauth_gitlab":
		return "GitLab"
	case "oauth_grafana_com", "oauth_grafananet":
		return "grafana.com"
	case "auth.saml":
		return "SAML"
	case "ldap", "":
		return "LDAP"
	default:
		return "OAuth"
	}
}
