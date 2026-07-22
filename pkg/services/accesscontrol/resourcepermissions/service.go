package resourcepermissions

import (
	"context"
	"errors"
	"fmt"
	"slices"
	"sort"
	"strings"

	"github.com/open-feature/go-sdk/openfeature"

	iamv0 "github.com/grafana/grafana/apps/iam/pkg/apis/iam/v0alpha1"
	"github.com/grafana/grafana/pkg/api/routing"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/accesscontrol/pluginutils"
	"github.com/grafana/grafana/pkg/services/apiserver/endpoints/request"
	"github.com/grafana/grafana/pkg/services/contexthandler"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/datasources"
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
	// Fail fast at startup if a Kubernetes-native flow needs an APIGroup but none
	// is configured.
	if options.APIGroup == "" && requiresAPIGroup(context.Background(), options.Resource, options.K8sActionFormat) {
		return nil, fmt.Errorf("APIGroup is required for resource %q when Kubernetes-native permissions are enabled (K8sActionFormat or the resource-permission redirect)", options.Resource)
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
		cfg:          cfg,
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

	cfg          *setting.Cfg
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

	// teamsRedirectRemovedMember records that the K8s teams redirect below actually
	// removed an existing member. In dual-write modes (Mode1-3) legacy is the primary
	// target of that write, so the legacy write further down then finds the row
	// already gone. A no-op redirect (the member wasn't there) leaves this false, so
	// a genuinely-absent member still surfaces the legacy error.
	teamsRedirectRemovedMember := false

	// Teams-specific redirect: write the membership to Team.Spec.Members via the
	// K8s API. The HTTP handler (api.setUserPermission) already does this, but
	// callers that invoke the service directly (not through the handler) need the
	// same redirect, so it lives here too. In unified-authoritative modes (Mode4/5)
	// the legacy team_member table has no row to write, so we must not fall back to it.
	if s.teamsMembershipRedirectEnabled(ctx) {
		removed, k8sErr := setTeamMembership(s, ctx, orgID, resourceID, user.ID, permission)
		if errors.Is(k8sErr, ErrExternalTeamMember) {
			return nil, k8sErr
		}
		if k8sErr == nil {
			teamsRedirectRemovedMember = removed
		}
		if s.unifiedTeamStorageIsAuthoritative() {
			if k8sErr != nil {
				return nil, k8sErr
			}
			s.clearUserPermissionCache(orgID, user.ID)
			return &accesscontrol.ResourcePermission{Actions: actions, UserID: user.ID}, nil
		}
		if k8sErr != nil {
			s.log.Warn("Failed to set team member via k8s API, falling back to legacy", "error", k8sErr, "resourceID", resourceID)
		}
	}

	var datasourceType string
	if s.options.DatasourceTypeResolver != nil && resourceID != "*" {
		if t, err := s.options.DatasourceTypeResolver(ctx, orgID, resourceID); err == nil {
			datasourceType = t
		}
	}

	result, err := s.store.SetUserResourcePermission(ctx, orgID, user, SetResourcePermissionCommand{
		Actions:           actions,
		Permission:        permission,
		Resource:          s.scopeResource(),
		ResourceID:        resourceID,
		ResourceAttribute: s.options.ResourceAttribute,
		DatasourceType:    datasourceType,
	}, s.options.OnSetUser)

	if err != nil {
		// The teams redirect above already removed the member (and, in dual-write
		// modes, the legacy team_member row), so this legacy removal finds nothing.
		if teamsRedirectRemovedMember && errors.Is(err, team.ErrTeamMemberNotFound) {
			s.clearUserPermissionCache(orgID, user.ID)
			return &accesscontrol.ResourcePermission{Actions: actions, UserID: user.ID}, nil
		}
		return nil, err
	}

	s.clearUserPermissionCache(orgID, user.ID)

	return result, nil
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

	// teamsRedirectRemovedMember mirrors SetUserPermission: the K8s teams redirect
	// below removed at least one existing member, so in dual-write modes the legacy
	// removals further down find the rows already gone.
	teamsRedirectRemovedMember := false

	// Teams-specific redirect: reconcile each membership through Team.Spec.Members
	// via the K8s API (see SetUserPermission for the rationale). Team permissions
	// only support user assignments (see Assignments in ProvideTeamPermissions), so
	// only user commands are routed.
	if s.teamsMembershipRedirectEnabled(ctx) {
		var k8sErr error
		for _, cmd := range commands {
			if cmd.UserID == 0 {
				continue
			}
			removed, err := setTeamMembership(s, ctx, orgID, resourceID, cmd.UserID, cmd.Permission)
			if err != nil {
				if errors.Is(err, ErrExternalTeamMember) {
					return nil, err
				}
				k8sErr = err
				continue
			}
			teamsRedirectRemovedMember = teamsRedirectRemovedMember || removed
		}
		if s.unifiedTeamStorageIsAuthoritative() {
			if k8sErr != nil {
				return nil, k8sErr
			}
			s.clearUserPermissionCaches(orgID, commands)
			return []accesscontrol.ResourcePermission{}, nil
		}
		if k8sErr != nil {
			s.log.Warn("Failed to set team members via k8s API, falling back to legacy", "error", k8sErr, "resourceID", resourceID)
		}
	}

	result, err := s.store.SetResourcePermissions(ctx, orgID, dbCommands, ResourceHooks{
		User:        s.options.OnSetUser,
		Team:        s.options.OnSetTeam,
		BuiltInRole: s.options.OnSetBuiltInRole,
	})
	if err != nil {
		// The teams redirect above already removed the member (and, in dual-write
		// modes, the legacy team_member row), so this legacy removal finds nothing.
		if teamsRedirectRemovedMember && errors.Is(err, team.ErrTeamMemberNotFound) {
			s.clearUserPermissionCaches(orgID, commands)
			return []accesscontrol.ResourcePermission{}, nil
		}
		return nil, err
	}

	s.clearUserPermissionCaches(orgID, commands)

	return result, nil
}

// clearUserPermissionCaches clears the permission cache of every user assigned by
// the given commands.
func (s *Service) clearUserPermissionCaches(orgID int64, commands []accesscontrol.SetResourcePermissionCommand) {
	clearedUsers := make(map[int64]bool)
	for _, cmd := range commands {
		if cmd.UserID != 0 && !clearedUsers[cmd.UserID] {
			s.clearUserPermissionCache(orgID, cmd.UserID)
			clearedUsers[cmd.UserID] = true
		}
	}
}

// teamsMembershipRedirectEnabled reports whether team membership writes for this
// service should be routed to Team.Spec.Members via the K8s API instead of the
// legacy team_member table. It mirrors the gate used by the HTTP handlers
// (api.setUserPermission) so direct service callers behave identically.
func (s *Service) teamsMembershipRedirectEnabled(ctx context.Context) bool {
	return s.options.Resource == "teams" &&
		ofClient.Boolean(ctx, featuremgmt.FlagKubernetesTeamsRedirect, false, openfeature.TransactionContext(ctx))
}

// unifiedTeamStorageIsAuthoritative reports whether unified storage is the
// authoritative backend for teams (dualWriterMode > Mode3). When true, the legacy
// team_member table is not written, so team membership must succeed against the
// K8s API and callers must not fall back to legacy.
func (s *Service) unifiedTeamStorageIsAuthoritative() bool {
	return unifiedStorageIsAuthoritative(s.cfg, iamv0.TeamResourceInfo.GroupResource().String())
}

// setTeamMembership writes a single team membership to Team.Spec.Members via the
// K8s API. The bool reports whether an existing member was removed.
//
// Stubbable by tests.
var setTeamMembership = func(s *Service, ctx context.Context, orgID int64, resourceID string, userID int64, permission string) (bool, error) {
	return s.setTeamMemberViaK8s(ctx, orgID, resourceID, userID, permission)
}

// setTeamMemberViaK8s writes a single team membership to Team.Spec.Members via the
// K8s API for callers that invoke the service directly (not through the HTTP
// handler). It reuses the same read-modify-write helper as the HTTP teams redirect,
// building the client from the ReqContext the contexthandler middleware stored on
// ctx and deriving the namespace from orgID the same way the team K8s service does.
// The bool reports whether an existing member was removed.
func (s *Service) setTeamMemberViaK8s(ctx context.Context, orgID int64, resourceID string, userID int64, permission string) (bool, error) {
	reqCtx := contexthandler.FromContext(ctx)
	if reqCtx == nil {
		return false, ErrRestConfigNotAvailable
	}
	dynamicClient, err := newDynamicClient(s.options.RestConfigProvider, reqCtx)
	if err != nil {
		return false, err
	}
	namespace := request.GetNamespaceMapper(s.cfg)(orgID)
	return s.setTeamMember(ctx, dynamicClient, orgID, namespace, resourceID, userID, permission)
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

// clearUserPermissionCache invalidates the RBAC permission cache for a user.
// It clears both regular user and service account cache keys since we don't
// know the identity type from just the user ID.
func (s *Service) clearUserPermissionCache(orgID int64, userID int64) {
	s.service.ClearUserPermissionCache(&user.SignedInUser{
		OrgID:  orgID,
		UserID: userID,
	})
	s.service.ClearUserPermissionCache(&user.SignedInUser{
		OrgID:            orgID,
		UserID:           userID,
		IsServiceAccount: true,
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

	// Write action set token for datasources. Granular actions are also written until
	// FlagIamOnlyStoreDatasourceActionSets is enabled (after the backfill migration has run).
	if s.options.Resource == datasources.ScopeRoot {
		actions = append(actions, s.options.GetActionSetName(permission))

		onlyActionSets, _ := openfeature.NewDefaultClient().BooleanValue(context.Background(), featuremgmt.FlagIamOnlyStoreDatasourceActionSets, false, openfeature.EvaluationContext{})
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

// FixedRoleRegistrations returns the templated reader/writer fixed-role
// registrations derived from the given Options (fixed:{resource}.permissions:reader
// and :writer). It is the single source of truth for how per-resource permission
// management roles are generated, shared by the live service ([Service.declareFixedRoles])
// and the GlobalRole seeder aggregation so the two cannot drift. Only the
// role-identity fields of Options are read (Resource, APIGroup, K8sActionFormat,
// ReaderRoleName, WriterRoleName, RoleGroup); the runtime closures are ignored.
func FixedRoleRegistrations(o Options) []accesscontrol.RoleRegistration {
	scopeAll := o.GetScope("*")
	readerRole := accesscontrol.RoleRegistration{
		Role: accesscontrol.RoleDTO{
			Name:        o.GetRoleName("reader"),
			DisplayName: o.ReaderRoleName,
			Group:       o.RoleGroup,
			Permissions: []accesscontrol.Permission{
				{Action: o.GetAction("read"), Scope: scopeAll},
			},
		},
		Grants: []string{string(org.RoleAdmin)},
	}

	writerRole := accesscontrol.RoleRegistration{
		Role: accesscontrol.RoleDTO{
			Name:        o.GetRoleName("writer"),
			DisplayName: o.WriterRoleName,
			Group:       o.RoleGroup,
			Permissions: accesscontrol.ConcatPermissions(readerRole.Role.Permissions, []accesscontrol.Permission{
				{Action: o.GetAction("write"), Scope: scopeAll},
			}),
		},
		Grants: []string{string(org.RoleAdmin)},
	}

	return []accesscontrol.RoleRegistration{readerRole, writerRole}
}

func (s *Service) declareFixedRoles() error {
	return s.service.DeclareFixedRoles(FixedRoleRegistrations(s.options)...)
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
		strings.HasPrefix(action, serviceaccounts.ScopeServiceAccountRoot) ||
		strings.HasPrefix(action, datasources.ScopeRoot)
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

// requiresAPIGroup reports whether a resource-permission service must have an
// APIGroup configured, since it can no longer be guessed (see getAPIGroup). It is
// required for any Kubernetes-native flow:
//   - K8sActionFormat is enabled (K8s-format actions/scopes), or
//   - the resource-permission redirect is enabled for a resource that routes
//     through the generic K8s adapter.
//
// The redirect gate is read through the same OpenFeature helper used at runtime
// (k8sResourcePermissionRedirectEnabled), so this startup check stays aligned with
// when getAPIGroup is actually exercised. Called at construction with a background
// context, so it sees the global flag values; per-tenant overrides are still
// guarded at runtime by getAPIGroup.
func requiresAPIGroup(ctx context.Context, resource string, k8sActionFormat bool) bool {
	if k8sActionFormat {
		return true
	}

	// These resources never resolve a single static APIGroup via getAPIGroup, so
	// they are exempt from the redirect requirement:
	//   - teams use the Team.Spec.Members path: the `Resource != "teams"` guards in
	//     api.go dispatch to the member helpers in api_adapter.go, which never
	//     resolve an APIGroup.
	//   - datasources resolve a per-plugin group at request time (the group is a
	//     wildcard, e.g. loki.datasource.grafana.app, configured in
	//     pkg/extensions/accesscontrol/permission_services.go), so there is no
	//     single value.
	switch resource {
	case iamv0.TeamResourceInfo.GetName(), datasources.ScopeRoot:
		return false
	}

	return k8sResourcePermissionRedirectEnabled(ctx)
}
