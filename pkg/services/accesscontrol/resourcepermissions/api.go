package resourcepermissions

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"strconv"

	"github.com/open-feature/go-sdk/openfeature"
	"go.opentelemetry.io/otel"

	iamv0 "github.com/grafana/grafana/apps/iam/pkg/apis/iam/v0alpha1"
	"github.com/grafana/grafana/pkg/api/dtos"
	"github.com/grafana/grafana/pkg/api/response"
	"github.com/grafana/grafana/pkg/api/routing"
	grafanarest "github.com/grafana/grafana/pkg/apiserver/rest"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/metrics"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/apiserver"
	contextmodel "github.com/grafana/grafana/pkg/services/contexthandler/model"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/services/team"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/web"
)

var tracer = otel.Tracer("github.com/grafana/grafana/pkg/accesscontrol/resourcepermissions")

var ofClient = openfeature.NewDefaultClient()

type api struct {
	cfg                *setting.Cfg
	ac                 accesscontrol.AccessControl
	router             routing.RouteRegister
	service            *Service
	permissions        []string
	features           featuremgmt.FeatureToggles
	restConfigProvider apiserver.DirectRestConfigProvider
	logger             log.Logger
}

func newApi(cfg *setting.Cfg, ac accesscontrol.AccessControl, router routing.RouteRegister, manager *Service, features featuremgmt.FeatureToggles, restConfigProvider apiserver.DirectRestConfigProvider) *api {
	permissions := make([]string, 0, len(manager.permissions))
	// reverse the permissions order for display
	for i := len(manager.permissions) - 1; i >= 0; i-- {
		permissions = append(permissions, manager.permissions[i])
	}
	return &api{
		cfg:                cfg,
		ac:                 ac,
		router:             router,
		service:            manager,
		permissions:        permissions,
		features:           features,
		restConfigProvider: restConfigProvider,
		logger:             log.New("resource-permissions-api"),
	}
}

// shouldUseK8sAPIs returns true if both feature flags for K8s API redirect are enabled
func (a *api) shouldUseK8sAPIs(ctx context.Context) bool {
	return k8sResourcePermissionRedirectEnabled(ctx)
}

// k8sResourcePermissionRedirectEnabled reports whether both feature flags that
// gate the K8s resource-permission adapter are enabled for ctx. Both must be on:
//   - ...ResourcePermissionApis registers the K8s ResourcePermission /apis
//     endpoints (the destination must exist), and
//   - ...ResourcePermissionsRedirect redirects legacy permission traffic to them.
//
// It is the single source of truth for the redirect gate, shared by the runtime
// path (shouldUseK8sAPIs) and the startup validation (requiresAPIGroup in
// service.go) so the two cannot drift.
func k8sResourcePermissionRedirectEnabled(ctx context.Context) bool {
	return ofClient.Boolean(ctx, featuremgmt.FlagKubernetesAuthZResourcePermissionsRedirect, false, openfeature.TransactionContext(ctx)) &&
		ofClient.Boolean(ctx, featuremgmt.FlagKubernetesAuthzResourcePermissionApis, false, openfeature.TransactionContext(ctx))
}

// getFallbackStatus returns "fallback" if K8s redirect is enabled, "success" otherwise
func (a *api) getFallbackStatus(ctx context.Context) string {
	if a.shouldUseK8sAPIs(ctx) {
		return "fallback"
	}
	return "success"
}

// unifiedStorageIsAuthoritative returns true when unified storage is the authoritative
// backend (Mode4 or Mode5). In that case K8s redirect failures must not fall back to legacy.
func (a *api) unifiedStorageIsAuthoritative(groupResource string) bool {
	return a.cfg.UnifiedStorageConfig(groupResource).DualWriterMode > grafanarest.Mode3
}

