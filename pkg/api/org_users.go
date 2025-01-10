package api

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"strconv"

	"github.com/grafana/grafana/pkg/api/dtos"
	"github.com/grafana/grafana/pkg/api/response"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	contextmodel "github.com/grafana/grafana/pkg/services/contexthandler/model"
	"github.com/grafana/grafana/pkg/services/login"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/services/searchusers/sortopts"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/util"
	"github.com/grafana/grafana/pkg/web"
)

// swagger:route POST /org/users org addOrgUserToCurrentOrg
//
// Add a new user to the current organization.
//
// Adds a global user to the current organization.
//
// If you are running Grafana Enterprise and have Fine-grained access control enabled
// you need to have a permission with action: `org.users:add` with scope `users:*`.
//
// Responses:
// 200: okResponse
// 401: unauthorisedError
// 403: forbiddenError
// 500: internalServerError
func (hs *HTTPServer) AddOrgUserToCurrentOrg(c *contextmodel.ReqContext) response.Response {
	cmd := org.AddOrgUserCommand{}
	if err := web.Bind(c.Req, &cmd); err != nil {
		return response.Error(http.StatusBadRequest, "bad request data", err)
	}
	cmd.OrgID = c.SignedInUser.GetOrgID()
	return hs.addOrgUserHelper(c, cmd)
}

// swagger:route POST /orgs/{org_id}/users orgs addOrgUser
//
// Add a new user to the current organization.
//
// Adds a global user to the current organization.
//
// If you are running Grafana Enterprise and have Fine-grained access control enabled
// you need to have a permission with action: `org.users:add` with scope `users:*`.
//
// Responses:
// 200: okResponse
// 401: unauthorisedError
// 403: forbiddenError
// 500: internalServerError
func (hs *HTTPServer) AddOrgUser(c *contextmodel.ReqContext) response.Response {
	cmd := org.AddOrgUserCommand{}
	if err := web.Bind(c.Req, &cmd); err != nil {
		return response.Error(http.StatusBadRequest, "bad request data", err)
	}

	var err error
	cmd.OrgID, err = strconv.ParseInt(web.Params(c.Req)[":orgId"], 10, 64)
	if err != nil {
		return response.Error(http.StatusBadRequest, "orgId is invalid", err)
	}
	return hs.addOrgUserHelper(c, cmd)
}

func (hs *HTTPServer) addOrgUserHelper(c *contextmodel.ReqContext, cmd org.AddOrgUserCommand) response.Response {
	if !cmd.Role.IsValid() {
		return response.Error(http.StatusBadRequest, "Invalid role specified", nil)
	}
	if !c.SignedInUser.GetOrgRole().Includes(cmd.Role) && !c.SignedInUser.GetIsGrafanaAdmin() {
		return response.Error(http.StatusForbidden, "Cannot assign a role higher than user's role", nil)
	}

	userQuery := user.GetUserByLoginQuery{LoginOrEmail: cmd.LoginOrEmail}
	userToAdd, err := hs.userService.GetByLogin(c.Req.Context(), &userQuery)
	if err != nil {
		return response.Error(http.StatusNotFound, "User not found", nil)
	}

	cmd.UserID = userToAdd.ID

	if err := hs.orgService.AddOrgUser(c.Req.Context(), &cmd); err != nil {
		if errors.Is(err, org.ErrOrgUserAlreadyAdded) {
			return response.JSON(http.StatusConflict, util.DynMap{
				"message": "User is already member of this organization",
				"userId":  cmd.UserID,
			})
		}
		return response.Error(http.StatusInternalServerError, "Could not add user to organization", err)
	}

	return response.JSON(http.StatusOK, util.DynMap{
		"message": "User added to organization",
		"userId":  cmd.UserID,
	})
}

