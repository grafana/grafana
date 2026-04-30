package resourcepermissions

import (
	"context"
	"errors"
	"fmt"
	"slices"
	"sort"
	"strings"

	"github.com/open-feature/go-sdk/openfeature"

	"github.com/grafana/grafana/pkg/api/routing"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/accesscontrol/pluginutils"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/folder"
	"github.com/grafana/grafana/pkg/services/licensing"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/pluginaccesscontrol"
	"github.com/grafana/grafana/pkg/services/serviceaccounts"
	"github.com/grafana/grafana/pkg/services/team"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/setting"
)

var _ pluginaccesscontrol.ActionSetRegistry = (ActionSetService)(nil)

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

	// GetPermissionIDByRoleName returns the permission ID for a given role name and org ID
	GetPermissionIDByRoleName(ctx context.Context, orgID int64, roleName string) (int64, error)
}

func New(cfg *setting.Cfg,
	options Options, features featuremgmt.FeatureToggles, router routing.RouteRegister, license licensing.Licensing,
	ac accesscontrol.AccessControl, service accesscontrol.Service, sqlStore db.DB,
	teamService team.Service, userService user.Service, actionSetService ActionSetService,
) (*Service, error) {
	if options.K8sActionFormat && options.APIGroup == "" {
		return nil, fmt.Errorf("APIGroup is required when K8sActionFormat is enabled")
	}

	permissions := make([]string, 0, len(options.PermissionsToActions))
	actionSet := make(map[string]struct{})
	for permission, actions := range options.PermissionsToActions {
		permissions = append(permissions, permission)
		for _, a := range actions {
			actionSet[a] = struct{}{}
		}
		actionSetService.StoreActionSet(options.GetActionSetName(permission), actions)
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
		ac:           ac,
		features:     features,
		store:        NewStore(cfg, sqlStore, features),
		options:      options,
		license:      license,
		log:          log.New("resourcepermissions"),
		permissions:  permissions,
		actions:      actions,
		sqlStore:     sqlStore,
		service:      service,
		teamService:  teamService,
		userService:  userService,
		actionSetSvc: actionSetService,
	}

	s.api = newApi(cfg, ac, router, s, features, s.options.RestConfigProvider)

	if err := s.declareFixedRoles(); err != nil {
		return nil, err
	}

	s.api.registerEndpoints()

	return s, nil
}

// Service is used to create access control sub system including api / and service for managed resource permission
type Service struct {
	ac       accesscontrol.AccessControl
	features featuremgmt.FeatureToggles
	service  accesscontrol.Service
	store    Store
	api      *api
	license  licensing.Licensing

	log          log.Logger
	options      Options
	permissions  []string
	actions      []string
	sqlStore     db.DB
	teamService  team.Service
	userService  user.Service
	actionSetSvc ActionSetService
}

func (s *Service) GetPermissions(ctx context.Context, user identity.Requester, resourceID string) ([]accesscontrol.ResourcePermission, error) {
	ctx, span := tracer.Start(ctx, "accesscontrol.resourcepermissions.GetPermissions")
	defer span.End()

	var inheritedScopes []string
	if s.options.InheritedScopesSolver != nil {
		var err error
		inheritedScopes, err = s.options.InheritedScopesSolver(ctx, user.GetOrgID(), resourceID)
		if err != nil {
			return nil, err
		}
	}

	actions := s.actions
	for _, action := range s.actions {
		actionSets := s.actionSetSvc.ResolveAction(action)
		for _, actionSet := range actionSets {
			if !slices.Contains(actions, actionSet) {
				actions = append(actions, actionSet)
			}
		}
	}

	resourcePermissions, err := s.store.GetResourcePermissions(ctx, user.GetOrgID(), GetResourcePermissionsQuery{
		User:                 user,
		Actions:              actions,
		Resource:             s.scopeResource(),
		ResourceID:           resourceID,
		ResourceAttribute:    s.options.ResourceAttribute,
		InheritedScopes:      inheritedScopes,
		OnlyManaged:          s.options.OnlyManaged,
		EnforceAccessControl: s.license.FeatureEnabled("accesscontrol.enforcement"),
	})
	if err != nil {
		return nil, err
	}

	for i := range resourcePermissions {
		actions := resourcePermissions[i].Actions
		var expandedActions []string
		for _, action := range actions {
			if isActionSetEnabledResource(action) {
				actionSetActions := s.actionSetSvc.ResolveActionSet(action)
				if len(actionSetActions) > 0 {
					// Folders and routes: expand all actions unconditionally (no inherited scope filtering needed).
					if s.options.Resource == folder.ScopeFoldersRoot || s.options.Resource == accesscontrol.AlertingRoutesResource {
						expandedActions = append(expandedActions, actionSetActions...)
						continue
					}
					// Dashboards: filter to only include actions relevant to the resource
					// to avoid leaking inherited folder actions.
					for _, actionSetAction := range actionSetActions {
						if slices.Contains(s.actions, actionSetAction) {
							expandedActions = append(expandedActions, actionSetAction)
						}
					}
					continue
				}
			}
			expandedActions = append(expandedActions, action)
		}
		resourcePermissions[i].Actions = expandedActions
	}

	return resourcePermissions, nil
}