func (a *api) registerEndpoints() {
	auth := accesscontrol.Middleware(a.ac)
	licenseMW := a.service.options.LicenseMW
	if licenseMW == nil {
		licenseMW = nopMiddleware
	}

	userUIDResolver := middlewareUserUIDResolver(a.service.userService, ":userID")
	teamUIDResolver := team.MiddlewareTeamUIDResolver(a.service.teamService, ":teamID")
	resourceResolver := func(resTranslator ResourceTranslator) web.Handler {
		return func(c *contextmodel.ReqContext) {
			// no-op
			if resTranslator == nil {
				return
			}

			gotParams := web.Params(c.Req)
			resourceUID := gotParams[":resourceID"]
			translatedID, err := resTranslator(c.Req.Context(), c.OrgID, resourceUID)
			if err == nil {
				gotParams[":resourceUID"] = resourceUID // preserve original UID for the K8s adapter
				gotParams[":resourceID"] = translatedID // overwrite with numeric ID for auth middleware
				web.SetURLParams(c.Req, gotParams)
			} else {
				c.JsonApiErr(http.StatusNotFound, "Not found", nil)
			}
		}
	}(a.service.options.ResourceTranslator)

	a.router.Group(fmt.Sprintf("/api/access-control/%s", a.service.options.Resource), func(r routing.RouteRegister) {
		actionRead := a.service.options.GetAction("read")
		actionWrite := a.service.options.GetAction("write")
		scope := a.service.options.GetScope(a.service.options.ResourceAttribute, accesscontrol.Parameter(":resourceID"))
		r.Get("/description", auth(accesscontrol.EvalPermission(actionRead)), routing.Wrap(a.getDescription))
		r.Get("/:resourceID", resourceResolver, auth(accesscontrol.EvalPermission(actionRead, scope)), routing.Wrap(a.getPermissions))
		r.Post("/:resourceID", resourceResolver, licenseMW, auth(accesscontrol.EvalPermission(actionWrite, scope)), routing.Wrap(a.setPermissions))
		if a.service.options.Assignments.Users {
			r.Post("/:resourceID/users/:userID", licenseMW, resourceResolver, userUIDResolver, auth(accesscontrol.EvalPermission(actionWrite, scope)), routing.Wrap(a.setUserPermission))
		}
		if a.service.options.Assignments.Teams {
			r.Post("/:resourceID/teams/:teamID", licenseMW, resourceResolver, teamUIDResolver, auth(accesscontrol.EvalPermission(actionWrite, scope)), routing.Wrap(a.setTeamPermission))
		}
		if a.service.options.Assignments.BuiltInRoles {
			r.Post("/:resourceID/builtInRoles/:builtInRole", resourceResolver, licenseMW, auth(accesscontrol.EvalPermission(actionWrite, scope)), routing.Wrap(a.setBuiltinRolePermission))
		}
	})
}

type Assignments struct {
	Users           bool `json:"users"`
	ServiceAccounts bool `json:"serviceAccounts"`
	Teams           bool `json:"teams"`
	BuiltInRoles    bool `json:"builtInRoles"`
}

// swagger:parameters getResourceDescription
type GetResourceDescriptionParams struct {
	// in:path
	// required:true
	Resource string `json:"resource"`
}

// swagger:response resourcePermissionsDescription
type DescriptionResponse struct {
	// in:body
	// required:true
	Body Description `json:"body"`
}

type Description struct {
	Assignments Assignments `json:"assignments"`
	Permissions []string    `json:"permissions"`
}

// swagger:route GET /access-control/{resource}/description access_control getResourceDescription
//
// Get a description of a resource's access control properties.
//
// Responses:
// 200: resourcePermissionsDescription
// 403: forbiddenError
// 500: internalServerError
func (a *api) getDescription(c *contextmodel.ReqContext) response.Response {
	return response.JSON(http.StatusOK, &Description{
		Permissions: a.permissions,
		Assignments: a.service.options.Assignments,
	})
}

type resourcePermissionDTO struct {
	ID               int64    `json:"id"`
	RoleName         string   `json:"roleName"`
	IsManaged        bool     `json:"isManaged"`
	IsInherited      bool     `json:"isInherited"`
	IsServiceAccount bool     `json:"isServiceAccount"`
	UserID           int64    `json:"userId,omitempty"`
	UserUID          string   `json:"userUid,omitempty"`
	UserLogin        string   `json:"userLogin,omitempty"`
	UserAvatarUrl    string   `json:"userAvatarUrl,omitempty"`
	Team             string   `json:"team,omitempty"`
	TeamID           int64    `json:"teamId,omitempty"`
	TeamUID          string   `json:"teamUid,omitempty"`
	TeamAvatarUrl    string   `json:"teamAvatarUrl,omitempty"`
	BuiltInRole      string   `json:"builtInRole,omitempty"`
	Actions          []string `json:"actions"`
	Permission       string   `json:"permission"`
}

