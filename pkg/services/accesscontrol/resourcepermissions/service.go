package resourcepermissions

import (
	"context"
	"fmt"
	"sort"

	"github.com/grafana/grafana/pkg/api/routing"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/accesscontrol/resourcepermissions/types"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/setting"
)

type Store interface {
	// SetUserResourcePermission sets permission for managed user role on a resource
	SetUserResourcePermission(
		ctx context.Context, orgID int64,
		user accesscontrol.User,
		cmd types.SetResourcePermissionCommand,
		hook types.UserResourceHookFunc,
	) (*accesscontrol.ResourcePermission, error)

	// SetTeamResourcePermission sets permission for managed team role on a resource
	SetTeamResourcePermission(
		ctx context.Context, orgID, teamID int64,
		cmd types.SetResourcePermissionCommand,
		hook types.TeamResourceHookFunc,
	) (*accesscontrol.ResourcePermission, error)

	// SetBuiltInResourcePermission sets permissions for managed builtin role on a resource
	SetBuiltInResourcePermission(
		ctx context.Context, orgID int64, builtinRole string,
		cmd types.SetResourcePermissionCommand,
		hook types.BuiltinResourceHookFunc,
	) (*accesscontrol.ResourcePermission, error)

	SetResourcePermissions(
		ctx context.Context, orgID int64,
		commands []types.SetResourcePermissionsCommand,
		hooks types.ResourceHooks,
	) ([]accesscontrol.ResourcePermission, error)

	// GetResourcesPermissions will return all permission for all supplied resource ids
	GetResourcesPermissions(ctx context.Context, orgID int64, query types.GetResourcesPermissionsQuery) ([]accesscontrol.ResourcePermission, error)
}

