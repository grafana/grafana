package api

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"strconv"

	"github.com/grafana/grafana/pkg/api/dtos"
	"github.com/grafana/grafana/pkg/api/response"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/util"
	"github.com/grafana/grafana/pkg/web"
)

// swagger:route POST /org/users org addOrgUserToCurrentOrg
//
// Add a new user to the current organization
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
func (hs *HTTPServer) AddOrgUserToCurrentOrg(c *models.ReqContext) response.Response {
	cmd := models.AddOrgUserCommand{}
	if err := web.Bind(c.Req, &cmd); err != nil {
		return response.Error(http.StatusBadRequest, "bad request data", err)
	}
	cmd.OrgId = c.OrgID
	return hs.addOrgUserHelper(c, cmd)
}

// swagger:route POST /orgs/{org_id}/users orgs addOrgUser
//
// Add a new user to the current organization
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
func (hs *HTTPServer) AddOrgUser(c *models.ReqContext) response.Response {
	cmd := models.AddOrgUserCommand{}
	if err := web.Bind(c.Req, &cmd); err != nil {
		return response.Error(http.StatusBadRequest, "bad request data", err)
	}

	var err error
	cmd.OrgId, err = strconv.ParseInt(web.Params(c.Req)[":orgId"], 10, 64)
	if err != nil {
		return response.Error(http.StatusBadRequest, "orgId is invalid", err)
	}
	return hs.addOrgUserHelper(c, cmd)
}