// swagger:route GET /org/users org getOrgUsersForCurrentOrg
//
// Get all users within the current organization.
//
// Returns all org users within the current organization. Accessible to users with org admin role.
// If you are running Grafana Enterprise and have Fine-grained access control enabled
// you need to have a permission with action: `org.users:read` with scope `users:*`.
//
// Responses:
// 200: getOrgUsersForCurrentOrgResponse
// 401: unauthorisedError
// 403: forbiddenError
// 500: internalServerError
func (hs *HTTPServer) GetOrgUsersForCurrentOrg(c *contextmodel.ReqContext) response.Response {
	result, err := hs.searchOrgUsersHelper(c, &org.SearchOrgUsersQuery{
		OrgID: c.SignedInUser.GetOrgID(),
		Query: c.Query("query"),
		Limit: c.QueryInt("limit"),
		User:  c.SignedInUser,
	})

	if err != nil {
		return response.Error(http.StatusInternalServerError, "Failed to get users for current organization", err)
	}

	return response.JSON(http.StatusOK, result.OrgUsers)
}

// swagger:route GET /org/users/lookup org getOrgUsersForCurrentOrgLookup
//
// Get all users within the current organization (lookup)
//
// Returns all org users within the current organization, but with less detailed information.
// Accessible to users with org admin role, admin in any folder or admin of any team.
// Mainly used by Grafana UI for providing list of users when adding team members and when editing folder/dashboard permissions.
//
// Responses:
// 200: getOrgUsersForCurrentOrgLookupResponse
// 401: unauthorisedError
// 403: forbiddenError
// 500: internalServerError

func (hs *HTTPServer) GetOrgUsersForCurrentOrgLookup(c *contextmodel.ReqContext) response.Response {
	orgUsersResult, err := hs.searchOrgUsersHelper(c, &org.SearchOrgUsersQuery{
		OrgID:                    c.SignedInUser.GetOrgID(),
		Query:                    c.Query("query"),
		Limit:                    c.QueryInt("limit"),
		User:                     c.SignedInUser,
		DontEnforceAccessControl: !hs.License.FeatureEnabled("accesscontrol.enforcement"),
	})

	if err != nil {
		return response.Error(http.StatusInternalServerError, "Failed to get users for current organization", err)
	}

	result := make([]*dtos.UserLookupDTO, 0)

	for _, u := range orgUsersResult.OrgUsers {
		result = append(result, &dtos.UserLookupDTO{
			UserID:    u.UserID,
			Login:     u.Login,
			AvatarURL: u.AvatarURL,
		})
	}

	return response.JSON(http.StatusOK, result)
}

// swagger:route GET /orgs/{org_id}/users orgs getOrgUsers
//
// Get Users in Organization.
//
// If you are running Grafana Enterprise and have Fine-grained access control enabled
// you need to have a permission with action: `org.users:read` with scope `users:*`.
//
// Security:
// - basic:
//
// Responses:
// 200: getOrgUsersResponse
// 401: unauthorisedError
// 403: forbiddenError
// 500: internalServerError
func (hs *HTTPServer) GetOrgUsers(c *contextmodel.ReqContext) response.Response {
	orgId, err := strconv.ParseInt(web.Params(c.Req)[":orgId"], 10, 64)
	if err != nil {
		return response.Error(http.StatusBadRequest, "orgId is invalid", err)
	}

	result, err := hs.searchOrgUsersHelper(c, &org.SearchOrgUsersQuery{
		OrgID: orgId,
		Query: "",
		Limit: 0,
		User:  c.SignedInUser,
	})

	if err != nil {
		return response.Error(http.StatusInternalServerError, "Failed to get users for organization", err)
	}

	return response.JSON(http.StatusOK, result.OrgUsers)
}