// GetPermissionsWithActions queries permissions for a resource with specific actions.
// Unlike GetPermissions, this allows querying for actions outside the service's configured action set.
func (s *Service) GetPermissionsWithActions(ctx context.Context, user identity.Requester, resourceID string, actions []string) ([]accesscontrol.ResourcePermission, error) {
	ctx, span := tracer.Start(ctx, "accesscontrol.resourcepermissions.GetPermissionsWithActions")
	defer span.End()

	return s.store.GetResourcePermissions(ctx, user.GetOrgID(), GetResourcePermissionsQuery{
		User:                 user,
		Actions:              actions,
		Resource:             s.scopeResource(),
		ResourceID:           resourceID,
		ResourceAttribute:    s.options.ResourceAttribute,
		OnlyManaged:          true,
		EnforceAccessControl: false,
	})
}

func (s *Service) SetUserPermission(ctx context.Context, orgID int64, user accesscontrol.User, resourceID, permission string) (*accesscontrol.ResourcePermission, error) {
	ctx, span := tracer.Start(ctx, "accesscontrol.resourcepermissions.SetUserPermission")
	defer span.End()

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

	var datasourceType string
	if s.options.DatasourceTypeResolver != nil && resourceID != "*" {
		if t, err := s.options.DatasourceTypeResolver(ctx, orgID, resourceID); err == nil {
			datasourceType = t
		}
	}

	return s.store.SetUserResourcePermission(ctx, orgID, user, SetResourcePermissionCommand{
		Actions:           actions,
		Permission:        permission,
		Resource:          s.scopeResource(),
		ResourceID:        resourceID,
		ResourceAttribute: s.options.ResourceAttribute,
		DatasourceType:    datasourceType,
	}, s.options.OnSetUser)
}

func (s *Service) SetTeamPermission(ctx context.Context, orgID, teamID int64, resourceID, permission string) (*accesscontrol.ResourcePermission, error) {
	ctx, span := tracer.Start(ctx, "accesscontrol.resourcepermissions.SetTeamPermission")
	defer span.End()

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

	var datasourceType string
	if s.options.DatasourceTypeResolver != nil && resourceID != "*" {
		if t, err := s.options.DatasourceTypeResolver(ctx, orgID, resourceID); err == nil {
			datasourceType = t
		}
	}

	return s.store.SetTeamResourcePermission(ctx, orgID, teamID, SetResourcePermissionCommand{
		Actions:           actions,
		Permission:        permission,
		Resource:          s.scopeResource(),
		ResourceID:        resourceID,
		ResourceAttribute: s.options.ResourceAttribute,
		DatasourceType:    datasourceType,
	}, s.options.OnSetTeam)
}

func (s *Service) SetBuiltInRolePermission(ctx context.Context, orgID int64, builtInRole, resourceID, permission string) (*accesscontrol.ResourcePermission, error) {
	ctx, span := tracer.Start(ctx, "accesscontrol.resourcepermissions.SetBuiltInRolePermission")
	defer span.End()

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

	var datasourceType string
	if s.options.DatasourceTypeResolver != nil && resourceID != "*" {
		if t, err := s.options.DatasourceTypeResolver(ctx, orgID, resourceID); err == nil {
			datasourceType = t
		}
	}

	return s.store.SetBuiltInResourcePermission(ctx, orgID, builtInRole, SetResourcePermissionCommand{
		Actions:           actions,
		Permission:        permission,
		Resource:          s.scopeResource(),
		ResourceID:        resourceID,
		ResourceAttribute: s.options.ResourceAttribute,
		DatasourceType:    datasourceType,
	}, s.options.OnSetBuiltInRole)
}

