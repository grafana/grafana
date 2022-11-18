package resourcepermissions

import (
	"errors"
	"fmt"
	"net/http"
	"os"
	"strconv"
	"strings"

	"go.opentelemetry.io/otel"

	"github.com/grafana/grafana/pkg/api/dtos"
	"github.com/grafana/grafana/pkg/api/response"
	"github.com/grafana/grafana/pkg/api/routing"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	contextmodel "github.com/grafana/grafana/pkg/services/contexthandler/model"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/services/team"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/web"
)

var tracer = otel.Tracer("github.com/grafana/grafana/pkg/accesscontrol/resourcepermissions")

type api struct {
	cfg         *setting.Cfg
	ac          accesscontrol.AccessControl
	router      routing.RouteRegister
	service     *Service
	permissions []string
}

func newApi(cfg *setting.Cfg, ac accesscontrol.AccessControl, router routing.RouteRegister, manager *Service) *api {
	permissions := make([]string, 0, len(manager.permissions))
	// reverse the permissions order for display
	for i := len(manager.permissions) - 1; i >= 0; i-- {
		permissions = append(permissions, manager.permissions[i])
	}
	return &api{cfg, ac, router, manager, permissions}
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
			resourceID := gotParams[":resourceID"]
			resourceID, err := resTranslator(c.Req.Context(), c.OrgID, resourceID)
			if err == nil {
				gotParams[":resourceID"] = resourceID
				web.SetURLParams(c.Req, gotParams)
			} else {
				c.JsonApiErr(http.StatusNotFound, "Not found", nil)
			}
		}
	}(a.service.options.ResourceTranslator)

	a.router.Group(fmt.Sprintf("/api/access-control/%s", a.service.options.Resource), func(r routing.RouteRegister) {
		actionRead := fmt.Sprintf("%s.permissions:read", a.service.options.Resource)
		actionWrite := fmt.Sprintf("%s.permissions:write", a.service.options.Resource)
		scope := accesscontrol.Scope(a.service.options.Resource, a.service.options.ResourceAttribute, accesscontrol.Parameter(":resourceID"))
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

	if !c.SignedInUser.IsGrafanaAdmin {
		dto = filterAdminUsers(dto)
	}

	//need to add a filter here
	return response.JSON(http.StatusOK, dto)
}

func filterAdminUsers(inDTOs []resourcePermissionDTO) []resourcePermissionDTO {

	outDTOs := []resourcePermissionDTO{}
	for _, dto := range inDTOs {
		if dto.BuiltInRole == "Admin" || isSoracomAdminUser(dto.UserLogin) {
			continue
		}
		outDTOs = append(outDTOs, dto)
	}
	return outDTOs
}

var adminUsers = os.Getenv("LAGOON_ADMIN_USERNAMES")

func isSoracomAdminUser(user string) bool {
	users := strings.Split(adminUsers, ",")

	for _, adminName := range users {
		if user == adminName {
			return true
		}
	}
	return false
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

	var cmd setPermissionCommand
	if err := web.Bind(c.Req, &cmd); err != nil {
		return response.Error(http.StatusBadRequest, "bad request data", err)
	}

	_, err = a.service.SetUserPermission(c.Req.Context(), c.SignedInUser.GetOrgID(), accesscontrol.User{ID: userID}, resourceID, cmd.Permission)
	if err != nil {
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

	var cmd setPermissionCommand
	if err := web.Bind(c.Req, &cmd); err != nil {
		return response.Error(http.StatusBadRequest, "bad request data", err)
	}

	_, err = a.service.SetTeamPermission(c.Req.Context(), c.SignedInUser.GetOrgID(), teamID, resourceID, cmd.Permission)
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

	cmd := setPermissionCommand{}
	if err := web.Bind(c.Req, &cmd); err != nil {
		return response.Error(http.StatusBadRequest, "bad request data", err)
	}

	_, err := a.service.SetBuiltInRolePermission(c.Req.Context(), c.SignedInUser.GetOrgID(), builtInRole, resourceID, cmd.Permission)
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

	resourceID := web.Params(c.Req)[":resourceID"]

	cmd := setPermissionsCommand{}
	if err := web.Bind(c.Req, &cmd); err != nil {
		return response.Error(http.StatusBadRequest, "Bad request data: "+err.Error(), err)
	}

	_, err := a.service.SetPermissions(ctx, c.SignedInUser.GetOrgID(), resourceID, cmd.Permissions...)
	if err != nil {
		return response.Err(err)
	}

	return response.Success("Permissions updated")
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
