package api

import (
	"github.com/grafana/grafana/pkg/api/response"
	"github.com/grafana/grafana/pkg/api/routing"
	"github.com/grafana/grafana/pkg/middleware"
	"github.com/grafana/grafana/pkg/models"
	ac "github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/web"
	"net/http"
	"strconv"
)

func NewAccessControlAPI(router routing.RouteRegister, accesscontrol ac.AccessControl, service ac.Service, features *featuremgmt.FeatureManager) *AccessControlAPI {
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
		// TODO think about whether this is the right permission - we already have some for role reading
		//if api.features.IsEnabled(featuremgmt.FlagAccessControlOnCall) {
		rr.Get("/user/:userID/permissions/search", authorize(middleware.ReqSignedIn,
			ac.EvalPermission(ac.ActionDatasourcesExplore)), routing.Wrap(api.getFilteredUserPermissions))
		//rr.Get("/user/:userID/permissions", authorize(middleware.ReqSignedIn,
		//	ac.EvalPermission(ac.ActionUsersPermissionsRead)), routing.Wrap(api.getFilteredUserPermissions))
		//}
	})
}

// GET /api/access-control/user/actions
func (api *AccessControlAPI) getUserActions(c *models.ReqContext) response.Response {
	reloadCache := c.QueryBool("reloadcache")
	permissions, err := api.Service.GetUserPermissions(c.Req.Context(),
		c.SignedInUser, ac.Options{ReloadCache: reloadCache})
	if err != nil {
		response.JSON(http.StatusInternalServerError, err)
	}

	return response.JSON(http.StatusOK, ac.BuildPermissionsMap(permissions))
}

// GET /api/access-control/user/permissions
func (api *AccessControlAPI) getUserPermissions(c *models.ReqContext) response.Response {
	reloadCache := c.QueryBool("reloadcache")
	permissions, err := api.Service.GetUserPermissions(c.Req.Context(),
		c.SignedInUser, ac.Options{ReloadCache: reloadCache})
	if err != nil {
		response.JSON(http.StatusInternalServerError, err)
	}

	return response.JSON(http.StatusOK, ac.GroupScopesByAction(permissions))
}

// GET /api/access-control/user/:userID/permissions/search
func (api *AccessControlAPI) getFilteredUserPermissions(c *models.ReqContext) response.Response {
	userIDString := web.Params(c.Req)[":userID"]
	userID, err := strconv.ParseInt(userIDString, 10, 64)
	if err != nil {
		response.Error(http.StatusBadRequest, "user ID is invalid", err)
	}
	searchOptions := ac.SearchOptions{
		ActionPrefix: c.Query("actionPrefix"),
		Action:       c.Query("action"),
		Scope:        c.Query("scope"),
	}
	permissions, err := api.Service.GetFilteredUserPermissions(c.Req.Context(), userID, c.OrgID, searchOptions)
	if err != nil {
		response.Error(http.StatusInternalServerError, "could not search user permissions", err)
	}

	return response.JSON(http.StatusOK, ac.GroupScopesByAction(permissions))
}