// swagger:route GET /orgs/{org_id}/users/search orgs searchOrgUsers
//
// Search Users in Organization.
//
// If you are running Grafana Enterprise and have Fine-grained access control enabled
// you need to have a permission with action: `org.users:read` with scope `users:*`.
//
// Security:
// - basic:
//
// Responses:
// 200: searchOrgUsersResponse
// 401: unauthorisedError
// 403: forbiddenError
// 500: internalServerError
func (hs *HTTPServer) SearchOrgUsers(c *contextmodel.ReqContext) response.Response {
	orgID, err := strconv.ParseInt(web.Params(c.Req)[":orgId"], 10, 64)
	if err != nil {
		return response.Error(http.StatusBadRequest, "orgId is invalid", err)
	}

	perPage := c.QueryInt("perpage")
	if perPage <= 0 {
		perPage = 1000
	}
	page := c.QueryInt("page")

	if page < 1 {
		page = 1
	}

	sortOpts, err := sortopts.ParseSortQueryParam(c.Query("sort"))
	if err != nil {
		return response.Err(err)
	}

	result, err := hs.searchOrgUsersHelper(c, &org.SearchOrgUsersQuery{
		OrgID:    orgID,
		Query:    c.Query("query"),
		Page:     page,
		Limit:    perPage,
		User:     c.SignedInUser,
		SortOpts: sortOpts,
	})

	if err != nil {
		return response.Error(http.StatusInternalServerError, "Failed to get users for organization", err)
	}

	return response.JSON(http.StatusOK, result)
}

// SearchOrgUsersWithPaging is an HTTP handler to search for org users with paging.
// GET /api/org/users/search
func (hs *HTTPServer) SearchOrgUsersWithPaging(c *contextmodel.ReqContext) response.Response {
	perPage := c.QueryInt("perpage")
	if perPage <= 0 {
		perPage = 1000
	}
	page := c.QueryInt("page")

	if page < 1 {
		page = 1
	}

	sortOpts, err := sortopts.ParseSortQueryParam(c.Query("sort"))
	if err != nil {
		return response.Err(err)
	}

	query := &org.SearchOrgUsersQuery{
		OrgID:    c.SignedInUser.GetOrgID(),
		Query:    c.Query("query"),
		Page:     page,
		Limit:    perPage,
		User:     c.SignedInUser,
		SortOpts: sortOpts,
	}

	result, err := hs.searchOrgUsersHelper(c, query)
	if err != nil {
		return response.Error(http.StatusInternalServerError, "Failed to get users for current organization", err)
	}

	return response.JSON(http.StatusOK, result)
}

func (hs *HTTPServer) searchOrgUsersHelper(c *contextmodel.ReqContext, query *org.SearchOrgUsersQuery) (*org.SearchOrgUsersQueryResult, error) {
	result, err := hs.orgService.SearchOrgUsers(c.Req.Context(), query)
	if err != nil {
		return nil, err
	}

	filteredUsers := make([]*org.OrgUserDTO, 0, len(result.OrgUsers))
	userIDs := map[string]bool{}
	authLabelsUserIDs := make([]int64, 0, len(result.OrgUsers))
	for _, user := range result.OrgUsers {
		if dtos.IsHiddenUser(user.Login, c.SignedInUser, hs.Cfg) {
			continue
		}
		user.AvatarURL = dtos.GetGravatarUrl(hs.Cfg, user.Email)

		userIDs[fmt.Sprint(user.UserID)] = true
		authLabelsUserIDs = append(authLabelsUserIDs, user.UserID)

		filteredUsers = append(filteredUsers, user)
	}

	modules, err := hs.authInfoService.GetUserLabels(c.Req.Context(), login.GetUserLabelsQuery{
		UserIDs: authLabelsUserIDs,
	})

	if err != nil {
		hs.log.Warn("failed to retrieve users IDP label", err)
	}

	// Get accesscontrol metadata and IPD labels for users in the target org
	accessControlMetadata := map[string]accesscontrol.Metadata{}
	if c.QueryBool("accesscontrol") {
		permissions := c.SignedInUser.GetPermissions()
		if query.OrgID != c.SignedInUser.GetOrgID() {
			identity, err := hs.authnService.ResolveIdentity(c.Req.Context(), query.OrgID, c.SignedInUser.GetID())
			if err != nil {
				return nil, err
			}
			permissions = identity.GetPermissions()
		}
		accessControlMetadata = accesscontrol.GetResourcesMetadata(c.Req.Context(), permissions, "users:id:", userIDs)
	}

	for i := range filteredUsers {
		filteredUsers[i].AccessControl = accessControlMetadata[fmt.Sprint(filteredUsers[i].UserID)]
		if module, ok := modules[filteredUsers[i].UserID]; ok {
			filteredUsers[i].AuthLabels = []string{login.GetAuthProviderLabel(module)}
			filteredUsers[i].IsExternallySynced = hs.isExternallySynced(hs.Cfg, module)
		}
	}

	result.OrgUsers = filteredUsers
	result.Page = query.Page
	result.PerPage = query.Limit
	return result, nil
}

