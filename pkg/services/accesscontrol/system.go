package accesscontrol

import (
	"context"
	"fmt"
	"net/http"
	"strconv"

	"github.com/go-macaron/binding"

	"github.com/grafana/grafana/pkg/api/dtos"
	"github.com/grafana/grafana/pkg/api/response"
	"github.com/grafana/grafana/pkg/api/routing"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/web"
)

func DataSourcePermissionsProvider(router routing.RouteRegister, sql *sqlstore.SQLStore, store ResourceStore) *System {
	options := SystemOptions{
		Resource: "datasources",
		ResourceValidator: func(ctx context.Context, orgID int64, resourceID string) error {
			id, err := strconv.Atoi(resourceID)
			if err != nil {
				return err
			}

			if err := sql.GetDataSource(ctx, &models.GetDataSourceQuery{Id: int64(id), OrgId: orgID}); err != nil {
				return err
			}

			return nil
		},
		Actions: []string{
			"datasources:query",
			"datasources:read",
		},
		Assignments: Assignments{
			Users:       true,
			Teams:       true,
			BuiltinRole: true,
		},
		Permissions: []string{
			"Query",
		},
		PermissionMapper: func(permission string) []string {
			if permission == "Query" {
				return []string{
					"datasources:query",
					"datasources:read",
				}
			}

			return []string{}
		},
	}

	s := &System{
		options: options,
		router:  router,
		manager: NewResourceManager(options.Resource, options.Actions, nil, store),
	}

	s.registerEndpoints()

	return s

}

// TODO: Hooks
type SystemOptions struct {
	Resource          string
	ResourceValidator func(ctx context.Context, orgID int64, resourceID string) error

	Actions []string

	Assignments Assignments
	Permissions []string

	PermissionMapper func(permission string) []string
	ActionsMapper    func(actions []string) string
}

func NewSystemProvider(options SystemOptions) func(router routing.RouteRegister, store ResourceStore) *System {
	return func(router routing.RouteRegister, store ResourceStore) *System {
		return newSystem(options, router, store)
	}
}

func newSystem(options SystemOptions, router routing.RouteRegister, store ResourceStore) *System {
	s := &System{
		options: options,
		router:  router,
		manager: NewResourceManager(options.Resource, options.Actions, nil, store),
	}

	s.registerEndpoints()

	return s
}

// System is used to create access control sub system including api / and service for managed resource permission
type System struct {
	options SystemOptions
	router  routing.RouteRegister
	manager *ResourceManager
}

func (s *System) registerEndpoints() {
	s.router.Group(fmt.Sprintf("/api/access-control/system/%s", s.options.Resource), func(r routing.RouteRegister) {
		r.Get("/describe", routing.Wrap(s.describe))
		r.Get("/:resourceID", routing.Wrap(s.getPermissions))
		r.Post("/:resourceID/user/:userID", binding.Bind(setPermissionCommand{}), routing.Wrap(s.setUserPermission))
		r.Post("/:resourceID/team/:teamID", binding.Bind(setPermissionCommand{}), routing.Wrap(s.setTeamPermission))
		r.Post("/:resourceID/builtinRole/:builtinRole", binding.Bind(setPermissionCommand{}), routing.Wrap(s.setBuiltinRolePermission))
	})
}

type Assignments struct {
	Users       bool `json:"users"`
	Teams       bool `json:"teams"`
	BuiltinRole bool `json:"builtinRole"`
}

type SystemDescription struct {
	Resource    string      `json:"resource"`
	Assignments Assignments `json:"assignments"`
	Permissions []string    `json:"permissions"`
}

func (s *System) describe(c *models.ReqContext) response.Response {
	fmt.Println("Describe")
	return response.JSON(http.StatusOK, &SystemDescription{
		Resource:    s.options.Resource,
		Assignments: s.options.Assignments,
		Permissions: s.options.Permissions,
	})
}

type resourcePermissionDTO struct {
	ResourceID    string `json:"resourceId"`
	Managed       bool   `json:"managed"`
	UserId        int64  `json:"userId,omitempty"`
	UserLogin     string `json:"userLogin,omitempty"`
	UserAvatarUrl string `json:"userAvatarUrl,omitempty"`
	Team          string `json:"team,omitempty"`
	TeamId        int64  `json:"teamId,omitempty"`
	TeamAvatarUrl string `json:"teamAvatarUrl,omitempty"`
	BuiltInRole   string `json:"BuiltInRole,omitempty"`
}

