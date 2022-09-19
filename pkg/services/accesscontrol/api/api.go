package api

import (
	"net/http"
	"strconv"

	"github.com/grafana/grafana/pkg/api/response"
	"github.com/grafana/grafana/pkg/api/routing"
	"github.com/grafana/grafana/pkg/middleware"
	"github.com/grafana/grafana/pkg/models"
	ac "github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/web"
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
		middleware.ReqSignedIn, routing.Wrap(api.getUsersPermissions))
	api.RouteRegister.Post("/api/access-control/user/:userID/evaluation",
		middleware.ReqSignedIn, routing.Wrap(api.evaluateUsersPermissions))
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

// POST /api/access-control/user/:userId/evaluation
func (api *AccessControlAPI) evaluateUsersPermissions(c *models.ReqContext) response.Response {
	var cmd ac.EvaluateUserPermissionCommand
	if err := web.Bind(c.Req, &cmd); err != nil {
		return response.JSON(http.StatusBadRequest, err)
	}

	if cmd.Action == "" && (cmd.Resource == "" || cmd.Attribute == "" || len(cmd.UIDs) == 0) {
		return response.JSON(http.StatusBadRequest, "provide an action or resources")
	}

	userID, err := strconv.ParseInt(web.Params(c.Req)[":userID"], 10, 64)
	if err != nil {
		return response.Error(http.StatusBadRequest, "user id is invalid", err)
	}
	cmd.UserID = userID
	cmd.OrgID = c.OrgID

	metadata, err := api.Service.EvaluateUserPermissions(c.Req.Context(), cmd)
	if err != nil {
		return response.Error(http.StatusInternalServerError, "could not evaluate user permissions", err)
	}

	return response.JSON(http.StatusOK, metadata)
}

// Action: users.permission:read
// Scope: users:id:<userID>