func (hs *HTTPServer) addOrgUserHelper(c *models.ReqContext, cmd models.AddOrgUserCommand) response.Response {
	if !cmd.Role.IsValid() {
		return response.Error(400, "Invalid role specified", nil)
	}
	if !c.OrgRole.Includes(cmd.Role) && !c.IsGrafanaAdmin {
		return response.Error(http.StatusForbidden, "Cannot assign a role higher than user's role", nil)
	}

	userQuery := user.GetUserByLoginQuery{LoginOrEmail: cmd.LoginOrEmail}
	userToAdd, err := hs.userService.GetByLogin(c.Req.Context(), &userQuery)
	if err != nil {
		return response.Error(404, "User not found", nil)
	}

	cmd.UserId = userToAdd.ID

	if err := hs.SQLStore.AddOrgUser(c.Req.Context(), &cmd); err != nil {
		if errors.Is(err, models.ErrOrgUserAlreadyAdded) {
			return response.JSON(409, util.DynMap{
				"message": "User is already member of this organization",
				"userId":  cmd.UserId,
			})
		}
		return response.Error(500, "Could not add user to organization", err)
	}

	return response.JSON(http.StatusOK, util.DynMap{
		"message": "User added to organization",
		"userId":  cmd.UserId,
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
func (hs *HTTPServer) GetOrgUsersForCurrentOrg(c *models.ReqContext) response.Response {
	result, err := hs.getOrgUsersHelper(c, &models.GetOrgUsersQuery{
		OrgId: c.OrgID,
		Query: c.Query("query"),
		Limit: c.QueryInt("limit"),
		User:  c.SignedInUser,
	}, c.SignedInUser)

	if err != nil {
		return response.Error(500, "Failed to get users for current organization", err)
	}

	return response.JSON(http.StatusOK, result)
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

func (hs *HTTPServer) GetOrgUsersForCurrentOrgLookup(c *models.ReqContext) response.Response {
	orgUsers, err := hs.getOrgUsersHelper(c, &models.GetOrgUsersQuery{
		OrgId:                    c.OrgID,
		Query:                    c.Query("query"),
		Limit:                    c.QueryInt("limit"),
		User:                     c.SignedInUser,
		DontEnforceAccessControl: !hs.License.FeatureEnabled("accesscontrol.enforcement"),
	}, c.SignedInUser)

	if err != nil {
		return response.Error(500, "Failed to get users for current organization", err)
	}

	result := make([]*dtos.UserLookupDTO, 0)

	for _, u := range orgUsers {
		result = append(result, &dtos.UserLookupDTO{
			UserID:    u.UserId,
			Login:     u.Login,
			AvatarURL: u.AvatarUrl,
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
func (hs *HTTPServer) GetOrgUsers(c *models.ReqContext) response.Response {
	orgId, err := strconv.ParseInt(web.Params(c.Req)[":orgId"], 10, 64)
	if err != nil {
		return response.Error(http.StatusBadRequest, "orgId is invalid", err)
	}

	result, err := hs.getOrgUsersHelper(c, &models.GetOrgUsersQuery{
		OrgId: orgId,
		Query: "",
		Limit: 0,
		User:  c.SignedInUser,
	}, c.SignedInUser)

	if err != nil {
		return response.Error(500, "Failed to get users for organization", err)
	}

	return response.JSON(http.StatusOK, result)
}

func (hs *HTTPServer) getOrgUsersHelper(c *models.ReqContext, query *models.GetOrgUsersQuery, signedInUser *user.SignedInUser) ([]*models.OrgUserDTO, error) {
	if err := hs.SQLStore.GetOrgUsers(c.Req.Context(), query); err != nil {
		return nil, err
	}

	filteredUsers := make([]*models.OrgUserDTO, 0, len(query.Result))
	userIDs := map[string]bool{}
	for _, user := range query.Result {
		if dtos.IsHiddenUser(user.Login, signedInUser, hs.Cfg) {
			continue
		}
		user.AvatarUrl = dtos.GetGravatarUrl(user.Email)

		userIDs[fmt.Sprint(user.UserId)] = true
		filteredUsers = append(filteredUsers, user)
	}

	// Get accesscontrol metadata for users in the target org
	accessControlMetadata := hs.getMultiAccessControlMetadata(c, query.OrgId, "users:id:", userIDs)
	if len(accessControlMetadata) > 0 {
		for i := range filteredUsers {
			filteredUsers[i].AccessControl = accessControlMetadata[fmt.Sprint(filteredUsers[i].UserId)]
		}
	}

	return filteredUsers, nil
}

// SearchOrgUsersWithPaging is an HTTP handler to search for org users with paging.
// GET /api/org/users/search
func (hs *HTTPServer) SearchOrgUsersWithPaging(c *models.ReqContext) response.Response {
	ctx := c.Req.Context()
	perPage := c.QueryInt("perpage")
	if perPage <= 0 {
		perPage = 1000
	}
	page := c.QueryInt("page")

	if page < 1 {
		page = 1
	}

	query := &models.SearchOrgUsersQuery{
		OrgID: c.OrgID,
		Query: c.Query("query"),
		Page:  page,
		Limit: perPage,
		User:  c.SignedInUser,
	}

	if err := hs.SQLStore.SearchOrgUsers(ctx, query); err != nil {
		return response.Error(500, "Failed to get users for current organization", err)
	}

	filteredUsers := make([]*models.OrgUserDTO, 0, len(query.Result.OrgUsers))
	for _, user := range query.Result.OrgUsers {
		if dtos.IsHiddenUser(user.Login, c.SignedInUser, hs.Cfg) {
			continue
		}
		user.AvatarUrl = dtos.GetGravatarUrl(user.Email)

		filteredUsers = append(filteredUsers, user)
	}

	query.Result.OrgUsers = filteredUsers
	query.Result.Page = page
	query.Result.PerPage = perPage

	return response.JSON(http.StatusOK, query.Result)
}

// swagger:route PATCH /org/users/{user_id} org updateOrgUserForCurrentOrg
//
// Updates the given user
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
func (hs *HTTPServer) UpdateOrgUserForCurrentOrg(c *models.ReqContext) response.Response {
	cmd := models.UpdateOrgUserCommand{}
	if err := web.Bind(c.Req, &cmd); err != nil {
		return response.Error(http.StatusBadRequest, "bad request data", err)
	}
	cmd.OrgId = c.OrgID
	var err error
	cmd.UserId, err = strconv.ParseInt(web.Params(c.Req)[":userId"], 10, 64)
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
func (hs *HTTPServer) UpdateOrgUser(c *models.ReqContext) response.Response {
	cmd := models.UpdateOrgUserCommand{}
	var err error
	if err := web.Bind(c.Req, &cmd); err != nil {
		return response.Error(http.StatusBadRequest, "bad request data", err)
	}
	cmd.OrgId, err = strconv.ParseInt(web.Params(c.Req)[":orgId"], 10, 64)
	if err != nil {
		return response.Error(http.StatusBadRequest, "orgId is invalid", err)
	}
	cmd.UserId, err = strconv.ParseInt(web.Params(c.Req)[":userId"], 10, 64)
	if err != nil {
		return response.Error(http.StatusBadRequest, "userId is invalid", err)
	}
	return hs.updateOrgUserHelper(c, cmd)
}

func (hs *HTTPServer) updateOrgUserHelper(c *models.ReqContext, cmd models.UpdateOrgUserCommand) response.Response {
	if !cmd.Role.IsValid() {
		return response.Error(400, "Invalid role specified", nil)
	}
	if !c.OrgRole.Includes(cmd.Role) && !c.IsGrafanaAdmin {
		return response.Error(http.StatusForbidden, "Cannot assign a role higher than user's role", nil)
	}
	if err := hs.SQLStore.UpdateOrgUser(c.Req.Context(), &cmd); err != nil {
		if errors.Is(err, models.ErrLastOrgAdmin) {
			return response.Error(400, "Cannot change role so that there is no organization admin left", nil)
		}
		return response.Error(500, "Failed update org user", err)
	}

	return response.Success("Organization user updated")
}

// swagger:route DELETE /org/users/{user_id} org removeOrgUserForCurrentOrg
//
// Delete user in current organization
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
func (hs *HTTPServer) RemoveOrgUserForCurrentOrg(c *models.ReqContext) response.Response {
	userId, err := strconv.ParseInt(web.Params(c.Req)[":userId"], 10, 64)
	if err != nil {
		return response.Error(http.StatusBadRequest, "userId is invalid", err)
	}

	return hs.removeOrgUserHelper(c.Req.Context(), &models.RemoveOrgUserCommand{
		UserId:                   userId,
		OrgId:                    c.OrgID,
		ShouldDeleteOrphanedUser: true,
	})
}

// swagger:route DELETE /orgs/{org_id}/users/{user_id} orgs removeOrgUser
//
// Delete user in current organization
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
func (hs *HTTPServer) RemoveOrgUser(c *models.ReqContext) response.Response {
	userId, err := strconv.ParseInt(web.Params(c.Req)[":userId"], 10, 64)
	if err != nil {
		return response.Error(http.StatusBadRequest, "userId is invalid", err)
	}
	orgId, err := strconv.ParseInt(web.Params(c.Req)[":orgId"], 10, 64)
	if err != nil {
		return response.Error(http.StatusBadRequest, "orgId is invalid", err)
	}
	return hs.removeOrgUserHelper(c.Req.Context(), &models.RemoveOrgUserCommand{
		UserId: userId,
		OrgId:  orgId,
	})
}

func (hs *HTTPServer) removeOrgUserHelper(ctx context.Context, cmd *models.RemoveOrgUserCommand) response.Response {
	if err := hs.SQLStore.RemoveOrgUser(ctx, cmd); err != nil {
		if errors.Is(err, models.ErrLastOrgAdmin) {
			return response.Error(400, "Cannot remove last organization admin", nil)
		}
		return response.Error(500, "Failed to remove user from organization", err)
	}

	if cmd.UserWasDeleted {
		// This should be called from appropriate service when moved
		if err := hs.accesscontrolService.DeleteUserPermissions(ctx, accesscontrol.GlobalOrgID, cmd.UserId); err != nil {
			hs.log.Warn("failed to delete permissions for user", "userID", cmd.UserId, "orgID", accesscontrol.GlobalOrgID, "err", err)
		}
		return response.Success("User deleted")
	}

	// This should be called from appropriate service when moved
	if err := hs.accesscontrolService.DeleteUserPermissions(ctx, cmd.OrgId, cmd.UserId); err != nil {
		hs.log.Warn("failed to delete permissions for user", "userID", cmd.UserId, "orgID", cmd.OrgId, "err", err)
	}

	return response.Success("User removed from organization")
}

// swagger:parameters addOrgUserToCurrentOrg
type AddOrgUserToCurrentOrgParams struct {
	// in:body
	// required:true
	Body models.AddOrgUserCommand `json:"body"`
}

// swagger:parameters addOrgUser
type AddOrgUserParams struct {
	// in:body
	// required:true
	Body models.AddOrgUserCommand `json:"body"`
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
	Body models.UpdateOrgUserCommand `json:"body"`
	// in:path
	// required:true
	UserID int64 `json:"user_id"`
}

// swagger:parameters updateOrgUser
type UpdateOrgUserParams struct {
	// in:body
	// required:true
	Body models.UpdateOrgUserCommand `json:"body"`
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
	Body []*models.OrgUserDTO `json:"body"`
}

// swagger:response getOrgUsersResponse
type GetOrgUsersResponse struct {
	// The response message
	// in: body
	Body []*models.OrgUserDTO `json:"body"`
}
