package resourcepermissions

import (
	"context"
	"fmt"

	"github.com/grafana/grafana/pkg/api/routing"
	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/auth/identity"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/licensing"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/services/team"
	"github.com/grafana/grafana/pkg/services/user"
)

type Store interface {
	// SetUserResourcePermission sets permission for managed user role on a resource
	SetUserResourcePermission(
		ctx context.Context, orgID int64,
		user accesscontrol.User,
		cmd SetResourcePermissionCommand,
		hook UserResourceHookFunc,
	) (*accesscontrol.ResourcePermission, error)

	// SetTeamResourcePermission sets permission for managed team role on a resource
	SetTeamResourcePermission(
		ctx context.Context, orgID, teamID int64,
		cmd SetResourcePermissionCommand,
		hook TeamResourceHookFunc,
	) (*accesscontrol.ResourcePermission, error)

	// SetBuiltInResourcePermission sets permissions for managed builtin role on a resource
	SetBuiltInResourcePermission(
		ctx context.Context, orgID int64, builtinRole string,
		cmd SetResourcePermissionCommand,
		hook BuiltinResourceHookFunc,
	) (*accesscontrol.ResourcePermission, error)

	SetResourcePermissions(
		ctx context.Context, orgID int64,
		commands []SetResourcePermissionsCommand,
		hooks ResourceHooks,
	) ([]accesscontrol.ResourcePermission, error)

	// GetResourcePermissions will return all permission for supplied resource id
	GetResourcePermissions(ctx context.Context, orgID int64, query GetResourcePermissionsQuery) ([]accesscontrol.ResourcePermission, error)

	// DeleteResourcePermissions will delete all permissions for supplied resource id
	DeleteResourcePermissions(ctx context.Context, orgID int64, cmd *DeleteResourcePermissionsCmd) error
}

func New(
	options Options, features featuremgmt.FeatureToggles, router routing.RouteRegister, license licensing.Licensing,
	ac accesscontrol.AccessControl, service accesscontrol.Service, sqlStore db.DB,
	teamService team.Service, userService user.Service,
) (*Service, error) {
	s := &Service{
		ac:          ac,
		store:       NewStore(sqlStore, features),
		options:     options,
		license:     license,
		permissions: options.Permissions(),
		actions:     options.Actions(),
		sqlStore:    sqlStore,
		service:     service,
		teamService: teamService,
		userService: userService,
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
	ac      accesscontrol.AccessControl
	service accesscontrol.Service
	store   Store
	api     *api
	license licensing.Licensing

	options     Options
	permissions []string
	actions     []string
	sqlStore    db.DB
	teamService team.Service
	userService user.Service
}

func (s *Service) GetPermissions(ctx context.Context, user identity.Requester, resourceID string) ([]accesscontrol.ResourcePermission, error) {
	var inheritedScopes []string
	if s.options.InheritedScopesSolver != nil {
		var err error
		inheritedScopes, err = s.options.InheritedScopesSolver(ctx, user.GetOrgID(), resourceID)
		if err != nil {
			return nil, err
		}
	}

	return s.store.GetResourcePermissions(ctx, user.GetOrgID(), GetResourcePermissionsQuery{
		User:                 user,
		Actions:              s.actions,
		Resource:             s.options.Resource,
		ResourceID:           resourceID,
		ResourceAttribute:    s.options.ResourceAttribute,
		InheritedScopes:      inheritedScopes,
		OnlyManaged:          s.options.OnlyManaged,
		EnforceAccessControl: s.license.FeatureEnabled("accesscontrol.enforcement"),
	})
}

func (s *Service) SetUserPermission(ctx context.Context, orgID int64, user accesscontrol.User, resourceID string, permission string, customActions []string) (*accesscontrol.ResourcePermission, error) {
	actions, err := s.mapPermission(permission)
	if err != nil {
		return nil, err
	}
	if len(customActions) > 0 {
		if err := s.validateActions(customActions); err != nil {
			return nil, err
		}
		actions = customActions
	}

	if err := s.validateResource(ctx, orgID, resourceID); err != nil {
		return nil, err
	}

	if err := s.validateUser(ctx, orgID, user.ID); err != nil {
		return nil, err
	}

	return s.store.SetUserResourcePermission(ctx, orgID, user, SetResourcePermissionCommand{
		Actions:           actions,
		Permission:        permission,
		Resource:          s.options.Resource,
		ResourceID:        resourceID,
		ResourceAttribute: s.options.ResourceAttribute,
	}, s.options.OnSetUser)
}

func (s *Service) SetTeamPermission(ctx context.Context, orgID, teamID int64, resourceID string, permission string, customActions []string) (*accesscontrol.ResourcePermission, error) {
	actions, err := s.mapPermission(permission)
	if err != nil {
		return nil, err
	}
	if len(customActions) > 0 {
		if err := s.validateActions(customActions); err != nil {
			return nil, err
		}
		actions = customActions
	}

	if err := s.validateTeam(ctx, orgID, teamID); err != nil {
		return nil, err
	}

	if err := s.validateResource(ctx, orgID, resourceID); err != nil {
		return nil, err
	}

	return s.store.SetTeamResourcePermission(ctx, orgID, teamID, SetResourcePermissionCommand{
		Actions:           actions,
		Permission:        permission,
		Resource:          s.options.Resource,
		ResourceID:        resourceID,
		ResourceAttribute: s.options.ResourceAttribute,
	}, s.options.OnSetTeam)
}

func (s *Service) SetBuiltInRolePermission(ctx context.Context, orgID int64, builtInRole, resourceID string, permission string, customActions []string) (*accesscontrol.ResourcePermission, error) {
	actions, err := s.mapPermission(permission)
	if err != nil {
		return nil, err
	}
	if len(customActions) > 0 {
		if err := s.validateActions(customActions); err != nil {
			return nil, err
		}
		actions = customActions
	}

	if err := s.validateBuiltinRole(ctx, builtInRole); err != nil {
		return nil, err
	}

	if err := s.validateResource(ctx, orgID, resourceID); err != nil {
		return nil, err
	}

	return s.store.SetBuiltInResourcePermission(ctx, orgID, builtInRole, SetResourcePermissionCommand{
		Actions:           actions,
		Permission:        permission,
		Resource:          s.options.Resource,
		ResourceID:        resourceID,
		ResourceAttribute: s.options.ResourceAttribute,
	}, s.options.OnSetBuiltInRole)
}

func (s *Service) SetPermissions(
	ctx context.Context, orgID int64, resourceID string,
	commands ...accesscontrol.SetResourcePermissionCommand,
) ([]accesscontrol.ResourcePermission, error) {
	if err := s.validateResource(ctx, orgID, resourceID); err != nil {
		return nil, err
	}

	dbCommands := make([]SetResourcePermissionsCommand, 0, len(commands))
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
		if len(cmd.Actions) > 0 {
			if err := s.validateActions(cmd.Actions); err != nil {
				return nil, err
			}
			actions = cmd.Actions
		}

		dbCommands = append(dbCommands, SetResourcePermissionsCommand{
			User:        accesscontrol.User{ID: cmd.UserID},
			TeamID:      cmd.TeamID,
			BuiltinRole: cmd.BuiltinRole,
			SetResourcePermissionCommand: SetResourcePermissionCommand{
				Actions:           actions,
				Resource:          s.options.Resource,
				ResourceID:        resourceID,
				ResourceAttribute: s.options.ResourceAttribute,
				Permission:        cmd.Permission,
			},
		})
	}

	return s.store.SetResourcePermissions(ctx, orgID, dbCommands, ResourceHooks{
		User:        s.options.OnSetUser,
		Team:        s.options.OnSetTeam,
		BuiltInRole: s.options.OnSetBuiltInRole,
	})
}