// swagger:route PATCH /org/users/{user_id} org updateOrgUserForCurrentOrg
//
// Updates the given user.
//
// If you are running Grafana Enterprise and have Fine-grained access control enabled
// you need to have a permission with action: `org.users.role:update` with scope `users:*`.
//
// Responses:
// 200: okResponse
// 400: badRequestError
// 401: unauthorisedError
// 403: forbiddenError
// 500: internalServerError
func (hs *HTTPServer) UpdateOrgUserForCurrentOrg(c *contextmodel.ReqContext) response.Response {
	cmd := org.UpdateOrgUserCommand{}
	if err := web.Bind(c.Req, &cmd); err != nil {
		return response.Error(http.StatusBadRequest, "bad request data", err)
	}
	cmd.OrgID = c.SignedInUser.GetOrgID()
	var err error
	cmd.UserID, err = strconv.ParseInt(web.Params(c.Req)[":userId"], 10, 64)
	if err != nil {
		return response.Error(http.StatusBadRequest, "userId is invalid", err)
	}
	return hs.updateOrgUserHelper(c, cmd)
}

// swagger:route PATCH /orgs/{org_id}/users/{user_id} orgs updateOrgUser
//
// Update Users in Organization.
//
// If you are running Grafana Enterprise and have Fine-grained access control enabled
// you need to have a permission with action: `org.users.role:update` with scope `users:*`.
//
// Responses:
// 200: okResponse
// 400: badRequestError
// 401: unauthorisedError
// 403: forbiddenError
// 500: internalServerError
func (hs *HTTPServer) UpdateOrgUser(c *contextmodel.ReqContext) response.Response {
	cmd := org.UpdateOrgUserCommand{}
	var err error
	if err := web.Bind(c.Req, &cmd); err != nil {
		return response.Error(http.StatusBadRequest, "bad request data", err)
	}
	cmd.OrgID, err = strconv.ParseInt(web.Params(c.Req)[":orgId"], 10, 64)
	if err != nil {
		return response.Error(http.StatusBadRequest, "orgId is invalid", err)
	}
	cmd.UserID, err = strconv.ParseInt(web.Params(c.Req)[":userId"], 10, 64)
	if err != nil {
		return response.Error(http.StatusBadRequest, "userId is invalid", err)
	}
	return hs.updateOrgUserHelper(c, cmd)
}