func New(options Options, cfg *setting.Cfg, router routing.RouteRegister, ac accesscontrol.AccessControl, store Store, sqlStore *sqlstore.SQLStore) (*Service, error) {
	var permissions []string
	actionSet := make(map[string]struct{})
	for permission, actions := range options.PermissionsToActions {
		permissions = append(permissions, permission)
		for _, a := range actions {
			actionSet[a] = struct{}{}
		}
	}

	// Sort all permissions based on action length. Will be used when mapping between actions to permissions
	sort.Slice(permissions, func(i, j int) bool {
		return len(options.PermissionsToActions[permissions[i]]) > len(options.PermissionsToActions[permissions[j]])
	})

	actions := make([]string, 0, len(actionSet))
	for action := range actionSet {
		actions = append(actions, action)
	}

	s := &Service{
		ac:          ac,
		cfg:         cfg,
		store:       store,
		options:     options,
		permissions: permissions,
		actions:     actions,
		sqlStore:    sqlStore,
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
	cfg   *setting.Cfg
	ac    accesscontrol.AccessControl
	store Store
	api   *api

	options     Options
	permissions []string
	actions     []string
	sqlStore    *sqlstore.SQLStore
}

func (s *Service) GetPermissions(ctx context.Context, user *models.SignedInUser, resourceID string) ([]accesscontrol.ResourcePermission, error) {
	return s.store.GetResourcesPermissions(ctx, user.OrgId, types.GetResourcesPermissionsQuery{
		User:        user,
		Actions:     s.actions,
		Resource:    s.options.Resource,
		ResourceIDs: []string{resourceID},
		OnlyManaged: s.options.OnlyManaged,
	})
}

func (s *Service) SetUserPermission(ctx context.Context, orgID int64, user accesscontrol.User, resourceID, permission string) (*accesscontrol.ResourcePermission, error) {
	actions, err := s.mapPermission(permission)
	if err != nil {
		return nil, err
	}

	if err := s.validateResource(ctx, orgID, resourceID); err != nil {
		return nil, err
	}

	if err := s.validateUser(ctx, orgID, user.ID); err != nil {
		return nil, err
	}

	return s.store.SetUserResourcePermission(ctx, orgID, user, types.SetResourcePermissionCommand{
		Actions:    actions,
		Permission: permission,
		ResourceID: resourceID,
		Resource:   s.options.Resource,
	}, s.options.OnSetUser)
}

func (s *Service) SetTeamPermission(ctx context.Context, orgID, teamID int64, resourceID, permission string) (*accesscontrol.ResourcePermission, error) {
	actions, err := s.mapPermission(permission)
	if err != nil {
		return nil, err
	}

	if err := s.validateTeam(ctx, orgID, teamID); err != nil {
		return nil, err
	}

	if err := s.validateResource(ctx, orgID, resourceID); err != nil {
		return nil, err
	}

	return s.store.SetTeamResourcePermission(ctx, orgID, teamID, types.SetResourcePermissionCommand{
		Actions:    actions,
		Permission: permission,
		ResourceID: resourceID,
		Resource:   s.options.Resource,
	}, s.options.OnSetTeam)
}

func (s *Service) SetBuiltInRolePermission(ctx context.Context, orgID int64, builtInRole, resourceID, permission string) (*accesscontrol.ResourcePermission, error) {
	actions, err := s.mapPermission(permission)
	if err != nil {
		return nil, err
	}

	if err := s.validateBuiltinRole(ctx, builtInRole); err != nil {
		return nil, err
	}

	if err := s.validateResource(ctx, orgID, resourceID); err != nil {
		return nil, err
	}

	return s.store.SetBuiltInResourcePermission(ctx, orgID, builtInRole, types.SetResourcePermissionCommand{
		Actions:    actions,
		Permission: permission,
		ResourceID: resourceID,
		Resource:   s.options.Resource,
	}, s.options.OnSetBuiltInRole)
}

func (s *Service) SetPermissions(
	ctx context.Context, orgID int64, resourceID string,
	commands ...accesscontrol.SetResourcePermissionCommand,
) ([]accesscontrol.ResourcePermission, error) {
	if err := s.validateResource(ctx, orgID, resourceID); err != nil {
		return nil, err
	}

	dbCommands := make([]types.SetResourcePermissionsCommand, 0, len(commands))
	for _, cmd := range commands {
		if cmd.UserID != 0 {
			if err := s.validateUser(ctx, orgID, cmd.UserID); err != nil {
				return nil, err
			}
		} else if cmd.TeamID != 0 {
			if err := s.validateTeam(ctx, orgID, cmd.TeamID); err != nil {
				return nil, err
			}
		} else {
			if err := s.validateBuiltinRole(ctx, cmd.BuiltinRole); err != nil {
				return nil, err
			}
		}

		actions, err := s.mapPermission(cmd.Permission)
		if err != nil {
			return nil, err
		}

		dbCommands = append(dbCommands, types.SetResourcePermissionsCommand{
			User:        accesscontrol.User{ID: cmd.UserID},
			TeamID:      cmd.TeamID,
			BuiltinRole: cmd.BuiltinRole,
			SetResourcePermissionCommand: types.SetResourcePermissionCommand{
				Actions:    actions,
				Resource:   s.options.Resource,
				ResourceID: resourceID,
				Permission: cmd.Permission,
			},
		})
	}

	return s.store.SetResourcePermissions(ctx, orgID, dbCommands, types.ResourceHooks{
		User:        s.options.OnSetUser,
		Team:        s.options.OnSetTeam,
		BuiltInRole: s.options.OnSetBuiltInRole,
	})
}

func (s *Service) MapActions(permission accesscontrol.ResourcePermission) string {
	for _, p := range s.permissions {
		if permission.Contains(s.options.PermissionsToActions[p]) {
			return p
		}
	}
	return ""
}

func (s *Service) mapPermission(permission string) ([]string, error) {
	if permission == "" {
		return []string{}, nil
	}

	for k, v := range s.options.PermissionsToActions {
		if permission == k {
			return v, nil
		}
	}
	return nil, ErrInvalidPermission
}

func (s *Service) validateResource(ctx context.Context, orgID int64, resourceID string) error {
	if s.options.ResourceValidator != nil {
		return s.options.ResourceValidator(ctx, orgID, resourceID)
	}
	return nil
}

func (s *Service) validateUser(ctx context.Context, orgID, userID int64) error {
	if !s.options.Assignments.Users {
		return ErrInvalidAssignment
	}

	if err := s.sqlStore.GetSignedInUser(ctx, &models.GetSignedInUserQuery{OrgId: orgID, UserId: userID}); err != nil {
		return err
	}
	return nil
}

func (s *Service) validateTeam(ctx context.Context, orgID, teamID int64) error {
	if !s.options.Assignments.Teams {
		return ErrInvalidAssignment
	}

	if err := s.sqlStore.GetTeamById(ctx, &models.GetTeamByIdQuery{OrgId: orgID, Id: teamID}); err != nil {
		return err
	}
	return nil
}

func (s *Service) validateBuiltinRole(ctx context.Context, builtinRole string) error {
	if !s.options.Assignments.BuiltInRoles {
		return ErrInvalidAssignment
	}

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
