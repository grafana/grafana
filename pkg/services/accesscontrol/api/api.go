package api

import (
	"context"
	"net/http"
	"strconv"

	"github.com/grafana/grafana/pkg/api/response"
	"github.com/grafana/grafana/pkg/api/routing"
	"github.com/grafana/grafana/pkg/middleware"
	"github.com/grafana/grafana/pkg/models"
	ac "github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/web"
)

func NewAccessControlAPI(router routing.RouteRegister, accesscontrol ac.AccessControl, service ac.Service, userStore sqlstore.Store) *AccessControlAPI {
	return &AccessControlAPI{
		RouteRegister: router,
		Service:       service,
		AccessControl: accesscontrol,
		userStore:     userStore,
	}
}

type AccessControlAPI struct {
	Service       ac.Service
	AccessControl ac.AccessControl
	RouteRegister routing.RouteRegister
	userStore     sqlstore.Store
}

func (api *AccessControlAPI) RegisterAPIEndpoints() {
	authorize := ac.Middleware(api.AccessControl)
	// Users
	api.RouteRegister.Get("/api/access-control/user/permissions",
		middleware.ReqSignedIn, routing.Wrap(api.getUsersPermissions))
	api.RouteRegister.Post("/api/access-control/user/evaluation", middleware.ReqSignedIn, routing.Wrap(api.evaluateSelfMetadata))
	api.RouteRegister.Post("/api/access-control/user/:userID/evaluation", authorize(middleware.ReqSignedIn,
		ac.EvalPermission(ac.ActionUsersPermissionsRead, ac.Scope("users", "id", ac.Parameter(":userID")))),
		routing.Wrap(api.evaluateMetadata))
}

// GET /api/access-control/user/permissions
func (api *AccessControlAPI) getUsersPermissions(c *models.ReqContext) response.Response {
	reloadCache := c.QueryBool("reloadcache")
	permissions, err := api.Service.GetUserPermissions(c.Req.Context(),
		c.SignedInUser, ac.Options{ReloadCache: reloadCache})
	if err != nil {
		response.JSON(http.StatusInternalServerError, err)
	}

	return response.JSON(http.StatusOK, ac.BuildPermissionsMap(permissions))
}

// POST /api/access-control/user/evaluation
func (api *AccessControlAPI) evaluateSelfMetadata(c *models.ReqContext) response.Response {
	var cmd ac.EvaluateUserPermissionCommand
	if err := web.Bind(c.Req, &cmd); err != nil {
		return response.JSON(http.StatusBadRequest, err)
	}

	// Validate request
	if cmd.Action == "" && (cmd.Resource == "" || cmd.Attribute == "" || len(cmd.UIDs) == 0) {
		return response.JSON(http.StatusBadRequest, "missing an action or resources")
	}

	// Use ctx signed in user
	cmd.SignedInUser = c.SignedInUser

	// Compute metadata
	metadata, err := api.AccessControl.EvaluateMetadata(c.Req.Context(), cmd)
	if err != nil {
		return response.Error(http.StatusInternalServerError, "could not evaluate user permissions", err)
	}

	return response.JSON(http.StatusOK, metadata)
}

// POST /api/access-control/user/:userId/evaluation
func (api *AccessControlAPI) evaluateMetadata(c *models.ReqContext) response.Response {
	// Parse request
	reloadCache := c.QueryBool("reloadcache")

	var cmd ac.EvaluateUserPermissionCommand
	if err := web.Bind(c.Req, &cmd); err != nil {
		return response.JSON(http.StatusBadRequest, err)
	}

	userID, err := strconv.ParseInt(web.Params(c.Req)[":userID"], 10, 64)
	if err != nil {
		return response.Error(http.StatusBadRequest, "user id is invalid", err)
	}

	// Validate request
	if cmd.Action == "" && (cmd.Resource == "" || cmd.Attribute == "" || len(cmd.UIDs) == 0) {
		return response.JSON(http.StatusBadRequest, "missing an action or resources")
	}

	// Generate signed in user
	cmd.SignedInUser, err = api.signedInUser(c.Req.Context(), userID, c.OrgID, reloadCache)
	if err != nil {
		return response.Error(http.StatusInternalServerError, "could not get user permissions", err)
	}

	// Compute metadata
	metadata, err := api.AccessControl.EvaluateMetadata(c.Req.Context(), cmd)
	if err != nil {
		return response.Error(http.StatusInternalServerError, "could not evaluate user permissions", err)
	}

	return response.JSON(http.StatusOK, metadata)
}

func (api *AccessControlAPI) signedInUser(ctx context.Context, userID, orgID int64,
	reloadCache bool) (*user.SignedInUser, error) {
	userQuery := &models.GetSignedInUserQuery{UserId: userID, OrgId: orgID}
	errGetUser := api.userStore.GetSignedInUser(ctx, userQuery)
	if errGetUser != nil {
		return nil, errGetUser
	}

	permissions, errGetPerms := api.Service.GetUserPermissions(ctx, userQuery.Result,
		ac.Options{ReloadCache: reloadCache})
	if errGetPerms != nil {
		return nil, errGetPerms
	}
	userQuery.Result.Permissions = map[int64]map[string][]string{
		orgID: ac.GroupScopesByAction(permissions),
	}
	return userQuery.Result, nil
}