// swagger:parameters getResourcePermissions
type GetResourcePermissionsParams struct {
	// in:path
	// required:true
	Resource string `json:"resource"`

	// in:path
	// required:true
	ResourceID string `json:"resourceID"`
}

// swagger:response getResourcePermissionsResponse
type getResourcePermissionsResponse []resourcePermissionDTO

// swagger:route GET /access-control/{resource}/{resourceID} access_control getResourcePermissions
//
// Get permissions for a resource.
//
// Responses:
// 200: getResourcePermissionsResponse
// 403: forbiddenError
// 404: notFoundError
// 500: internalServerError
func (a *api) getPermissions(c *contextmodel.ReqContext) response.Response {
	ctx, span := tracer.Start(c.Req.Context(), "accesscontrol.resourcepermissions.getPermissions")
	defer span.End()
	c.Req = c.Req.WithContext(ctx)

	resourceID := web.Params(c.Req)[":resourceID"]

	if a.service.options.RequestValidator != nil {
		if _, err := a.service.options.RequestValidator(c.Req, c.GetOrgID(), resourceID); err != nil {
			return response.Err(err)
		}
	}

	// Teams-specific redirect: read team permissions from Team.Spec.Members instead of
	// the generic resource permissions API. Falls back to legacy on failure.
	if a.service.options.Resource == "teams" && ofClient.Boolean(ctx, featuremgmt.FlagKubernetesTeamsRedirect, false, openfeature.TransactionContext(ctx)) {
		teamPermissions, err := a.getTeamPermissionsFromMembers(c, c.Namespace, resourceID)
		if err != nil {
			span.RecordError(err)
			if a.unifiedStorageIsAuthoritative(iamv0.TeamResourceInfo.GroupResource().String()) {
				metrics.MAccessResourcePermissionsBackend.WithLabelValues("k8s", "get", a.service.options.Resource, "error").Inc()
				return response.ErrOrFallback(http.StatusInternalServerError, "Failed to get team permissions from k8s API", err)
			}
			if errors.Is(err, ErrRestConfigNotAvailable) {
				a.logger.Debug("k8s API not available for team permissions via team members, falling back to legacy", "error", err, "resourceID", resourceID)
			} else {
				a.logger.Warn("Failed to get team permissions from team members k8s API, falling back to legacy", "error", err, "resourceID", resourceID)
			}
		} else {
			metrics.MAccessResourcePermissionsBackend.WithLabelValues("k8s", "get", a.service.options.Resource, "success").Inc()
			return response.JSON(http.StatusOK, teamPermissions)
		}
	}

	if a.service.options.Resource != "teams" && a.shouldUseK8sAPIs(ctx) {
		k8sPermissions, err := a.getResourcePermissionsFromK8s(c, c.Namespace, resourceID)
		if err != nil {
			span.RecordError(err)
			if a.unifiedStorageIsAuthoritative(iamv0.ResourcePermissionInfo.GroupResource().String()) {
				metrics.MAccessResourcePermissionsBackend.WithLabelValues("k8s", "get", a.service.options.Resource, "error").Inc()
				return response.ErrOrFallback(http.StatusInternalServerError, "Failed to get resource permissions from k8s API", err)
			}
			if errors.Is(err, ErrRestConfigNotAvailable) {
				a.logger.Debug("k8s API not available for resource permissions, falling back to legacy", "error", err, "resourceID", resourceID, "resource", a.service.options.Resource)
			} else {
				a.logger.Warn("Failed to get resource permissions from k8s API, falling back to legacy", "error", err, "resourceID", resourceID, "resource", a.service.options.Resource)
			}
		} else {
			metrics.MAccessResourcePermissionsBackend.WithLabelValues("k8s", "get", a.service.options.Resource, "success").Inc()
			return response.JSON(http.StatusOK, k8sPermissions)
		}
	}

	metrics.MAccessResourcePermissionsBackend.WithLabelValues("legacy", "get", a.service.options.Resource, a.getFallbackStatus(ctx)).Inc()
	permissions, err := a.service.GetPermissions(c.Req.Context(), c.SignedInUser, resourceID)
	if err != nil {
		return response.ErrOrFallback(http.StatusInternalServerError, "Failed to get permissions", err)
	}

	if a.service.options.Assignments.BuiltInRoles && !a.service.license.FeatureEnabled("accesscontrol.enforcement") {
		permissions = append(permissions, accesscontrol.ResourcePermission{
			Actions:     a.service.actions,
			Scope:       "*",
			BuiltInRole: string(org.RoleAdmin),
		})
	}

	dto := make(getResourcePermissionsResponse, 0, len(permissions))
	for _, p := range permissions {
		if permission := a.service.MapActions(p); permission != "" {
			teamAvatarUrl := ""
			if p.TeamID != 0 {
				teamAvatarUrl = dtos.GetGravatarUrlWithDefault(a.cfg, p.TeamEmail, p.Team)
			}

			dto = append(dto, resourcePermissionDTO{
				ID:               p.ID,
				RoleName:         p.RoleName,
				UserID:           p.UserID,
				UserUID:          p.UserUID,
				UserLogin:        p.UserLogin,
				UserAvatarUrl:    dtos.GetGravatarUrl(a.cfg, p.UserEmail),
				Team:             p.Team,
				TeamID:           p.TeamID,
				TeamUID:          p.TeamUID,
				TeamAvatarUrl:    teamAvatarUrl,
				BuiltInRole:      p.BuiltInRole,
				Actions:          p.Actions,
				Permission:       permission,
				IsManaged:        p.IsManaged,
				IsInherited:      p.IsInherited,
				IsServiceAccount: p.IsServiceAccount,
			})
		}
	}

	return response.JSON(http.StatusOK, dto)
}