func (hs *HTTPServer) updateOrgUserHelper(c *contextmodel.ReqContext, cmd org.UpdateOrgUserCommand) response.Response {
	if !cmd.Role.IsValid() {
		return response.Error(http.StatusBadRequest, "Invalid role specified", nil)
	}
	if !c.SignedInUser.GetOrgRole().Includes(cmd.Role) && !c.SignedInUser.GetIsGrafanaAdmin() {
		return response.Error(http.StatusForbidden, "Cannot assign a role higher than user's role", nil)
	}

	// we do not allow to change role for external synced users
	qAuth := login.GetAuthInfoQuery{UserId: cmd.UserID}
	authInfo, err := hs.authInfoService.GetAuthInfo(c.Req.Context(), &qAuth)
	if err != nil {
		if errors.Is(err, user.ErrUserNotFound) {
			hs.log.Debug("Failed to get user auth info for basic auth user", cmd.UserID, nil)
		} else {
			hs.log.Error("Failed to get user auth info for external sync check", cmd.UserID, err)
			return response.Error(http.StatusInternalServerError, "Failed to get user auth info", nil)
		}
	}
	if authInfo != nil && authInfo.AuthModule != "" {
		if hs.isExternallySynced(hs.Cfg, authInfo.AuthModule) {
			return response.Err(org.ErrCannotChangeRoleForExternallySyncedUser.Errorf("Cannot change role for externally synced user"))
		}
	}

	if err := hs.orgService.UpdateOrgUser(c.Req.Context(), &cmd); err != nil {
		if errors.Is(err, org.ErrLastOrgAdmin) {
			return response.Error(http.StatusBadRequest, "Cannot change role so that there is no organization admin left", nil)
		}
		return response.Error(http.StatusInternalServerError, "Failed update org user", err)
	}

	hs.accesscontrolService.ClearUserPermissionCache(&user.SignedInUser{
		UserID: cmd.UserID,
		OrgID:  cmd.OrgID,
	})

	return response.Success("Organization user updated")
}

// swagger:route DELETE /org/users/{user_id} org removeOrgUserForCurrentOrg
//
// Delete user in current organization.
//
// If you are running Grafana Enterprise and have Fine-grained access control enabled
// you need to have a permission with action: `org.users:remove` with scope `users:*`.
//
// Responses:
// 200: okResponse
// 400: badRequestError
// 401: unauthorisedError
// 403: forbiddenError
// 500: internalServerError
func (hs *HTTPServer) RemoveOrgUserForCurrentOrg(c *contextmodel.ReqContext) response.Response {
	userId, err := strconv.ParseInt(web.Params(c.Req)[":userId"], 10, 64)
	if err != nil {
		return response.Error(http.StatusBadRequest, "userId is invalid", err)
	}

	return hs.removeOrgUserHelper(c.Req.Context(), &org.RemoveOrgUserCommand{
		UserID:                   userId,
		OrgID:                    c.SignedInUser.GetOrgID(),
		ShouldDeleteOrphanedUser: true,
	})
}

// swagger:route DELETE /orgs/{org_id}/users/{user_id} orgs removeOrgUser
//
// Delete user in current organization.
//
// If you are running Grafana Enterprise and have Fine-grained access control enabled
// you need to have a permission with action: `org.users:remove` with scope `users:*`.
//
// Responses:
// 200: okResponse
// 400: badRequestError
// 401: unauthorisedError
// 403: forbiddenError
// 500: internalServerError
func (hs *HTTPServer) RemoveOrgUser(c *contextmodel.ReqContext) response.Response {
	userId, err := strconv.ParseInt(web.Params(c.Req)[":userId"], 10, 64)
	if err != nil {
		return response.Error(http.StatusBadRequest, "userId is invalid", err)
	}
	orgId, err := strconv.ParseInt(web.Params(c.Req)[":orgId"], 10, 64)
	if err != nil {
		return response.Error(http.StatusBadRequest, "orgId is invalid", err)
	}
	return hs.removeOrgUserHelper(c.Req.Context(), &org.RemoveOrgUserCommand{
		UserID: userId,
		OrgID:  orgId,
	})
}

