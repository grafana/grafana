package api

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"strconv"

	"github.com/grafana/authlib/claims"
	"go.opentelemetry.io/otel"

	"github.com/grafana/grafana/pkg/api/response"
	"github.com/grafana/grafana/pkg/api/routing"
	"github.com/grafana/grafana/pkg/middleware"
	"github.com/grafana/grafana/pkg/middleware/requestmeta"
	ac "github.com/grafana/grafana/pkg/services/accesscontrol"
	contextmodel "github.com/grafana/grafana/pkg/services/contexthandler/model"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/user"
)

var tracer = otel.Tracer("github.com/grafana/grafana/pkg/services/accesscontrol/api")

func NewAccessControlAPI(router routing.RouteRegister, accesscontrol ac.AccessControl, service ac.Service,
	userSvc user.Service, features featuremgmt.FeatureToggles) *AccessControlAPI {
	return &AccessControlAPI{
		RouteRegister: router,
		Service:       service,
		userSvc:       userSvc,
		AccessControl: accesscontrol,
		features:      features,
	}
}

type AccessControlAPI struct {
	Service       ac.Service
	AccessControl ac.AccessControl
	RouteRegister routing.RouteRegister
	userSvc       user.Service
	features      featuremgmt.FeatureToggles
}

func (api *AccessControlAPI) RegisterAPIEndpoints() {
	authorize := ac.Middleware(api.AccessControl)
	// Users
	api.RouteRegister.Group("/api/access-control", func(rr routing.RouteRegister) {
		rr.Get("/user/actions", middleware.ReqSignedIn, routing.Wrap(api.getUserActions))
		rr.Get("/user/permissions", middleware.ReqSignedIn, routing.Wrap(api.getUserPermissions))
		if api.features.IsEnabledGlobally(featuremgmt.FlagAccessControlOnCall) {
			rr.Get("/users/permissions/search", authorize(ac.EvalPermission(ac.ActionUsersPermissionsRead)), routing.Wrap(api.searchUsersPermissions))
		}
	}, requestmeta.SetOwner(requestmeta.TeamAuth))
}

// GET /api/access-control/user/actions
func (api *AccessControlAPI) getUserActions(c *contextmodel.ReqContext) response.Response {
	ctx, span := tracer.Start(c.Req.Context(), "accesscontrol.api.getUserActions")
	defer span.End()

	reloadCache := c.QueryBool("reloadcache")
	permissions, err := api.Service.GetUserPermissions(ctx, c.SignedInUser, ac.Options{ReloadCache: reloadCache})
	if err != nil {
		return response.JSON(http.StatusInternalServerError, err)
	}

	return response.JSON(http.StatusOK, ac.BuildPermissionsMap(permissions))
}

// GET /api/access-control/user/permissions
func (api *AccessControlAPI) getUserPermissions(c *contextmodel.ReqContext) response.Response {
	ctx, span := tracer.Start(c.Req.Context(), "accesscontrol.api.getUserPermissions")
	defer span.End()

	reloadCache := c.QueryBool("reloadcache")
	permissions, err := api.Service.GetUserPermissions(ctx, c.SignedInUser, ac.Options{ReloadCache: reloadCache})
	if err != nil {
		return response.JSON(http.StatusInternalServerError, err)
	}

	return response.JSON(http.StatusOK, ac.GroupScopesByActionContext(ctx, permissions))
}

// GET /api/access-control/users/permissions/search
func (api *AccessControlAPI) searchUsersPermissions(c *contextmodel.ReqContext) response.Response {
	ctx, span := tracer.Start(c.Req.Context(), "accesscontrol.api.searchUsersPermissions")
	defer span.End()

	searchOptions := ac.SearchOptions{
		ActionPrefix: c.Query("actionPrefix"),
		Action:       c.Query("action"),
		Scope:        c.Query("scope"),
	}

	// namespacedId is the typed identifier of an identity
	// it is specified using user/service account IDs or UIDs (ex: user:3, service-account:4, user:adisufjf93e9sd)
	if typedID := c.Query("namespacedId"); typedID != "" {
		userID, err := api.ComputeUserID(ctx, c.Query("namespacedId"))
		if err != nil {
			if errors.Is(err, user.ErrUserNotFound) {
				return response.JSON(http.StatusBadRequest, err.Error())
			}
			return response.JSON(http.StatusInternalServerError, err.Error())
		}

		searchOptions.UserID = userID
	}

	// Validate inputs
	if searchOptions.ActionPrefix != "" && searchOptions.Action != "" {
		return response.JSON(http.StatusBadRequest, "'action' and 'actionPrefix' are mutually exclusive")
	}

	if searchOptions.UserID <= 0 && searchOptions.ActionPrefix == "" && searchOptions.Action == "" {
		return response.JSON(http.StatusBadRequest, "at least one search option must be provided")
	}

	// Compute metadata
	permissions, err := api.Service.SearchUsersPermissions(ctx, c.SignedInUser, searchOptions)
	if err != nil {
		return response.Error(http.StatusInternalServerError, "could not get org user permissions", err)
	}

	permsByAction := map[int64]map[string][]string{}
	for userID, userPerms := range permissions {
		permsByAction[userID] = ac.Reduce(userPerms)
	}

	return response.JSON(http.StatusOK, permsByAction)
}

func (api *AccessControlAPI) ComputeUserID(ctx context.Context, typedID string) (int64, error) {
	if typedID == "" {
		return -1, nil
	}

	typ, idStr, err := claims.ParseTypeID(typedID)
	if err != nil {
		return 0, err
	}

	if !claims.IsIdentityType(typ, claims.TypeUser, claims.TypeServiceAccount) {
		return 0, fmt.Errorf("invalid type: %s", typ)
	}

	id, err := strconv.ParseInt(idStr, 10, 64)
	if err == nil {
		return id, nil
	}

	user, err := api.userSvc.GetByUID(ctx, &user.GetUserByUIDQuery{UID: idStr})
	if err != nil {
		return 0, err
	}

	return user.ID, nil
}
