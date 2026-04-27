package api

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"strconv"

	"go.opentelemetry.io/otel"

	claims "github.com/grafana/authlib/types"

	"github.com/grafana/grafana/pkg/api/response"
	"github.com/grafana/grafana/pkg/api/routing"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/middleware"
	"github.com/grafana/grafana/pkg/middleware/requestmeta"
	ac "github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/authz/zanzana"
	contextmodel "github.com/grafana/grafana/pkg/services/contexthandler/model"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/user"
)

var tracer = otel.Tracer("github.com/grafana/grafana/pkg/services/accesscontrol/api")
var logger = log.New("accesscontrol.api")

func NewAccessControlAPI(
	router routing.RouteRegister,
	accesscontrol ac.AccessControl,
	service ac.Service,
	userSvc user.Service,
	features featuremgmt.FeatureToggles,
	zanzanaClient zanzana.Client,
) *AccessControlAPI {
	api := &AccessControlAPI{
		RouteRegister: router,
		Service:       service,
		userSvc:       userSvc,
		AccessControl: accesscontrol,
	}

	//nolint:staticcheck // not yet migrated to OpenFeature
	if features != nil && features.IsEnabledGlobally(featuremgmt.FlagZanzanaMergeUserPermissions) && zanzanaClient != nil {
		api.zanzanaResolver = newZanzanaPermissionResolver(zanzanaClient, userSvc)
	}

	return api
}

type AccessControlAPI struct {
	Service         ac.Service
	AccessControl   ac.AccessControl
	RouteRegister   routing.RouteRegister
	userSvc         user.Service
	zanzanaResolver *zanzanaPermissionResolver
}

func (api *AccessControlAPI) RegisterAPIEndpoints() {
	authorize := ac.Middleware(api.AccessControl)
	// Users
	api.RouteRegister.Group("/api/access-control", func(rr routing.RouteRegister) {
		rr.Get("/user/actions", middleware.ReqSignedIn, routing.Wrap(api.getUserActions))
		rr.Get("/user/permissions", middleware.ReqSignedIn, routing.Wrap(api.getUserPermissions))
		rr.Get("/users/permissions/search", authorize(ac.EvalPermission(ac.ActionUsersPermissionsRead)), routing.Wrap(api.searchUsersPermissions))
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

	if api.zanzanaResolver != nil {
		zanzanaPerms, zErr := api.zanzanaResolver.resolveCurrentUserPermissions(ctx, c.SignedInUser)
		if zErr == nil {
			permissions = mergeUserPermissions(permissions, zanzanaPerms)
		} else {
			logger.Warn("could not get zanzana user actions, using legacy only", "error", zErr)
		}
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

	if api.zanzanaResolver != nil {
		zanzanaPerms, zErr := api.zanzanaResolver.resolveCurrentUserPermissions(ctx, c.SignedInUser)
		if zErr == nil {
			permissions = mergeUserPermissions(permissions, zanzanaPerms)
		} else {
			logger.Warn("could not get zanzana user permissions, using legacy only", "error", zErr)
		}
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

	logger.Debug("users permissions search request",
		"orgId", c.GetOrgID(),
		"callerUserId", c.UserID,
		"namespacedId", c.Query("namespacedId"),
		"userId", searchOptions.UserID,
		"action", searchOptions.Action,
		"actionPrefix", searchOptions.ActionPrefix,
		"scope", searchOptions.Scope,
	)

	// Always query legacy as the baseline — not all permissions are migrated to Zanzana yet.
	permissions, err := api.Service.SearchUsersPermissions(ctx, c.SignedInUser, searchOptions)
	if err != nil {
		return response.Error(http.StatusInternalServerError, "could not get org user permissions", err)
	}

	// When Zanzana is enabled, merge in its permissions so that migrated
	// resources are authoritative in Zanzana while non-migrated ones still
	// come from legacy.
	if api.zanzanaResolver != nil {
		zanzanaPerms, zanzanaErr := api.zanzanaResolver.searchUsersPermissions(ctx, c.SignedInUser, c.GetOrgID(), searchOptions)
		if zanzanaErr == nil {
			permissions = mergePermissions(permissions, zanzanaPerms)
		} else {
			logger.Warn("could not get zanzana user permissions, using legacy only", "error", zanzanaErr)
		}
	}

	permsByAction := map[int64]map[string][]string{}
	for userID, userPerms := range permissions {
		permsByAction[userID] = ac.Reduce(userPerms)
	}

	return response.JSON(http.StatusOK, permsByAction)
}

// mergePermissions unions permissions from two sources, deduplicating by action+scope per user.
func mergePermissions(a, b map[int64][]ac.Permission) map[int64][]ac.Permission {
	result := make(map[int64][]ac.Permission, len(a))
	for userID, perms := range a {
		result[userID] = append([]ac.Permission(nil), perms...)
	}

	for userID, perms := range b {
		existing := result[userID]
		if len(existing) == 0 {
			result[userID] = perms
			continue
		}

		seen := make(map[string]struct{}, len(existing))
		for _, p := range existing {
			seen[p.Action+"|"+p.Scope] = struct{}{}
		}
		for _, p := range perms {
			key := p.Action + "|" + p.Scope
			if _, ok := seen[key]; !ok {
				existing = append(existing, p)
				seen[key] = struct{}{}
			}
		}
		result[userID] = existing
	}

	return result
}

// mergeUserPermissions unions permissions from legacy RBAC and Zanzana for a single user,
// deduplicating by action+scope.
func mergeUserPermissions(legacy, zanzana []ac.Permission) []ac.Permission {
	seen := make(map[string]struct{}, len(legacy))
	for _, p := range legacy {
		seen[p.Action+"|"+p.Scope] = struct{}{}
	}
	for _, p := range zanzana {
		key := p.Action + "|" + p.Scope
		if _, ok := seen[key]; !ok {
			legacy = append(legacy, p)
			seen[key] = struct{}{}
		}
	}
	return legacy
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
