package system

import (
	"fmt"
	"net/http"
	"sort"

	"github.com/grafana/grafana/pkg/api/dtos"
	"github.com/grafana/grafana/pkg/api/response"
	"github.com/grafana/grafana/pkg/api/routing"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/accesscontrol/middleware"
	"github.com/grafana/grafana/pkg/web"
)

func NewSystem(options Options, router routing.RouteRegister, ac accesscontrol.AccessControl, store accesscontrol.ResourceStore) (*System, error) {
	var permissions []string
	actionSet := make(map[string]struct{})
	for permission, actions := range options.PermissionsToActions {
		permissions = append(permissions, permission)
		for _, a := range actions {
			actionSet[a] = struct{}{}
		}
	}

	// Sort all permissions based on action length. Will be used when mapping between actions to permission
	sort.Slice(permissions, func(i, j int) bool {
		return len(options.PermissionsToActions[permissions[i]]) > len(options.PermissionsToActions[permissions[j]])
	})

	actions := make([]string, 0, len(actionSet))
	for action := range actionSet {
		actions = append(actions, action)
	}

	s := &System{
		ac:          ac,
		router:      router,
		options:     options,
		permissions: permissions,
		manager:     newManager(options.Resource, actions, options.ResourceValidator, store),
	}

	if err := s.declareFixedRoles(); err != nil {
		return nil, err
	}

	s.registerEndpoints()
	return s, nil
}

// System is used to create access control sub system including api / and service for managed resource permission
type System struct {
	ac     accesscontrol.AccessControl
	router routing.RouteRegister

	options     Options
	permissions []string
	manager     *Manager
}

