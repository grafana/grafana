package api

import (
	"net/http"

	"github.com/grafana/grafana/pkg/api/response"
	"github.com/grafana/grafana/pkg/api/routing"
	"github.com/grafana/grafana/pkg/middleware"
	"github.com/grafana/grafana/pkg/models"
	ac "github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/sqlstore"
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

	api.RouteRegister.Get("/api/access-control/users/permissions", authorize(middleware.ReqSignedIn,
		ac.EvalPermission(ac.ActionUsersPermissionsRead)), routing.Wrap(api.orgUsersPermissions))
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

// POST /api/access-control/org/users/permissions
func (api *AccessControlAPI) orgUsersPermissions(c *models.ReqContext) response.Response {
	actionPrefix := c.Query("actionPrefix")

	// Validate request
	if actionPrefix == "" {
		return response.JSON(http.StatusBadRequest, "missing action prefix")
	}

	// Compute metadata
	permissions, err := api.Service.GetSimplifiedUsersPermissions(c.Req.Context(), c.OrgID, actionPrefix)
	if err != nil {
		return response.Error(http.StatusInternalServerError, "could not get org user permissions", err)
	}

	return response.JSON(http.StatusOK, permissions)
}
