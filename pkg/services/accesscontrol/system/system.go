package system

import (
	"fmt"
	"net/http"

	"github.com/grafana/grafana/pkg/services/accesscontrol"

	"github.com/go-macaron/binding"

	"github.com/grafana/grafana/pkg/api/dtos"
	"github.com/grafana/grafana/pkg/api/response"
	"github.com/grafana/grafana/pkg/api/routing"
	"github.com/grafana/grafana/pkg/models"
	acmiddleware "github.com/grafana/grafana/pkg/services/accesscontrol/middleware"
	"github.com/grafana/grafana/pkg/web"
)

func disabled(ac accesscontrol.AccessControl) web.Handler {
	return func(c *models.ReqContext) {
		if ac.IsDisabled() {
			c.Resp.WriteHeader(http.StatusNotFound)
			return
		}
	}
}

func NewSystem(options Options, router routing.RouteRegister, ac accesscontrol.AccessControl, store accesscontrol.ResourceStore) (*System, error) {
	s := &System{
		ac:      ac,
		options: options,
		router:  router,
		manager: newManager(options.Resource, options.Actions, options.ResourceValidator, store),
	}

	if err := s.declareFixedRoles(); err != nil {
		return nil, err
	}
	s.registerEndpoints()

	return s, nil
}

// System is used to create access control sub system including api / and service for managed resource permission
type System struct {
	options Options
	manager *Manager
	router  routing.RouteRegister
	ac      accesscontrol.AccessControl
}

func (s *System) registerEndpoints() {
	auth := acmiddleware.Middleware(s.ac)

	s.router.Group(fmt.Sprintf("/api/access-control/system/%s", s.options.Resource), func(r routing.RouteRegister) {
		idScope := accesscontrol.Scope(s.options.Resource, "id", accesscontrol.Parameter(":resourceID"))
		actionSet, actionRead := fmt.Sprintf("%s.permissions:set", s.options.Resource), fmt.Sprintf("%s.permissions:read", s.options.Resource)
		r.Get("/description", auth(disabled(s.ac), accesscontrol.EvalPermission(actionRead)), routing.Wrap(s.getDescription))
		r.Get("/:resourceID", auth(disabled(s.ac), accesscontrol.EvalPermission(actionRead, idScope)), routing.Wrap(s.getPermissions))
		r.Post("/:resourceID/users/:userID", auth(disabled(s.ac), accesscontrol.EvalPermission(actionSet, idScope)), binding.Bind(setPermissionCommand{}), routing.Wrap(s.setUserPermission))
		r.Post("/:resourceID/teams/:teamID", auth(disabled(s.ac), accesscontrol.EvalPermission(actionSet, idScope)), binding.Bind(setPermissionCommand{}), routing.Wrap(s.setTeamPermission))
		r.Post("/:resourceID/builtInRoles/:builtInRole", auth(disabled(s.ac), accesscontrol.EvalPermission(actionSet, idScope)), binding.Bind(setPermissionCommand{}), routing.Wrap(s.setBuiltinRolePermission))
	})
}

type Assignments struct {
	Users        bool `json:"users"`
	Teams        bool `json:"teams"`
	BuiltinRoles bool `json:"builtinRoles"`
}

type Description struct {
	Assignments Assignments `json:"assignments"`
	Permissions []string    `json:"permissions"`
}

func (s *System) getDescription(c *models.ReqContext) response.Response {
	return response.JSON(http.StatusOK, &Description{
		Assignments: s.options.Assignments,
		Permissions: s.options.Permissions,
	})
}

type resourcePermissionDTO struct {
	ResourceID    string   `json:"resourceId"`
	Managed       bool     `json:"managed"`
	UserId        int64    `json:"userId,omitempty"`
	UserLogin     string   `json:"userLogin,omitempty"`
	UserAvatarUrl string   `json:"userAvatarUrl,omitempty"`
	Team          string   `json:"team,omitempty"`
	TeamId        int64    `json:"teamId,omitempty"`
	TeamAvatarUrl string   `json:"teamAvatarUrl,omitempty"`
	BuiltInRole   string   `json:"builtInRole,omitempty"`
	Actions       []string `json:"actions"`
	Permission    string   `json:"permission"`
}

func (s *System) getPermissions(c *models.ReqContext) response.Response {
	resourceID := web.Params(c.Req)[":resourceID"]

	permissions, err := s.manager.GetPermissions(c.Req.Context(), c.OrgId, resourceID)
	if err != nil {
		return response.Error(http.StatusInternalServerError, "failed to get permissions", err)
	}

	dto := make([]resourcePermissionDTO, 0, len(permissions))
	for _, p := range permissions {
		if permission, ok := s.options.mapActions(p); ok {
			dto = append(dto, resourcePermissionDTO{
				ResourceID:    p.ResourceID,
				Managed:       p.Managed(),
				UserId:        p.UserId,
				UserLogin:     p.UserLogin,
				UserAvatarUrl: dtos.GetGravatarUrl(p.UserEmail),
				Team:          p.Team,
				TeamId:        p.TeamId,
				TeamAvatarUrl: dtos.GetGravatarUrlWithDefault(p.TeamEmail, p.Team),
				BuiltInRole:   p.BuiltInRole,
				Actions:       p.Actions,
				Permission:    permission,
			})
		}
	}

	return response.JSON(http.StatusOK, dto)
}