type setPermissionCommand struct {
	Permission string `json:"permission"`
}

type setPermissionsCommand struct {
	Permissions []accesscontrol.SetResourcePermissionCommand `json:"permissions"`
}

// swagger:parameters setResourcePermissionsForUser
type SetResourcePermissionsForUserParams struct {
	// in:path
	// required:true
	Resource string `json:"resource"`

	// in:path
	// required:true
	ResourceID string `json:"resourceID"`

	// in:path
	// required:true
	UserID int64 `json:"userID"`

	// in:body
	// required:true
	Body setPermissionCommand
}

// swagger:route POST /access-control/{resource}/{resourceID}/users/{userID} access_control setResourcePermissionsForUser
//
// Set resource permissions for a user.
//
// Assigns permissions for a resource by a given type (`:resource`) and `:resourceID` to a user or a service account.
// Allowed resources are `datasources`, `teams`, `dashboards`, `folders`, and `serviceaccounts`.
// Refer to the `/access-control/{resource}/description` endpoint for allowed Permissions.
//
// Responses:
// 200: okResponse
// 400: badRequestError
// 403: forbiddenError
// 404: notFoundError
// 500: internalServerError
func (a *api) setUserPermission(c *contextmodel.ReqContext) response.Response {
	ctx, span := tracer.Start(c.Req.Context(), "accesscontrol.resourcepermissions.setUserPermission")
	defer span.End()
	c.Req = c.Req.WithContext(ctx)

	userID, err := strconv.ParseInt(web.Params(c.Req)[":userID"], 10, 64)
	if err != nil {
		return response.Err(ErrInvalidParam.Build(ErrInvalidParamData("userID", err)))
	}
	resourceID := web.Params(c.Req)[":resourceID"]

	if a.service.options.RequestValidator != nil {
		enrichedCtx, err := a.service.options.RequestValidator(c.Req, c.GetOrgID(), resourceID)
		if err != nil {
			return response.Err(err)
		}
		if enrichedCtx != nil {
			c.Req = c.Req.WithContext(enrichedCtx)
		}
	}

	resp := a.validateTeamResource(c, resourceID)
	if resp != nil {
		return resp
	}

	var cmd setPermissionCommand
	if err := web.Bind(c.Req, &cmd); err != nil {
		return response.Error(http.StatusBadRequest, "bad request data", err)
	}

	// teamsRedirectRemovedMember records that the K8s teams redirect below actually removed an
	// existing member. In dual-write modes (Mode1-3) legacy is the primary target of that write,
	// so the legacy fallback further down then finds the row already gone. A no-op redirect (the
	// member wasn't there) leaves this false, so a genuinely-absent member still returns 404.
	teamsRedirectRemovedMember := false

	// Teams-specific redirect: write the membership to Team.Spec.Members via the K8s API.
	if a.service.options.Resource == "teams" && ofClient.Boolean(ctx, featuremgmt.FlagKubernetesTeamsRedirect, false, openfeature.TransactionContext(ctx)) {
		removed, err := a.setUserPermissionInTeamMembers(c, c.Namespace, resourceID, userID, cmd.Permission)
		if errors.Is(err, ErrExternalTeamMember) {
			return response.Err(err)
		}
		if err != nil {
			span.RecordError(err)
			a.logger.Warn("Failed to set user permission via team members k8s API", "error", err, "resourceID", resourceID)
		} else {
			teamsRedirectRemovedMember = removed
			metrics.MAccessResourcePermissionsBackend.WithLabelValues("k8s", "set_user", a.service.options.Resource, "success").Inc()
		}

		// In Mode4/5 unified storage is authoritative: return the K8s result and do not fall
		// back to legacy (which would fail for identities that exist only in unified storage).
		// In Mode0-3 we dual-write, so continue to the legacy path below.
		if a.unifiedStorageIsAuthoritative(iamv0.TeamResourceInfo.GroupResource().String()) {
			if err != nil {
				metrics.MAccessResourcePermissionsBackend.WithLabelValues("k8s", "set_user", a.service.options.Resource, "error").Inc()
				return response.Err(err)
			}
			return permissionSetResponse(cmd)
		}
	}

	if a.service.options.Resource != "teams" && a.shouldUseK8sAPIs(ctx) {
		err := a.setUserPermissionToK8s(c, c.Namespace, resourceID, userID, cmd.Permission)
		if err != nil {
			span.RecordError(err)
			if a.unifiedStorageIsAuthoritative(iamv0.ResourcePermissionInfo.GroupResource().String()) {
				metrics.MAccessResourcePermissionsBackend.WithLabelValues("k8s", "set_user", a.service.options.Resource, "error").Inc()
				return response.ErrOrFallback(http.StatusInternalServerError, "Failed to set user permission in k8s API", err)
			}
			if errors.Is(err, ErrRestConfigNotAvailable) {
				a.logger.Debug("k8s API not available for resource permissions, falling back to legacy", "error", err, "resourceID", resourceID, "resource", a.service.options.Resource)
			} else {
				a.logger.Warn("Failed to set user permission in k8s API, falling back to legacy", "error", err, "resourceID", resourceID, "resource", a.service.options.Resource)
			}
		} else {
			metrics.MAccessResourcePermissionsBackend.WithLabelValues("k8s", "set_user", a.service.options.Resource, "success").Inc()
			return permissionSetResponse(cmd)
		}
	}

	metrics.MAccessResourcePermissionsBackend.WithLabelValues("legacy", "set_user", a.service.options.Resource, a.getFallbackStatus(ctx)).Inc()
	_, err = a.service.SetUserPermission(c.Req.Context(), c.GetOrgID(), accesscontrol.User{ID: userID}, resourceID, cmd.Permission)
	if err != nil {
		// The teams redirect above already removed the member (and, in dual-write modes, the
		// legacy team_member row), so this legacy removal finds nothing.
		if teamsRedirectRemovedMember && errors.Is(err, team.ErrTeamMemberNotFound) {
			return permissionSetResponse(cmd)
		}
		if errors.Is(err, team.ErrTeamMemberNotFound) {
			return response.Error(http.StatusNotFound, "Team member not found", nil)
		}
		return response.Err(err)
	}

	return permissionSetResponse(cmd)
}