// MapActions returns the logical "Permission" (e.g. Access Level) that corresponds to a given set of a actions.
// There is no guarantee of possible overlap between two access levels. The first Permission that contains
// the set of actions will be returned.
func (s *Service) MapActions(permission accesscontrol.ResourcePermission) string {
	for _, p := range s.permissions {
		if permission.Contains(s.options.PermissionsToActions[p]) {
			return p
		}
	}
	return ""
}

func (s *Service) DeleteResourcePermissions(ctx context.Context, orgID int64, resourceID string) error {
	return s.store.DeleteResourcePermissions(ctx, orgID, &DeleteResourcePermissionsCmd{
		Resource:          s.options.Resource,
		ResourceAttribute: s.options.ResourceAttribute,
		ResourceID:        resourceID,
	})
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

func (s Service) validateActions(actions []string) error {
	for _, a := range actions {
		actionFound := false
		for _, fgaAction := range s.options.FineGrainedActions {
			if a == fgaAction {
				actionFound = true
			}
		}
		if !actionFound {
			return ErrInvalidPermission
		}
	}
	return nil
}

func (s *Service) validateUser(ctx context.Context, orgID, userID int64) error {
	if !s.options.Assignments.Users {
		return ErrInvalidAssignment
	}

	_, err := s.userService.GetSignedInUser(ctx, &user.GetSignedInUserQuery{OrgID: orgID, UserID: userID})
	return err
}

func (s *Service) validateTeam(ctx context.Context, orgID, teamID int64) error {
	if !s.options.Assignments.Teams {
		return ErrInvalidAssignment
	}

	if _, err := s.teamService.GetTeamByID(ctx, &team.GetTeamByIDQuery{OrgID: orgID, ID: teamID}); err != nil {
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
			Name:        fmt.Sprintf("fixed:%s.permissions:reader", s.options.Resource),
			DisplayName: s.options.ReaderRoleName,
			Group:       s.options.RoleGroup,
			Permissions: []accesscontrol.Permission{
				{Action: fmt.Sprintf("%s.permissions:read", s.options.Resource), Scope: scopeAll},
			},
		},
		Grants: []string{string(org.RoleAdmin)},
	}

	writerRole := accesscontrol.RoleRegistration{
		Role: accesscontrol.RoleDTO{
			Name:        fmt.Sprintf("fixed:%s.permissions:writer", s.options.Resource),
			DisplayName: s.options.WriterRoleName,
			Group:       s.options.RoleGroup,
			Permissions: accesscontrol.ConcatPermissions(readerRole.Role.Permissions, []accesscontrol.Permission{
				{Action: fmt.Sprintf("%s.permissions:write", s.options.Resource), Scope: scopeAll},
			}),
		},
		Grants: []string{string(org.RoleAdmin)},
	}

	return s.service.DeclareFixedRoles(readerRole, writerRole)
}
