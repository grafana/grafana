package resourcepermissions

import (
	"context"
	"fmt"
	"sort"

	"github.com/grafana/grafana/pkg/services/sqlstore"

	"github.com/grafana/grafana/pkg/api/routing"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
)

func New(options Options, router routing.RouteRegister, ac accesscontrol.AccessControl, store accesscontrol.ResourcePermissionsStore) (*Service, error) {
	var permissions []string
	validActions := make(map[string]struct{})
	for permission, actions := range options.PermissionsToActions {
		permissions = append(permissions, permission)
		for _, a := range actions {
			validActions[a] = struct{}{}
		}
	}

	// Sort all permissions based on action length. Will be used when mapping between actions to permissions
	sort.Slice(permissions, func(i, j int) bool {
		return len(options.PermissionsToActions[permissions[i]]) > len(options.PermissionsToActions[permissions[j]])
	})

	actions := make([]string, 0, len(validActions))
	for action := range validActions {
		actions = append(actions, action)
	}

	s := &Service{
		ac:           ac,
		store:        store,
		options:      options,
		permissions:  permissions,
		actions:      actions,
		validActions: validActions,
	}

	s.api = newApi(ac, router, s)

	if err := s.declareFixedRoles(); err != nil {
		return nil, err
	}

	s.api.registerEndpoints()

	return s, nil
}

// Service is used to create access control sub system including api / and service for managed resource permission
type Service struct {
	ac    accesscontrol.AccessControl
	store accesscontrol.ResourcePermissionsStore
	api   *api

	options      Options
	permissions  []string
	actions      []string
	validActions map[string]struct{}
}

func (s *Service) GetPermissions(ctx context.Context, orgID int64, resourceID string) ([]accesscontrol.ResourcePermission, error) {
	return s.store.GetResourcesPermissions(ctx, orgID, accesscontrol.GetResourcesPermissionsQuery{
		Actions:     s.actions,
		Resource:    s.options.Resource,
		ResourceIDs: []string{resourceID},
		OnlyManaged: s.options.OnlyManaged,
	})
}

func (s *Service) SetUserPermission(ctx context.Context, orgID, userID int64, resourceID string, actions []string) (*accesscontrol.ResourcePermission, error) {
	if !s.options.Assignments.Users {
		return nil, ErrInvalidAssignment
	}

	if !s.validateActions(actions) {
		return nil, ErrInvalidActions
	}

	if err := s.validateResource(ctx, orgID, resourceID); err != nil {
		return nil, err
	}

	if err := s.validateUser(ctx, orgID, userID); err != nil {
		return nil, err
	}

	permission, err := s.store.SetUserResourcePermission(ctx, orgID, userID, accesscontrol.SetResourcePermissionCommand{
		Actions:    actions,
		ResourceID: resourceID,
		Resource:   s.options.Resource,
	})
	if err != nil {
		return nil, err
	}

	if s.options.OnSetUser != nil {
		if err := s.options.OnSetUser(ctx, orgID, userID, resourceID, s.MapActions(*permission)); err != nil {
			return nil, err
		}
	}
	return permission, nil
}

func (s *Service) SetTeamPermission(ctx context.Context, orgID, teamID int64, resourceID string, actions []string) (*accesscontrol.ResourcePermission, error) {
	if !s.options.Assignments.Teams {
		return nil, ErrInvalidAssignment
	}
	if !s.validateActions(actions) {
		return nil, ErrInvalidActions
	}

	if err := s.validateTeam(ctx, orgID, teamID); err != nil {
		return nil, err
	}

	if err := s.validateResource(ctx, orgID, resourceID); err != nil {
		return nil, err
	}

	permission, err := s.store.SetTeamResourcePermission(ctx, orgID, teamID, accesscontrol.SetResourcePermissionCommand{
		Actions:    actions,
		ResourceID: resourceID,
		Resource:   s.options.Resource,
	})
	if err != nil {
		return nil, err
	}

	if s.options.OnSetTeam != nil {
		if err := s.options.OnSetTeam(ctx, orgID, teamID, resourceID, s.MapActions(*permission)); err != nil {
			return nil, err
		}
	}
	return permission, nil
}