// swagger:parameters setResourcePermissionsForTeam
type SetResourcePermissionsForTeamParams struct {
	// in:path
	// required:true
	Resource string `json:"resource"`

	// in:path
	// required:true
	ResourceID string `json:"resourceID"`

	// in:path
	// required:true
	TeamID int64 `json:"teamID"`

	// in:body
	// required:true
	Body setPermissionCommand
}

// swagger:route POST /access-control/{resource}/{resourceID}/teams/{teamID} access_control setResourcePermissionsForTeam
//
// Set resource permissions for a team.
//
// Assigns permissions for a resource by a given type (`:resource`) and `:resourceID` to a team.
// Allowed resources are `datasources`, `teams`, `dashboards`, `folders`, and `serviceaccounts`.
// Refer to the `/access-control/{resource}/description` endpoint for allowed Permissions.
//
// Responses:
// 200: okResponse
// 400: badRequestError
// 403: forbiddenError
// 404: notFoundError
// 500: internalServerError
func (a *api) setTeamPermission(c *contextmodel.ReqContext) response.Response {
	ctx, span := tracer.Start(c.Req.Context(), "accesscontrol.resourcepermissions.setTeamPermission")
	defer span.End()
	c.Req = c.Req.WithContext(ctx)

	teamID, err := strconv.ParseInt(web.Params(c.Req)[":teamID"], 10, 64)
	if err != nil {
		return response.Err(ErrInvalidParam.Build(ErrInvalidParamData("teamID", err)))
	}
	resourceID := web.Params(c.Req)[":resourceID"]

	if a.service.options.RequestValidator != nil {
		enrichedCtx, err := a.service.options.RequestValidator(c.Req, c.GetOrgID(), resourceID)
		if err != nil {
			return response.Err(err)
		}
		if enrichedCtx != nil {
			c.Req = c.Req.WithContext(enrichedCtx)
		}
	}

	var cmd setPermissionCommand
	if err := web.Bind(c.Req, &cmd); err != nil {
		return response.Error(http.StatusBadRequest, "bad request data", err)
	}

	if a.shouldUseK8sAPIs(ctx) {
		err := a.setTeamPermissionToK8s(c, c.Namespace, resourceID, teamID, cmd.Permission)
		if err != nil {
			span.RecordError(err)
			if a.unifiedStorageIsAuthoritative(iamv0.ResourcePermissionInfo.GroupResource().String()) {
				metrics.MAccessResourcePermissionsBackend.WithLabelValues("k8s", "set_team", a.service.options.Resource, "error").Inc()
				return response.ErrOrFallback(http.StatusInternalServerError, "Failed to set team permission in k8s API", err)
			}
			if errors.Is(err, ErrRestConfigNotAvailable) {
				a.logger.Debug("k8s API not available for resource permissions, falling back to legacy", "error", err, "resourceID", resourceID, "resource", a.service.options.Resource)
			} else {
				a.logger.Warn("Failed to set team permission in k8s API, falling back to legacy", "error", err, "resourceID", resourceID, "resource", a.service.options.Resource)
			}
		} else {
			metrics.MAccessResourcePermissionsBackend.WithLabelValues("k8s", "set_team", a.service.options.Resource, "success").Inc()
			return permissionSetResponse(cmd)
		}
	}

	metrics.MAccessResourcePermissionsBackend.WithLabelValues("legacy", "set_team", a.service.options.Resource, a.getFallbackStatus(ctx)).Inc()
	_, err = a.service.SetTeamPermission(c.Req.Context(), c.GetOrgID(), teamID, resourceID, cmd.Permission)
	if err != nil {
		return response.Err(err)
	}

	return permissionSetResponse(cmd)
}