func (s *System) getPermissions(c *models.ReqContext) response.Response {
	resourceID := web.Params(c.Req)[":resourceID"]

	permissions, err := s.manager.GetPermissions(c.Req.Context(), c.OrgId, resourceID)
	if err != nil {
		return response.Error(http.StatusInternalServerError, "failed to get permissions", err)
	}

	dto := make([]resourcePermissionDTO, 0, len(permissions))
	for _, p := range permissions {
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
		})
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

	if err := validateUser(c.Req.Context(), c.OrgId, userID); err != nil {
		return response.Error(http.StatusNotFound, "user not found", err)
	}

	if err := s.options.ResourceValidator(c.Req.Context(), c.OrgId, resourceID); err != nil {
		return response.Error(http.StatusNotFound, "data source not found", err)
	}

	permission, err := s.manager.SetUserPermission(
		c.Req.Context(),
		c.OrgId,
		resourceID,
		s.options.PermissionMapper(cmd.Permission),
		userID,
	)

	if err != nil {
		return response.Error(http.StatusBadRequest, "failed to set user permission", err)
	}

	return response.JSON(http.StatusOK, resourcePermissionDTO{
		ResourceID:    permission.ResourceID,
		Managed:       permission.Managed(),
		UserId:        permission.UserId,
		UserLogin:     permission.UserLogin,
		UserAvatarUrl: dtos.GetGravatarUrl(permission.UserEmail),
	})
}

func (s *System) setTeamPermission(c *models.ReqContext, cmd setPermissionCommand) response.Response {
	teamID := c.ParamsInt64(":teamID")
	resourceID := web.Params(c.Req)[":resourceID"]

	if !s.options.Assignments.Teams {
		return response.Error(http.StatusNotImplemented, "", nil)
	}

	if err := validateTeam(c.Req.Context(), c.OrgId, teamID); err != nil {
		return response.Error(http.StatusNotFound, "team not found", err)
	}

	if err := s.options.ResourceValidator(c.Req.Context(), c.OrgId, resourceID); err != nil {
		return response.Error(http.StatusNotFound, "data source not found", err)
	}

	permission, err := s.manager.SetTeamPermission(
		c.Req.Context(),
		c.OrgId,
		resourceID,
		s.options.PermissionMapper(cmd.Permission),
		teamID,
	)

	if err != nil {
		return response.Error(http.StatusBadRequest, "failed to set team permission", err)
	}

	return response.JSON(http.StatusOK, resourcePermissionDTO{
		ResourceID:    permission.ResourceID,
		Managed:       permission.Managed(),
		Team:          permission.Team,
		TeamId:        permission.TeamId,
		TeamAvatarUrl: dtos.GetGravatarUrlWithDefault(permission.TeamEmail, permission.Team),
	})
}

func (s *System) setBuiltinRolePermission(c *models.ReqContext, cmd setPermissionCommand) response.Response {
	builtinRole := web.Params(c.Req)[":builtinRole"]
	resourceID := web.Params(c.Req)[":resourceID"]

	if !s.options.Assignments.BuiltinRole {
		return response.Error(http.StatusNotImplemented, "", nil)
	}

	if err := validateBuiltinRole(c.Req.Context(), builtinRole); err != nil {
		return response.Error(http.StatusNotFound, "role not found", err)
	}

	if err := s.options.ResourceValidator(c.Req.Context(), c.OrgId, resourceID); err != nil {
		return response.Error(http.StatusNotFound, "data source not found", err)
	}

	permission, err := s.manager.SetBuiltinRolePermission(
		c.Req.Context(),
		c.OrgId,
		resourceID,
		s.options.PermissionMapper(cmd.Permission),
		builtinRole,
	)

	if err != nil {
		return response.Error(http.StatusBadRequest, "failed to set role permission", err)
	}

	return response.JSON(http.StatusOK, resourcePermissionDTO{
		ResourceID:  permission.ResourceID,
		Managed:     permission.Managed(),
		BuiltInRole: permission.BuiltInRole,
	})
}

func validateUser(ctx context.Context, orgID, userID int64) error {
	if err := sqlstore.GetSignedInUser(ctx, &models.GetSignedInUserQuery{OrgId: orgID, UserId: userID}); err != nil {
		return err
	}
	return nil
}

func validateTeam(ctx context.Context, orgID, teamID int64) error {
	if err := sqlstore.GetTeamById(ctx, &models.GetTeamByIdQuery{OrgId: orgID, Id: teamID}); err != nil {
		return err
	}
	return nil
}

func validateBuiltinRole(ctx context.Context, builtinRole string) error {
	if err := ValidateBuiltInRoles([]string{builtinRole}); err != nil {
		return err
	}
	return nil
}