func (s *Service) SetBuiltInRolePermission(ctx context.Context, orgID int64, builtInRole string, resourceID string, actions []string) (*accesscontrol.ResourcePermission, error) {
	if !s.options.Assignments.BuiltInRoles {
		return nil, ErrInvalidAssignment
	}

	if !s.validateActions(actions) {
		return nil, ErrInvalidActions
	}

	if err := s.validateBuiltinRole(ctx, builtInRole); err != nil {
		return nil, err
	}

	if err := s.validateResource(ctx, orgID, resourceID); err != nil {
		return nil, err
	}

	permission, err := s.store.SetBuiltInResourcePermission(ctx, orgID, builtInRole, accesscontrol.SetResourcePermissionCommand{
		Actions:    actions,
		ResourceID: resourceID,
		Resource:   s.options.Resource,
	})
	if err != nil {
		return nil, err
	}

	if s.options.OnSetBuiltInRole != nil {
		if err := s.options.OnSetBuiltInRole(ctx, orgID, builtInRole, resourceID, s.MapActions(*permission)); err != nil {
			return nil, err
		}
	}
	return permission, nil
}

func (s *Service) MapActions(permission accesscontrol.ResourcePermission) string {
	for _, p := range s.permissions {
		if permission.Contains(s.options.PermissionsToActions[p]) {
			return p
		}
	}
	return ""
}

func (s *Service) MapPermission(permission string) []string {
	for k, v := range s.options.PermissionsToActions {
		if permission == k {
			return v
		}
	}
	return []string{}
}

func (s *Service) validateResource(ctx context.Context, orgID int64, resourceID string) error {
	if s.options.ResourceValidator != nil {
		return s.options.ResourceValidator(ctx, orgID, resourceID)
	}
	return nil
}

func (s *Service) validateActions(actions []string) bool {
	for _, a := range actions {
		if _, ok := s.validActions[a]; !ok {
			return false
		}
	}
	return true
}

func (s *Service) validateUser(ctx context.Context, orgID, userID int64) error {
	if err := sqlstore.GetSignedInUser(ctx, &models.GetSignedInUserQuery{OrgId: orgID, UserId: userID}); err != nil {
		return err
	}
	return nil
}

func (s *Service) validateTeam(ctx context.Context, orgID, teamID int64) error {
	if err := sqlstore.GetTeamById(ctx, &models.GetTeamByIdQuery{OrgId: orgID, Id: teamID}); err != nil {
		return err
	}
	return nil
}

func (s *Service) validateBuiltinRole(ctx context.Context, builtinRole string) error {
	if err := accesscontrol.ValidateBuiltInRoles([]string{builtinRole}); err != nil {
		return err
	}
	return nil
}

func (s *Service) declareFixedRoles() error {
	scopeAll := accesscontrol.Scope(s.options.Resource, "*")
	readerRole := accesscontrol.RoleRegistration{
		Role: accesscontrol.RoleDTO{
			Version:     5,
			Name:        fmt.Sprintf("fixed:%s.permissions:reader", s.options.Resource),
			DisplayName: s.options.ReaderRoleName,
			Group:       s.options.RoleGroup,
			Permissions: []accesscontrol.Permission{
				{Action: fmt.Sprintf("%s.permissions:read", s.options.Resource), Scope: scopeAll},
			},
		},
		Grants: []string{string(models.ROLE_ADMIN)},
	}

	writerRole := accesscontrol.RoleRegistration{
		Role: accesscontrol.RoleDTO{
			Version:     5,
			Name:        fmt.Sprintf("fixed:%s.permissions:writer", s.options.Resource),
			DisplayName: s.options.WriterRoleName,
			Group:       s.options.RoleGroup,
			Permissions: accesscontrol.ConcatPermissions(readerRole.Role.Permissions, []accesscontrol.Permission{
				{Action: fmt.Sprintf("%s.permissions:write", s.options.Resource), Scope: scopeAll},
			}),
		},
		Grants: []string{string(models.ROLE_ADMIN)},
	}

	return s.ac.DeclareFixedRoles(readerRole, writerRole)
}
