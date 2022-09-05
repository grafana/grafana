package resourcepermissions

import (
	"fmt"
	"net/http"
	"strconv"

	"github.com/grafana/grafana/pkg/api/dtos"
	"github.com/grafana/grafana/pkg/api/response"
	"github.com/grafana/grafana/pkg/api/routing"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/web"
)

type api struct {
	ac          accesscontrol.AccessControl
	router      routing.RouteRegister
	service     *Service
	permissions []string
}

func newApi(ac accesscontrol.AccessControl, router routing.RouteRegister, manager *Service) *api {
	permissions := make([]string, 0, len(manager.permissions))
	// reverse the permissions order for display
	for i := len(manager.permissions) - 1; i >= 0; i-- {
		permissions = append(permissions, manager.permissions[i])
	}
	return &api{ac, router, manager, permissions}
}

func (a *api) registerEndpoints() {
	auth := accesscontrol.Middleware(a.ac)
	disable := disableMiddleware(a.ac.IsDisabled())

	a.router.Group(fmt.Sprintf("/api/access-control/%s", a.service.options.Resource), func(r routing.RouteRegister) {
		actionRead := fmt.Sprintf("%s.permissions:read", a.service.options.Resource)
		actionWrite := fmt.Sprintf("%s.permissions:write", a.service.options.Resource)
		scope := accesscontrol.Scope(a.service.options.Resource, a.service.options.ResourceAttribute, accesscontrol.Parameter(":resourceID"))
		r.Get("/description", auth(disable, accesscontrol.EvalPermission(actionRead)), routing.Wrap(a.getDescription))
		r.Get("/:resourceID", auth(disable, accesscontrol.EvalPermission(actionRead, scope)), routing.Wrap(a.getPermissions))
		if a.service.options.Assignments.Users {
			r.Post("/:resourceID/users/:userID", auth(disable, accesscontrol.EvalPermission(actionWrite, scope)), routing.Wrap(a.setUserPermission))
		}
		if a.service.options.Assignments.Teams {
			r.Post("/:resourceID/teams/:teamID", auth(disable, accesscontrol.EvalPermission(actionWrite, scope)), routing.Wrap(a.setTeamPermission))
		}
		if a.service.options.Assignments.BuiltInRoles {
			r.Post("/:resourceID/builtInRoles/:builtInRole", auth(disable, accesscontrol.EvalPermission(actionWrite, scope)), routing.Wrap(a.setBuiltinRolePermission))
		}
	})
}

type Assignments struct {
	Users        bool `json:"users"`
	Teams        bool `json:"teams"`
	BuiltInRoles bool `json:"builtInRoles"`
}

type Description struct {
	Assignments Assignments `json:"assignments"`
	Permissions []string    `json:"permissions"`
}

func (a *api) getDescription(c *models.ReqContext) response.Response {
	return response.JSON(http.StatusOK, &Description{
		Permissions: a.permissions,
		Assignments: a.service.options.Assignments,
	})
}

type resourcePermissionDTO struct {
	ID            int64    `json:"id"`
	RoleName      string   `json:"roleName"`
	IsManaged     bool     `json:"isManaged"`
	IsInherited   bool     `json:"isInherited"`
	UserID        int64    `json:"userId,omitempty"`
	UserLogin     string   `json:"userLogin,omitempty"`
	UserAvatarUrl string   `json:"userAvatarUrl,omitempty"`
	Team          string   `json:"team,omitempty"`
	TeamID        int64    `json:"teamId,omitempty"`
	TeamAvatarUrl string   `json:"teamAvatarUrl,omitempty"`
	BuiltInRole   string   `json:"builtInRole,omitempty"`
	Actions       []string `json:"actions"`
	Permission    string   `json:"permission"`
}