func (hs *HTTPServer) removeOrgUserHelper(ctx context.Context, cmd *org.RemoveOrgUserCommand) response.Response {
	if err := hs.orgService.RemoveOrgUser(ctx, cmd); err != nil {
		if errors.Is(err, org.ErrLastOrgAdmin) {
			return response.Error(http.StatusBadRequest, "Cannot remove last organization admin", nil)
		}
		return response.Error(http.StatusInternalServerError, "Failed to remove user from organization", err)
	}

	if cmd.UserWasDeleted {
		// This should be called from appropriate service when moved
		if err := hs.accesscontrolService.DeleteUserPermissions(ctx, accesscontrol.GlobalOrgID, cmd.UserID); err != nil {
			hs.log.Warn("failed to delete permissions for user", "userID", cmd.UserID, "orgID", accesscontrol.GlobalOrgID, "err", err)
		}
		return response.Success("User deleted")
	}

	// This should be called from appropriate service when moved
	if err := hs.accesscontrolService.DeleteUserPermissions(ctx, cmd.OrgID, cmd.UserID); err != nil {
		hs.log.Warn("failed to delete permissions for user", "userID", cmd.UserID, "orgID", cmd.OrgID, "err", err)
	}

	return response.Success("User removed from organization")
}

// swagger:parameters addOrgUserToCurrentOrg
type AddOrgUserToCurrentOrgParams struct {
	// in:body
	// required:true
	Body org.AddOrgUserCommand `json:"body"`
}

// swagger:parameters addOrgUser
type AddOrgUserParams struct {
	// in:body
	// required:true
	Body org.AddOrgUserCommand `json:"body"`
	// in:path
	// required:true
	OrgID int64 `json:"org_id"`
}

// swagger:parameters getOrgUsersForCurrentOrgLookup
type LookupOrgUsersParams struct {
	// in:query
	// required:false
	Query string `json:"query"`
	// in:query
	// required:false
	Limit int `json:"limit"`
}

// swagger:parameters getOrgUsers
type GetOrgUsersParams struct {
	// in:path
	// required:true
	OrgID int64 `json:"org_id"`
}

// swagger:parameters updateOrgUserForCurrentOrg
type UpdateOrgUserForCurrentOrgParams struct {
	// in:body
	// required:true
	Body org.UpdateOrgUserCommand `json:"body"`
	// in:path
	// required:true
	UserID int64 `json:"user_id"`
}

// swagger:parameters updateOrgUser
type UpdateOrgUserParams struct {
	// in:body
	// required:true
	Body org.UpdateOrgUserCommand `json:"body"`
	// in:path
	// required:true
	OrgID int64 `json:"org_id"`
	// in:path
	// required:true
	UserID int64 `json:"user_id"`
}

// swagger:parameters removeOrgUserForCurrentOrg
type RemoveOrgUserForCurrentOrgParams struct {
	// in:path
	// required:true
	UserID int64 `json:"user_id"`
}

// swagger:parameters removeOrgUser
type RemoveOrgUserParams struct {
	// in:path
	// required:true
	OrgID int64 `json:"org_id"`
	// in:path
	// required:true
	UserID int64 `json:"user_id"`
}

// swagger:parameters searchOrgUsers
type SearchOrgUsersParams struct {
	// in:path
	// required:true
	OrgID int64 `json:"org_id"`
}

// swagger:response getOrgUsersForCurrentOrgLookupResponse
type GetOrgUsersForCurrentOrgLookupResponse struct {
	// The response message
	// in: body
	Body []*dtos.UserLookupDTO `json:"body"`
}

// swagger:response getOrgUsersForCurrentOrgResponse
type GetOrgUsersForCurrentOrgResponse struct {
	// The response message
	// in: body
	Body []*org.OrgUserDTO `json:"body"`
}

// swagger:response getOrgUsersResponse
type GetOrgUsersResponse struct {
	// The response message/
	// in: body
	Body []*org.OrgUserDTO `json:"body"`
}

// swagger:response searchOrgUsersResponse
type SearchOrgUsersResponse struct {
	// The response message
	// in: body
	Body *org.SearchOrgUsersQueryResult `json:"body"`
}