// swagger:parameters setResourcePermissionsForBuiltInRole
type SetResourcePermissionsForBuiltInRoleParams struct {
	// in:path
	// required:true
	Resource string `json:"resource"`

	// in:path
	// required:true
	ResourceID string `json:"resourceID"`

	// in:path
	// required:true
	BuiltInRole string `json:"builtInRole"`

	// in:body
	// required:true
	Body setPermissionCommand
}

// swagger:route POST /access-control/{resource}/{resourceID}/builtInRoles/{builtInRole} access_control setResourcePermissionsForBuiltInRole
//
// Set resource permissions for a built-in role.
//
// Assigns permissions for a resource by a given type (`:resource`) and `:resourceID` to a built-in role.
// Allowed resources are `datasources`, `teams`, `dashboards`, `folders`, and `serviceaccounts`.
// Refer to the `/access-control/{resource}/description` endpoint for allowed Permissions.
//
// Responses:
// 200: okResponse
// 400: badRequestError
// 403: forbiddenError
// 404: notFoundError
// 500: internalServerError
func (a *api) setBuiltinRolePermission(c *contextmodel.ReqContext) response.Response {
	ctx, span := tracer.Start(c.Req.Context(), "accesscontrol.resourcepermissions.setBuiltinRolePermission")
	defer span.End()
	c.Req = c.Req.WithContext(ctx)

	builtInRole := web.Params(c.Req)[":builtInRole"]
	resourceID := web.Params(c.Req)[":resourceID"]

	if a.service.options.RequestValidator != nil {
		enrichedCtx, err := a.service.options.RequestValidator(c.Req, c.GetOrgID(), resourceID)
		if err != nil {
			return response.Err(err)
		}
		if enrichedCtx != nil {
			c.Req = c.Req.WithContext(enrichedCtx)
		}
	}

	cmd := setPermissionCommand{}
	if err := web.Bind(c.Req, &cmd); err != nil {
		return response.Error(http.StatusBadRequest, "bad request data", err)
	}

	if a.shouldUseK8sAPIs(ctx) {
		err := a.setBuiltInRolePermissionToK8s(c, c.Namespace, resourceID, builtInRole, cmd.Permission)
		if err != nil {
			span.RecordError(err)
			if a.unifiedStorageIsAuthoritative(iamv0.ResourcePermissionInfo.GroupResource().String()) {
				metrics.MAccessResourcePermissionsBackend.WithLabelValues("k8s", "set_builtin_role", a.service.options.Resource, "error").Inc()
				return response.ErrOrFallback(http.StatusInternalServerError, "Failed to set built-in role permission in k8s API", err)
			}
			if errors.Is(err, ErrRestConfigNotAvailable) {
				a.logger.Debug("k8s API not available for resource permissions, falling back to legacy", "error", err, "resourceID", resourceID, "resource", a.service.options.Resource)
			} else {
				a.logger.Warn("Failed to set built-in role permission in k8s API, falling back to legacy", "error", err, "resourceID", resourceID, "resource", a.service.options.Resource)
			}
		} else {
			metrics.MAccessResourcePermissionsBackend.WithLabelValues("k8s", "set_builtin_role", a.service.options.Resource, "success").Inc()
			return permissionSetResponse(cmd)
		}
	}

	metrics.MAccessResourcePermissionsBackend.WithLabelValues("legacy", "set_builtin_role", a.service.options.Resource, a.getFallbackStatus(ctx)).Inc()
	_, err := a.service.SetBuiltInRolePermission(c.Req.Context(), c.GetOrgID(), builtInRole, resourceID, cmd.Permission)
	if err != nil {
		return response.Err(err)
	}

	return permissionSetResponse(cmd)
}

