package api

import (
	"net/http"
	"strconv"

	"github.com/grafana/grafana/pkg/api/response"
	"github.com/grafana/grafana/pkg/api/routing"
	"github.com/grafana/grafana/pkg/middleware"
	ac "github.com/grafana/grafana/pkg/services/accesscontrol"
	contextmodel "github.com/grafana/grafana/pkg/services/contexthandler/model"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/web"
)

func NewAccessControlAPI(router routing.RouteRegister, accesscontrol ac.AccessControl, service ac.Service,
	features *featuremgmt.FeatureManager) *AccessControlAPI {
	return &AccessControlAPI{
		RouteRegister: router,
		Service:       service,
		AccessControl: accesscontrol,
		features:      features,
	}
}

type AccessControlAPI struct {
	Service       ac.Service
	AccessControl ac.AccessControl
	RouteRegister routing.RouteRegister
	features      *featuremgmt.FeatureManager
}

func (api *AccessControlAPI) RegisterAPIEndpoints() {
	authorize := ac.Middleware(api.AccessControl)
	// Users
	api.RouteRegister.Group("/api/access-control", func(rr routing.RouteRegister) {
		rr.Get("/user/actions", middleware.ReqSignedIn, routing.Wrap(api.getUserActions))
		rr.Get("/user/permissions", middleware.ReqSignedIn, routing.Wrap(api.getUserPermissions))
		if api.features.IsEnabled(featuremgmt.FlagAccessControlOnCall) {
			userIDScope := ac.Scope("users", "id", ac.Parameter(":userID"))
			rr.Get("/users/permissions/search", authorize(middleware.ReqSignedIn,
				ac.EvalPermission(ac.ActionUsersPermissionsRead)), routing.Wrap(api.searchUsersPermissions))
			rr.Get("/user/:userID/permissions/search", authorize(middleware.ReqSignedIn,
				ac.EvalPermission(ac.ActionUsersPermissionsRead, userIDScope)), routing.Wrap(api.searchUserPermissions))
		}
	})
}

// GET /api/access-control/user/actions
func (api *AccessControlAPI) getUserActions(c *contextmodel.ReqContext) response.Response {
	reloadCache := c.QueryBool("reloadcache")
	permissions, err := api.Service.GetUserPermissions(c.Req.Context(),
		c.SignedInUser, ac.Options{ReloadCache: reloadCache})
	if err != nil {
		response.JSON(http.StatusInternalServerError, err)
	}

	return response.JSON(http.StatusOK, ac.BuildPermissionsMap(permissions))
}

// GET /api/access-control/user/permissions
func (api *AccessControlAPI) getUserPermissions(c *contextmodel.ReqContext) response.Response {
	reloadCache := c.QueryBool("reloadcache")
	permissions, err := api.Service.GetUserPermissions(c.Req.Context(),
		c.SignedInUser, ac.Options{ReloadCache: reloadCache})
	if err != nil {
		response.JSON(http.StatusInternalServerError, err)
	}

	return response.JSON(http.StatusOK, ac.GroupScopesByAction(permissions))
}

// GET /api/access-control/users/permissions
func (api *AccessControlAPI) searchUsersPermissions(c *contextmodel.ReqContext) response.Response {
	searchOptions := ac.SearchOptions{
		ActionPrefix: c.Query("actionPrefix"),
		Action:       c.Query("action"),
		Scope:        c.Query("scope"),
	}

	// Validate inputs
	if (searchOptions.ActionPrefix != "") == (searchOptions.Action != "") {
		return response.JSON(http.StatusBadRequest, "provide one of 'action' or 'actionPrefix'")
	}

	// Compute metadata
	permissions, err := api.Service.SearchUsersPermissions(c.Req.Context(), c.SignedInUser, c.OrgID, searchOptions)
	if err != nil {
		return response.Error(http.StatusInternalServerError, "could not get org user permissions", err)
	}

	permsByAction := map[int64]map[string][]string{}
	for userID, userPerms := range permissions {
		permsByAction[userID] = ac.Reduce(userPerms)
	}

	return response.JSON(http.StatusOK, permsByAction)
}

// GET /api/access-control/user/:userID/permissions/search
func (api *AccessControlAPI) searchUserPermissions(c *contextmodel.ReqContext) response.Response {
	userIDString := web.Params(c.Req)[":userID"]
	userID, err := strconv.ParseInt(userIDString, 10, 64)
	if err != nil {
		response.Error(http.StatusBadRequest, "user ID is invalid", err)
	}

	searchOptions := ac.SearchOptions{
		ActionPrefix: c.Query("actionPrefix"),
		Action:       c.Query("action"),
		Scope:        c.Query("scope"),
		UserID:       userID,
	}
	// Validate inputs
	if (searchOptions.ActionPrefix != "") == (searchOptions.Action != "") {
		return response.JSON(http.StatusBadRequest, "provide one of 'action' or 'actionPrefix'")
	}

	permissions, err := api.Service.SearchUserPermissions(c.Req.Context(), c.OrgID, searchOptions)
	if err != nil {
		response.Error(http.StatusInternalServerError, "could not search user permissions", err)
	}

	return response.JSON(http.StatusOK, ac.Reduce(permissions))
}