type setPermissionCommand struct {
	Permission string `json:"permission"`
}

func (s *System) setUserPermission(c *models.ReqContext, cmd setPermissionCommand) response.Response {
	userID := c.ParamsInt64(":userID")
	resourceID := web.Params(c.Req)[":resourceID"]

	if !s.options.Assignments.Users {
		return response.Error(http.StatusNotImplemented, "", nil)
	}

	permission, err := s.manager.SetUserPermission(c.Req.Context(), c.OrgId, userID, resourceID, s.options.mapPermission(cmd.Permission))

	if err != nil {
		return response.Error(http.StatusBadRequest, "failed to set user permission", err)
	}

	translated, _ := s.options.mapActions(*permission)
	return response.JSON(http.StatusOK, resourcePermissionDTO{
		ResourceID:    permission.ResourceID,
		Managed:       permission.Managed(),
		UserId:        permission.UserId,
		UserLogin:     permission.UserLogin,
		UserAvatarUrl: dtos.GetGravatarUrl(permission.UserEmail),
		Actions:       permission.Actions,
		Permission:    translated,
	})
}

func (s *System) setTeamPermission(c *models.ReqContext, cmd setPermissionCommand) response.Response {
	teamID := c.ParamsInt64(":teamID")
	resourceID := web.Params(c.Req)[":resourceID"]

	if !s.options.Assignments.Teams {
		return response.Error(http.StatusNotImplemented, "", nil)
	}

	permission, err := s.manager.SetTeamPermission(c.Req.Context(), c.OrgId, teamID, resourceID, s.options.mapPermission(cmd.Permission))

	if err != nil {
		return response.Error(http.StatusBadRequest, "failed to set team permission", err)
	}

	translated, _ := s.options.mapActions(*permission)
	return response.JSON(http.StatusOK, resourcePermissionDTO{
		ResourceID:    permission.ResourceID,
		Managed:       permission.Managed(),
		Team:          permission.Team,
		TeamId:        permission.TeamId,
		TeamAvatarUrl: dtos.GetGravatarUrlWithDefault(permission.TeamEmail, permission.Team),
		Actions:       permission.Actions,
		Permission:    translated,
	})
}

func (s *System) setBuiltinRolePermission(c *models.ReqContext, cmd setPermissionCommand) response.Response {
	builtInRole := web.Params(c.Req)[":builtInRole"]
	resourceID := web.Params(c.Req)[":resourceID"]

	if !s.options.Assignments.BuiltinRoles {
		return response.Error(http.StatusNotImplemented, "", nil)
	}

	permission, err := s.manager.SetBuiltinRolePermission(c.Req.Context(), c.OrgId, builtInRole, resourceID, s.options.mapPermission(cmd.Permission))

	if err != nil {
		return response.Error(http.StatusBadRequest, "failed to set role permission", err)
	}

	translated, _ := s.options.mapActions(*permission)
	return response.JSON(http.StatusOK, resourcePermissionDTO{
		ResourceID:  permission.ResourceID,
		Managed:     permission.Managed(),
		BuiltInRole: permission.BuiltInRole,
		Actions:     permission.Actions,
		Permission:  translated,
	})
}

func (s *System) declareFixedRoles() error {
	scopeAll := accesscontrol.Scope(s.options.Resource, "*")
	// TODO: desc, display name, group
	readerRole := accesscontrol.RoleRegistration{
		Role: accesscontrol.RoleDTO{
			Version: 4,
			Name:    fmt.Sprintf("fixed:%s.permissions:reader", s.options.Resource),
			Permissions: []accesscontrol.Permission{
				{Action: fmt.Sprintf("%s.permissions:read", s.options.Resource), Scope: scopeAll},
			},
		},
		Grants: []string{string(models.ROLE_ADMIN)},
	}

	writerRole := accesscontrol.RoleRegistration{
		Role: accesscontrol.RoleDTO{
			Version: 4,
			Name:    fmt.Sprintf("fixed:%s.permissions:writer", s.options.Resource),
			Permissions: accesscontrol.ConcatPermissions(readerRole.Role.Permissions, []accesscontrol.Permission{
				{Action: fmt.Sprintf("%s.permissions:set", s.options.Resource), Scope: scopeAll},
			}),
		},
		Grants: []string{string(models.ROLE_ADMIN)},
	}

	return s.ac.DeclareFixedRoles(readerRole, writerRole)
}