// swagger:parameters setResourcePermissions
type SetResourcePermissionsParams struct {
	// in:path
	// required:true
	Resource string `json:"resource"`

	// in:path
	// required:true
	ResourceID string `json:"resourceID"`

	// in:body
	// required:true
	Body setPermissionsCommand
}

// swagger:route POST /access-control/{resource}/{resourceID} access_control setResourcePermissions
//
// Set resource permissions.
//
// Assigns permissions for a resource by a given type (`:resource`) and `:resourceID` to one or many
// assignment types. Allowed resources are `datasources`, `teams`, `dashboards`, `folders`, and `serviceaccounts`.
// Refer to the `/access-control/{resource}/description` endpoint for allowed Permissions.
//
// Responses:
// 200: okResponse
// 400: badRequestError
// 403: forbiddenError
// 404: notFoundError
// 500: internalServerError
func (a *api) setPermissions(c *contextmodel.ReqContext) response.Response {
	ctx, span := tracer.Start(c.Req.Context(), "accesscontrol.resourcepermissions.setPermissions")
	defer span.End()
	c.Req = c.Req.WithContext(ctx)

	resourceID := web.Params(c.Req)[":resourceID"]

	if a.service.options.RequestValidator != nil {
		enrichedCtx, err := a.service.options.RequestValidator(c.Req, c.GetOrgID(), resourceID)
		if err != nil {
			return response.Err(err)
		}
		if enrichedCtx != nil {
			c.Req = c.Req.WithContext(enrichedCtx)
		}
	}

	cmd := setPermissionsCommand{}
	if err := web.Bind(c.Req, &cmd); err != nil {
		return response.Error(http.StatusBadRequest, "Bad request data: "+err.Error(), err)
	}

	if a.shouldUseK8sAPIs(ctx) {
		err := a.setResourcePermissionsToK8s(c, c.Namespace, resourceID, cmd.Permissions)
		if err != nil {
			span.RecordError(err)
			if a.unifiedStorageIsAuthoritative(iamv0.ResourcePermissionInfo.GroupResource().String()) {
				metrics.MAccessResourcePermissionsBackend.WithLabelValues("k8s", "set_bulk", a.service.options.Resource, "error").Inc()
				return response.ErrOrFallback(http.StatusInternalServerError, "Failed to set resource permissions in k8s API", err)
			}
			if errors.Is(err, ErrRestConfigNotAvailable) {
				a.logger.Debug("k8s API not available for resource permissions, falling back to legacy", "error", err, "resourceID", resourceID, "resource", a.service.options.Resource)
			} else {
				a.logger.Warn("Failed to set resource permissions in k8s API, falling back to legacy", "error", err, "resourceID", resourceID, "resource", a.service.options.Resource)
			}
		} else {
			metrics.MAccessResourcePermissionsBackend.WithLabelValues("k8s", "set_bulk", a.service.options.Resource, "success").Inc()
			return response.Success("Permissions updated")
		}
	}

	metrics.MAccessResourcePermissionsBackend.WithLabelValues("legacy", "set_bulk", a.service.options.Resource, a.getFallbackStatus(ctx)).Inc()
	_, err := a.service.SetPermissions(c.Req.Context(), c.GetOrgID(), resourceID, cmd.Permissions...)
	if err != nil {
		return response.Err(err)
	}

	return response.Success("Permissions updated")
}