// SetBuiltInRolePermissionRaw sets permission for managed builtin role on a resource using raw actions.
// Unlike SetBuiltInRolePermission, this method takes actions directly instead of a permission name.
func (s *Service) SetBuiltInRolePermissionRaw(ctx context.Context, orgID int64, builtInRole string, cmd SetResourcePermissionCommand) (*accesscontrol.ResourcePermission, error) {
	ctx, span := tracer.Start(ctx, "accesscontrol.resourcepermissions.SetBuiltInRolePermissionRaw")
	defer span.End()

	if err := s.validateBuiltinRole(ctx, builtInRole); err != nil {
		return nil, err
	}

	if err := s.validateResource(ctx, orgID, cmd.ResourceID); err != nil {
		return nil, err
	}

	return s.store.SetBuiltInResourcePermission(ctx, orgID, builtInRole, cmd, s.options.OnSetBuiltInRole)
}

func (s *Service) SetPermissions(
	ctx context.Context, orgID int64, resourceID string,
	commands ...accesscontrol.SetResourcePermissionCommand,
) ([]accesscontrol.ResourcePermission, error) {
	ctx, span := tracer.Start(ctx, "accesscontrol.resourcepermissions.SetPermissions")
	defer span.End()

	if err := s.validateResource(ctx, orgID, resourceID); err != nil {
		return nil, err
	}

	var datasourceType string
	if s.options.DatasourceTypeResolver != nil && resourceID != "*" {
		if t, err := s.options.DatasourceTypeResolver(ctx, orgID, resourceID); err == nil {
			datasourceType = t
		}
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

		dbCommands = append(dbCommands, SetResourcePermissionsCommand{
			User:        accesscontrol.User{ID: cmd.UserID},
			TeamID:      cmd.TeamID,
			BuiltinRole: cmd.BuiltinRole,
			SetResourcePermissionCommand: SetResourcePermissionCommand{
				Actions:           actions,
				Resource:          s.scopeResource(),
				ResourceID:        resourceID,
				ResourceAttribute: s.options.ResourceAttribute,
				Permission:        cmd.Permission,
				DatasourceType:    datasourceType,
			},
		})
	}

	return s.store.SetResourcePermissions(ctx, orgID, dbCommands, ResourceHooks{
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

func (s *Service) DeleteResourcePermissions(ctx context.Context, orgID int64, resourceID string) error {
	return s.store.DeleteResourcePermissions(ctx, orgID, &DeleteResourcePermissionsCmd{
		Resource:          s.scopeResource(),
		ResourceAttribute: s.options.ResourceAttribute,
		ResourceID:        resourceID,
	})
}

func (s *Service) mapPermission(permission string) ([]string, error) {
	if permission == "" {
		return []string{}, nil
	}

	var actions []string

	// Write action sets for folders and dashboards
	if s.options.Resource == folder.ScopeFoldersRoot || s.options.Resource == dashboards.ScopeDashboardsRoot {
		actions = append(actions, s.options.GetActionSetName(permission))

		// If we only want to store action sets, return now
		//nolint:staticcheck // not yet migrated to OpenFeature
		if s.features.IsEnabledGlobally(featuremgmt.FlagOnlyStoreActionSets) {
			return actions, nil
		}
	}

	// Write action set token for service accounts. Granular actions are also written until
	// FlagOnlyStoreServiceAccountActionSets is enabled (after the backfill migration has run).
	if s.options.Resource == serviceaccounts.ScopeServiceAccountRoot {
		actions = append(actions, s.options.GetActionSetName(permission))

		onlyActionSets, _ := openfeature.NewDefaultClient().BooleanValue(context.Background(), featuremgmt.FlagOnlyStoreServiceAccountActionSets, false, openfeature.EvaluationContext{})
		if onlyActionSets {
			return actions, nil
		}
	}

	// New resources with no legacy granular data go straight to action-set-only.
	if s.options.Resource == accesscontrol.AlertingRoutesResource {
		return []string{s.options.GetActionSetName(permission)}, nil
	}

	for k, v := range s.options.PermissionsToActions {
		if permission == k {
			actions = append(actions, v...)
			return actions, nil
		}
	}
	return nil, ErrInvalidPermission.Build(ErrInvalidPermissionData(permission))
}

func (s *Service) validateResource(ctx context.Context, orgID int64, resourceID string) error {
	ctx, span := tracer.Start(ctx, "accesscontrol.resourcepermissions.validateResource")
	defer span.End()

	if resourceID == "*" {
		return ErrInvalidResourceID.Build(ErrInvalidResourceIDData(resourceID))
	}

	if s.options.ResourceValidator != nil {
		return s.options.ResourceValidator(ctx, orgID, resourceID)
	}
	return nil
}

func (s *Service) validateUser(ctx context.Context, orgID, userID int64) error {
	ctx, span := tracer.Start(ctx, "accesscontrol.resourcepermissions.validateUser")
	defer span.End()

	if !s.options.Assignments.Users {
		return ErrInvalidAssignment.Build(ErrInvalidAssignmentData("users"))
	}

	_, err := s.userService.GetSignedInUser(ctx, &user.GetSignedInUserQuery{OrgID: orgID, UserID: userID})
	switch {
	case errors.Is(err, user.ErrUserNotFound):
		return accesscontrol.ErrAssignmentEntityNotFound.Build(accesscontrol.ErrAssignmentEntityNotFoundData("user"))
	default:
		return err
	}
}

func (s *Service) validateTeam(ctx context.Context, orgID, teamID int64) error {
	ctx, span := tracer.Start(ctx, "accesscontrol.resourcepermissions.validateTeam")
	defer span.End()

	if !s.options.Assignments.Teams {
		return ErrInvalidAssignment.Build(ErrInvalidAssignmentData("teams"))
	}

	if _, err := s.teamService.GetTeamByID(ctx, &team.GetTeamByIDQuery{OrgID: orgID, ID: teamID}); err != nil {
		switch {
		case errors.Is(err, team.ErrTeamNotFound):
			return accesscontrol.ErrAssignmentEntityNotFound.Build(accesscontrol.ErrAssignmentEntityNotFoundData("team"))
		default:
			return err
		}
	}
	return nil
}

func (s *Service) validateBuiltinRole(ctx context.Context, builtinRole string) error {
	_, span := tracer.Start(ctx, "accesscontrol.resourcepermissions.validateBuiltinRole")
	defer span.End()

	if !s.options.Assignments.BuiltInRoles {
		return ErrInvalidAssignment.Build(ErrInvalidAssignmentData("builtInRoles"))
	}

	if err := accesscontrol.ValidateBuiltInRoles([]string{builtinRole}); err != nil {
		return err
	}
	return nil
}

func (s *Service) declareFixedRoles() error {
	scopeAll := s.options.GetScope("*")
	readerRole := accesscontrol.RoleRegistration{
		Role: accesscontrol.RoleDTO{
			Name:        s.options.GetRoleName("reader"),
			DisplayName: s.options.ReaderRoleName,
			Group:       s.options.RoleGroup,
			Permissions: []accesscontrol.Permission{
				{Action: s.options.GetAction("read"), Scope: scopeAll},
			},
		},
		Grants: []string{string(org.RoleAdmin)},
	}

	writerRole := accesscontrol.RoleRegistration{
		Role: accesscontrol.RoleDTO{
			Name:        s.options.GetRoleName("writer"),
			DisplayName: s.options.WriterRoleName,
			Group:       s.options.RoleGroup,
			Permissions: accesscontrol.ConcatPermissions(readerRole.Role.Permissions, []accesscontrol.Permission{
				{Action: s.options.GetAction("write"), Scope: scopeAll},
			}),
		},
		Grants: []string{string(org.RoleAdmin)},
	}

	return s.service.DeclareFixedRoles(readerRole, writerRole)
}

type ActionSetService interface {
	// ActionResolver defines method for expanding permissions from permissions with action sets to fine-grained permissions.
	// We use an ActionResolver interface to avoid circular dependencies
	accesscontrol.ActionResolver

	// ResolveAction returns all the action sets that the action belongs to.
	ResolveAction(action string) []string
	// ResolveActionSet resolves an action set to a list of corresponding actions.
	ResolveActionSet(actionSet string) []string
	// StoreActionSet stores action set. If a set with the given name has already been stored, the new actions will be appended to the existing actions.
	StoreActionSet(name string, actions []string)

	pluginaccesscontrol.ActionSetRegistry
}

// ActionSet is a struct that represents a set of actions that can be performed on a resource.
// An example of an action set is "folders:edit" which represents the set of RBAC actions that are granted by edit access to a folder.
type ActionSet struct {
	Action  string   `json:"action"`
	Actions []string `json:"actions"`
}

type ActionSetStore interface {
	// StoreActionSet stores action set. If a set with the given name has already been stored, the new actions will be appended to the existing actions.
	StoreActionSet(name string, actions []string)
	// ResolveActionSet resolves an action set to a list of corresponding actions.
	ResolveActionSet(actionSet string) []string
	// ResolveAction returns all the action sets that the action belongs to.
	ResolveAction(action string) []string
	// ResolveActionPrefix returns all action sets that include at least one action with the specified prefix
	ResolveActionPrefix(prefix string) []string
	// ExpandActionSetsWithFilter takes a set of permissions that might include some action set permissions, and returns a set of permissions with action sets expanded into underlying permissions.
	// When action sets are expanded into the underlying permissions only those permissions whose action is matched by actionMatcher are included.
	ExpandActionSetsWithFilter(permissions []accesscontrol.Permission, actionMatcher func(action string) bool) []accesscontrol.Permission
}

type ActionSetSvc struct {
	store ActionSetStore
}

// NewActionSetService returns a new instance of InMemoryActionSetService.
func NewActionSetService() ActionSetService {
	return &ActionSetSvc{
		store: NewInMemoryActionSetStore(),
	}
}

// ResolveAction returns all the action sets that the action belongs to.
func (a *ActionSetSvc) ResolveAction(action string) []string {
	sets := a.store.ResolveAction(action)
	filteredSets := make([]string, 0, len(sets))
	for _, set := range sets {
		if !isActionSetEnabledResource(set) {
			continue
		}
		filteredSets = append(filteredSets, set)
	}

	return filteredSets
}

// ResolveActionPrefix returns all action sets that include at least one action with the specified prefix
func (a *ActionSetSvc) ResolveActionPrefix(actionPrefix string) []string {
	sets := a.store.ResolveActionPrefix(actionPrefix)
	filteredSets := make([]string, 0, len(sets))
	for _, set := range sets {
		if !isActionSetEnabledResource(set) {
			continue
		}
		filteredSets = append(filteredSets, set)
	}

	return filteredSets
}

// ResolveActionSet resolves an action set to a list of corresponding actions.
func (a *ActionSetSvc) ResolveActionSet(actionSet string) []string {
	if !isActionSetEnabledResource(actionSet) {
		return nil
	}
	return a.store.ResolveActionSet(actionSet)
}

// StoreActionSet stores action set. If a set with the given name has already been stored, the new actions will be appended to the existing actions.
func (a *ActionSetSvc) StoreActionSet(name string, actions []string) {
	// To avoid backwards incompatible changes, we don't want to store these actions in the DB
	// Once action sets are fully enabled, we can include folder.ActionFoldersCreate in the list of other folder edit/admin actions
	// Tracked in https://github.com/grafana/identity-access-team/issues/794
	if name == "folders:edit" || name == "folders:admin" {
		if !slices.Contains(a.ResolveActionSet(name), folder.ActionFoldersCreate) {
			actions = append(actions, folder.ActionFoldersCreate)
		}
	}

	a.store.StoreActionSet(name, actions)
}

// ExpandActionSets takes a set of permissions that might include some action set permissions, and returns a set of permissions with action sets expanded into underlying permissions
func (a *ActionSetSvc) ExpandActionSets(permissions []accesscontrol.Permission) []accesscontrol.Permission {
	actionMatcher := func(_ string) bool {
		return true
	}
	return a.ExpandActionSetsWithFilter(permissions, actionMatcher)
}

// ExpandActionSetsWithFilter works like ExpandActionSets, but it also takes a function for action filtering. When action sets are expanded into the underlying permissions,
// only those permissions whose action is matched by actionMatcher are included.
func (a *ActionSetSvc) ExpandActionSetsWithFilter(permissions []accesscontrol.Permission, actionMatcher func(action string) bool) []accesscontrol.Permission {
	return a.store.ExpandActionSetsWithFilter(permissions, actionMatcher)
}

// RegisterActionSets allow the caller to expand the existing action sets with additional permissions
// This is intended to be used by plugins, and currently supports extending folder and dashboard action sets
func (a *ActionSetSvc) RegisterActionSets(ctx context.Context, pluginID string, registrations []plugins.ActionSet) error {
	_, span := tracer.Start(ctx, "accesscontrol.resourcepermissions.RegisterActionSets")
	defer span.End()

	for _, reg := range registrations {
		if err := pluginutils.ValidatePluginActionSet(pluginID, reg); err != nil {
			return err
		}
		a.StoreActionSet(reg.Action, reg.Actions)
	}
	return nil
}

func isActionSetEnabledResource(action string) bool {
	return strings.HasPrefix(action, dashboards.ScopeDashboardsRoot) ||
		strings.HasPrefix(action, folder.ScopeFoldersRoot) ||
		strings.HasPrefix(action, accesscontrol.AlertingRoutesKind) ||
		strings.HasPrefix(action, serviceaccounts.ScopeServiceAccountRoot)
}

// scopeResource returns the resource prefix used for Resource fields in commands/queries.
// K8s:    "dashboard.grafana.app/dashboards"
// Legacy: "dashboards"
func (s *Service) scopeResource() string {
	if s.options.K8sActionFormat {
		return fmt.Sprintf("%s/%s", s.options.APIGroup, s.options.Resource)
	}
	return s.options.Resource
}