func (a *api) getPermissions(c *models.ReqContext) response.Response {
	resourceID := web.Params(c.Req)[":resourceID"]

	permissions, err := a.service.GetPermissions(c.Req.Context(), c.SignedInUser, resourceID)
	if err != nil {
		return response.Error(http.StatusInternalServerError, "failed to get permissions", err)
	}

	if a.service.options.Assignments.BuiltInRoles && !a.service.license.FeatureEnabled("accesscontrol.enforcement") {
		permissions = append(permissions, accesscontrol.ResourcePermission{
			Actions:     a.service.actions,
			Scope:       "*",
			BuiltInRole: string(org.RoleAdmin),
		})
	}

	dto := make([]resourcePermissionDTO, 0, len(permissions))
	for _, p := range permissions {
		if permission := a.service.MapActions(p); permission != "" {
			teamAvatarUrl := ""
			if p.TeamId != 0 {
				teamAvatarUrl = dtos.GetGravatarUrlWithDefault(p.TeamEmail, p.Team)
			}

			dto = append(dto, resourcePermissionDTO{
				ID:            p.ID,
				RoleName:      p.RoleName,
				UserID:        p.UserId,
				UserLogin:     p.UserLogin,
				UserAvatarUrl: dtos.GetGravatarUrl(p.UserEmail),
				Team:          p.Team,
				TeamID:        p.TeamId,
				TeamAvatarUrl: teamAvatarUrl,
				BuiltInRole:   p.BuiltInRole,
				Actions:       p.Actions,
				Permission:    permission,
				IsManaged:     p.IsManaged,
				IsInherited:   p.IsInherited,
			})
		}
	}

	return response.JSON(http.StatusOK, dto)
}

type setPermissionCommand struct {
	Permission string `json:"permission"`
}

func (a *api) setUserPermission(c *models.ReqContext) response.Response {
	userID, err := strconv.ParseInt(web.Params(c.Req)[":userID"], 10, 64)
	if err != nil {
		return response.Error(http.StatusBadRequest, "userID is invalid", err)
	}
	resourceID := web.Params(c.Req)[":resourceID"]

	var cmd setPermissionCommand
	if err := web.Bind(c.Req, &cmd); err != nil {
		return response.Error(http.StatusBadRequest, "bad request data", err)
	}

	_, err = a.service.SetUserPermission(c.Req.Context(), c.OrgID, accesscontrol.User{ID: userID}, resourceID, cmd.Permission)
	if err != nil {
		return response.Error(http.StatusBadRequest, "failed to set user permission", err)
	}

	return permissionSetResponse(cmd)
}

func (a *api) setTeamPermission(c *models.ReqContext) response.Response {
	teamID, err := strconv.ParseInt(web.Params(c.Req)[":teamID"], 10, 64)
	if err != nil {
		return response.Error(http.StatusBadRequest, "teamID is invalid", err)
	}
	resourceID := web.Params(c.Req)[":resourceID"]

	var cmd setPermissionCommand
	if err := web.Bind(c.Req, &cmd); err != nil {
		return response.Error(http.StatusBadRequest, "bad request data", err)
	}

	_, err = a.service.SetTeamPermission(c.Req.Context(), c.OrgID, teamID, resourceID, cmd.Permission)
	if err != nil {
		return response.Error(http.StatusBadRequest, "failed to set team permission", err)
	}

	return permissionSetResponse(cmd)
}

func (a *api) setBuiltinRolePermission(c *models.ReqContext) response.Response {
	builtInRole := web.Params(c.Req)[":builtInRole"]
	resourceID := web.Params(c.Req)[":resourceID"]

	cmd := setPermissionCommand{}
	if err := web.Bind(c.Req, &cmd); err != nil {
		return response.Error(http.StatusBadRequest, "bad request data", err)
	}

	_, err := a.service.SetBuiltInRolePermission(c.Req.Context(), c.OrgID, builtInRole, resourceID, cmd.Permission)
	if err != nil {
		return response.Error(http.StatusBadRequest, "failed to set role permission", err)
	}

	return permissionSetResponse(cmd)
}

func permissionSetResponse(cmd setPermissionCommand) response.Response {
	message := "Permission updated"
	if cmd.Permission == "" {
		message = "Permission removed"
	}
	return response.Success(message)
}