func (a *api) validateTeamResource(c *contextmodel.ReqContext, resourceID string) response.Response {
	if a.service.options.Resource != "teams" {
		return nil
	}

	teamID, err := strconv.ParseInt(resourceID, 10, 64)
	if err != nil {
		return response.Error(http.StatusBadRequest, "Invalid ResourceID", err)
	}

	existingTeam, err := a.service.teamService.GetTeamByID(c.Req.Context(), &team.GetTeamByIDQuery{
		OrgID:        c.GetOrgID(),
		ID:           teamID,
		SignedInUser: c.SignedInUser,
	})
	if err != nil {
		if errors.Is(err, team.ErrTeamNotFound) {
			return response.Error(http.StatusNotFound, "Team not found", err)
		}

		return response.Error(http.StatusInternalServerError, "Failed to get Team", err)
	}

	if existingTeam.IsProvisioned {
		return response.Error(http.StatusBadRequest, "Team permissions cannot be updated for provisioned teams", nil)
	}

	return nil
}

func permissionSetResponse(cmd setPermissionCommand) response.Response {
	message := "Permission updated"
	if cmd.Permission == "" {
		message = "Permission removed"
	}
	return response.Success(message)
}

// middlewareUserUIDResolver resolves the user UID to ID and sets the ID in the URL params.
func middlewareUserUIDResolver(userService user.Service, paramName string) web.Handler {
	handler := user.UIDToIDHandler(userService)

	return func(c *contextmodel.ReqContext) {
		userID := web.Params(c.Req)[paramName]
		id, err := handler(c.Req.Context(), userID)
		if err == nil {
			gotParams := web.Params(c.Req)
			gotParams[paramName] = id
			web.SetURLParams(c.Req, gotParams)
		} else {
			if errors.Is(err, user.ErrUserNotFound) {
				c.JsonApiErr(http.StatusNotFound, "User not found", nil)
			} else {
				c.JsonApiErr(http.StatusInternalServerError, "Failed to resolve user", err)
			}
		}
	}
}