func (s *System) registerEndpoints() {
	auth := middleware.Middleware(s.ac)
	disable := middleware.Disable(s.ac.IsDisabled())
	s.router.Group(fmt.Sprintf("/api/access-control/system/%s", s.options.Resource), func(r routing.RouteRegister) {
		idScope := accesscontrol.Scope(s.options.Resource, "id", accesscontrol.Parameter(":resourceID"))
		actionWrite, actionRead := fmt.Sprintf("%s.permissions:write", s.options.Resource), fmt.Sprintf("%s.permissions:read", s.options.Resource)
		r.Get("/description", auth(disable, accesscontrol.EvalPermission(actionRead)), routing.Wrap(s.getDescription))
		r.Get("/:resourceID", auth(disable, accesscontrol.EvalPermission(actionRead, idScope)), routing.Wrap(s.getPermissions))
		r.Post("/:resourceID/users/:userID", auth(disable, accesscontrol.EvalPermission(actionWrite, idScope)), routing.Wrap(s.setUserPermission))
		r.Post("/:resourceID/teams/:teamID", auth(disable, accesscontrol.EvalPermission(actionWrite, idScope)), routing.Wrap(s.setTeamPermission))
		r.Post("/:resourceID/builtInRoles/:builtInRole", auth(disable, accesscontrol.EvalPermission(actionWrite, idScope)), routing.Wrap(s.setBuiltinRolePermission))
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

func (s *System) getDescription(c *models.ReqContext) response.Response {
	return response.JSON(http.StatusOK, &Description{
		Permissions: s.permissions,
		Assignments: s.options.Assignments,
	})
}

type resourcePermissionDTO struct {
	ResourceID    string   `json:"resourceId"`
	Managed       bool     `json:"managed"`
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

func (s *System) getPermissions(c *models.ReqContext) response.Response {
	resourceID := web.Params(c.Req)[":resourceID"]

	permissions, err := s.manager.GetPermissions(c.Req.Context(), c.OrgId, resourceID)
	if err != nil {
		return response.Error(http.StatusInternalServerError, "failed to get permissions", err)
	}

	dto := make([]resourcePermissionDTO, 0, len(permissions))
	for _, p := range permissions {
		if permission, ok := s.mapActions(p); ok {
			dto = append(dto, resourcePermissionDTO{
				ResourceID:    p.ResourceID,
				Managed:       p.Managed(),
				UserID:        p.UserId,
				UserLogin:     p.UserLogin,
				UserAvatarUrl: dtos.GetGravatarUrl(p.UserEmail),
				Team:          p.Team,
				TeamID:        p.TeamId,
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

func (s *System) setUserPermission(c *models.ReqContext) response.Response {
	userID := c.ParamsInt64(":userID")
	resourceID := web.Params(c.Req)[":resourceID"]

	var cmd setPermissionCommand
	if err := web.Bind(c.Req, &cmd); err != nil {
		return response.Error(http.StatusBadRequest, "bad request data", err)
	}

	if !s.options.Assignments.Users {
		return response.Error(http.StatusNotImplemented, "", nil)
	}

	permission, err := s.manager.SetUserPermission(c.Req.Context(), c.OrgId, userID, resourceID, s.mapPermission(cmd.Permission))

	if err != nil {
		return response.Error(http.StatusBadRequest, "failed to set user permission", err)
	}

	translated, _ := s.mapActions(*permission)
	return response.JSON(http.StatusOK, resourcePermissionDTO{
		ResourceID:    permission.ResourceID,
		Managed:       permission.Managed(),
		UserID:        permission.UserId,
		UserLogin:     permission.UserLogin,
		UserAvatarUrl: dtos.GetGravatarUrl(permission.UserEmail),
		Actions:       permission.Actions,
		Permission:    translated,
	})
}

func (s *System) setTeamPermission(c *models.ReqContext) response.Response {
	teamID := c.ParamsInt64(":teamID")
	resourceID := web.Params(c.Req)[":resourceID"]

	var cmd setPermissionCommand
	if err := web.Bind(c.Req, &cmd); err != nil {
		return response.Error(http.StatusBadRequest, "bad request data", err)
	}

	if !s.options.Assignments.Teams {
		return response.Error(http.StatusNotImplemented, "", nil)
	}

	permission, err := s.manager.SetTeamPermission(c.Req.Context(), c.OrgId, teamID, resourceID, s.mapPermission(cmd.Permission))

	if err != nil {
		return response.Error(http.StatusBadRequest, "failed to set team permission", err)
	}

	translated, _ := s.mapActions(*permission)
	return response.JSON(http.StatusOK, resourcePermissionDTO{
		ResourceID:    permission.ResourceID,
		Managed:       permission.Managed(),
		Team:          permission.Team,
		TeamID:        permission.TeamId,
		TeamAvatarUrl: dtos.GetGravatarUrlWithDefault(permission.TeamEmail, permission.Team),
		Actions:       permission.Actions,
		Permission:    translated,
	})
}

func (s *System) setBuiltinRolePermission(c *models.ReqContext) response.Response {
	builtInRole := web.Params(c.Req)[":builtInRole"]
	resourceID := web.Params(c.Req)[":resourceID"]

	cmd := setPermissionCommand{}
	if err := web.Bind(c.Req, &cmd); err != nil {
		return response.Error(http.StatusBadRequest, "bad request data", err)
	}

	if !s.options.Assignments.BuiltInRoles {
		return response.Error(http.StatusNotImplemented, "", nil)
	}

	permission, err := s.manager.SetBuiltinRolePermission(c.Req.Context(), c.OrgId, builtInRole, resourceID, s.mapPermission(cmd.Permission))

	if err != nil {
		return response.Error(http.StatusBadRequest, "failed to set role permission", err)
	}

	translated, _ := s.mapActions(*permission)
	return response.JSON(http.StatusOK, resourcePermissionDTO{
		ResourceID:  permission.ResourceID,
		Managed:     permission.Managed(),
		BuiltInRole: permission.BuiltInRole,
		Actions:     permission.Actions,
		Permission:  translated,
	})
}

func (s *System) mapActions(permission accesscontrol.ResourcePermission) (string, bool) {
	for _, p := range s.permissions {
		if permission.Contains(s.options.PermissionsToActions[p]) {
			return p, true
		}
	}
	return "", false
}

func (s *System) mapPermission(permission string) []string {
	for k, v := range s.options.PermissionsToActions {
		if permission == k {
			return v
		}
	}
	return []string{}
}

func (s *System) declareFixedRoles() error {
	scopeAll := accesscontrol.Scope(s.options.Resource, "*")
	readerRole := accesscontrol.RoleRegistration{
		Role: accesscontrol.RoleDTO{
			Version: 5,
			Name:    fmt.Sprintf("fixed:%s.permissions:reader", s.options.Resource),
			Permissions: []accesscontrol.Permission{
				{Action: fmt.Sprintf("%s.permissions:read", s.options.Resource), Scope: scopeAll},
			},
		},
		Grants: []string{string(models.ROLE_ADMIN)},
	}

	writerRole := accesscontrol.RoleRegistration{
		Role: accesscontrol.RoleDTO{
			Version: 5,
			Name:    fmt.Sprintf("fixed:%s.permissions:writer", s.options.Resource),
			Permissions: accesscontrol.ConcatPermissions(readerRole.Role.Permissions, []accesscontrol.Permission{
				{Action: fmt.Sprintf("%s.permissions:write", s.options.Resource), Scope: scopeAll},
			}),
		},
		Grants: []string{string(models.ROLE_ADMIN)},
	}

	return s.ac.DeclareFixedRoles(readerRole, writerRole)
}
