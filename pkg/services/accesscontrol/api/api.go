package api

import (
	"net/http"

	"github.com/grafana/grafana/pkg/api/response"
	"github.com/grafana/grafana/pkg/api/routing"
	"github.com/grafana/grafana/pkg/middleware"
	"github.com/grafana/grafana/pkg/models"
	ac "github.com/grafana/grafana/pkg/services/accesscontrol"
)

func NewAccessControlAPI(router routing.RouteRegister, service ac.Service) *AccessControlAPI {
	return &AccessControlAPI{
		RouteRegister: router,
		Service:       service,
	}
}

type AccessControlAPI struct {
	Service       ac.Service
	RouteRegister routing.RouteRegister
}

func (api *AccessControlAPI) RegisterAPIEndpoints() {
	// Users
	api.RouteRegister.Get("/api/access-control/user/permissions",
		middleware.ReqSignedIn, routing.Wrap(api.getUserPermissions))
}

// GET /api/access-control/user/permissions
func (api *AccessControlAPI) getUserPermissions(c *models.ReqContext) response.Response {
	reloadCache := c.QueryBool("reloadcache")
	permissions, err := api.Service.GetUserPermissions(c.Req.Context(),
		c.SignedInUser, ac.Options{ReloadCache: reloadCache})
	if err != nil {
		response.JSON(http.StatusInternalServerError, err)
	}

	if c.QueryBool("scoped") {
		return response.JSON(http.StatusOK, ac.GroupScopesByAction(permissions))
	}

	return response.JSON(http.StatusOK, ac.BuildPermissionsMap(permissions))
}
