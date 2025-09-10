package acimpl

import (
	"context"
	"fmt"
	"slices"
	"strconv"
	"strings"
	"time"

	"github.com/prometheus/client_golang/prometheus"
	"go.opentelemetry.io/otel/attribute"

	claims "github.com/grafana/authlib/types"

	"github.com/grafana/grafana/pkg/api/routing"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/infra/localcache"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/metrics"
	"github.com/grafana/grafana/pkg/infra/serverlock"
	"github.com/grafana/grafana/pkg/infra/slugify"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/accesscontrol/api"
	"github.com/grafana/grafana/pkg/services/accesscontrol/database"
	"github.com/grafana/grafana/pkg/services/accesscontrol/migrator"
	"github.com/grafana/grafana/pkg/services/accesscontrol/permreg"
	"github.com/grafana/grafana/pkg/services/accesscontrol/pluginutils"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/folder"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/pluginaccesscontrol"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/setting"
)

var _ pluginaccesscontrol.RoleRegistry = &Service{}

const (
	cacheTTL = 60 * time.Second
)

var SharedWithMeFolderPermission = accesscontrol.Permission{
	Action: dashboards.ActionFoldersRead,
	Scope:  dashboards.ScopeFoldersProvider.GetResourceScopeUID(folder.SharedWithMeFolderUID),
}

var OSSRolesPrefixes = []string{accesscontrol.ManagedRolePrefix, accesscontrol.ExternalServiceRolePrefix}

func ProvideService(
	cfg *setting.Cfg, db db.DB, routeRegister routing.RouteRegister, cache *localcache.CacheService,
	accessControl accesscontrol.AccessControl, userService user.Service, actionResolver accesscontrol.ActionResolver,
	features featuremgmt.FeatureToggles, tracer tracing.Tracer, permRegistry permreg.PermissionRegistry,
	lock *serverlock.ServerLockService,
) (*Service, error) {
	service := ProvideOSSService(
		cfg,
		database.ProvideService(db),
		actionResolver,
		cache,
		features,
		tracer,
		db,
		permRegistry,
		lock,
	)

	api.NewAccessControlAPI(routeRegister, accessControl, service, userService).RegisterAPIEndpoints()
	if err := accesscontrol.DeclareFixedRoles(service, cfg); err != nil {
		return nil, err
	}

	// Migrating scopes that haven't been split yet to have kind, attribute and identifier in the DB
	// This will be removed once we've:
	// 1) removed the feature toggle and
	// 2) have released enough versions not to support a version without split scopes
	if err := migrator.MigrateScopeSplit(db, service.log); err != nil {
		return nil, err
	}

	// Migrating to remove deprecated permissions from the database
	if err := migrator.MigrateRemoveDeprecatedPermissions(db, service.log); err != nil {
		return nil, err
	}

	return service, nil
}

func ProvideOSSService(
	cfg *setting.Cfg, store accesscontrol.Store, actionResolver accesscontrol.ActionResolver,
	cache *localcache.CacheService, features featuremgmt.FeatureToggles, tracer tracing.Tracer,
	db db.DB, permRegistry permreg.PermissionRegistry, lock *serverlock.ServerLockService,
) *Service {
	s := &Service{
		actionResolver: actionResolver,
		cache:          cache,
		cfg:            cfg,
		features:       features,
		log:            log.New("accesscontrol.service"),
		roles:          accesscontrol.BuildBasicRoleDefinitions(),
		store:          store,
		permRegistry:   permRegistry,
	}

	return s
}

// Service is the service implementing role based access control.
type Service struct {
	actionResolver accesscontrol.ActionResolver
	cache          *localcache.CacheService
	cfg            *setting.Cfg
	features       featuremgmt.FeatureToggles
	log            log.Logger
	registrations  accesscontrol.RegistrationList
	roles          map[string]*accesscontrol.RoleDTO
	store          accesscontrol.Store
	permRegistry   permreg.PermissionRegistry
}

func (s *Service) GetUsageStats(_ context.Context) map[string]any {
	return map[string]any{
		"stats.oss.accesscontrol.enabled.count": 1,
	}
}

// GetUserPermissions returns user permissions based on built-in roles
func (s *Service) GetUserPermissions(ctx context.Context, user identity.Requester, options accesscontrol.Options) ([]accesscontrol.Permission, error) {
	ctx, span := tracer.Start(ctx, "accesscontrol.acimpl.GetUserPermissions")
	defer span.End()

	timer := prometheus.NewTimer(metrics.MAccessPermissionsSummary)
	defer timer.ObserveDuration()

	if !s.cfg.RBAC.PermissionCache || !user.HasUniqueId() {
		return s.getUserPermissions(ctx, user, options)
	}

	return s.getCachedUserPermissions(ctx, user, options)
}

func (s *Service) getUserPermissions(ctx context.Context, user identity.Requester, _ accesscontrol.Options) ([]accesscontrol.Permission, error) {
	ctx, span := tracer.Start(ctx, "accesscontrol.acimpl.getUserPermissions")
	defer span.End()

	permissions := make([]accesscontrol.Permission, 0)
	for _, builtin := range accesscontrol.GetOrgRoles(user) {
		if basicRole, ok := s.roles[builtin]; ok {
			permissions = append(permissions, basicRole.Permissions...)
		}
	}
	permissions = append(permissions, SharedWithMeFolderPermission)

	// we don't care about the error here, if this fails we get 0 and no
	// permission assigned to user will be returned, only for org role.
	userID, _ := identity.UserIdentifier(user.GetID())

	dbPermissions, err := s.store.GetUserPermissions(ctx, accesscontrol.GetUserPermissionsQuery{
		OrgID:        user.GetOrgID(),
		UserID:       userID,
		Roles:        accesscontrol.GetOrgRoles(user),
		TeamIDs:      user.GetTeams(),
		RolePrefixes: OSSRolesPrefixes,
	})
	if err != nil {
		return nil, err
	}

	dbPermissions = s.actionResolver.ExpandActionSets(dbPermissions)
	return append(permissions, dbPermissions...), nil
}

func (s *Service) getBasicRolePermissions(ctx context.Context, role string, orgID int64) ([]accesscontrol.Permission, error) {
	ctx, span := tracer.Start(ctx, "accesscontrol.acimpl.getBasicRolePermissions")
	defer span.End()

	var permissions []accesscontrol.Permission
	if basicRole, ok := s.roles[role]; ok {
		permissions = basicRole.Permissions
	}

	// Fetch managed role permissions assigned to basic roles
	dbPermissions, err := s.store.GetBasicRolesPermissions(ctx, accesscontrol.GetUserPermissionsQuery{
		Roles:        []string{role},
		OrgID:        orgID,
		RolePrefixes: OSSRolesPrefixes,
	})

	dbPermissions = s.actionResolver.ExpandActionSets(dbPermissions)
	return append(permissions, dbPermissions...), err
}

func (s *Service) getTeamsPermissions(ctx context.Context, teamIDs []int64, orgID int64) (map[int64][]accesscontrol.Permission, error) {
	ctx, span := tracer.Start(ctx, "accesscontrol.acimpl.getTeamsPermissions")
	defer span.End()

	teamPermissions, err := s.store.GetTeamsPermissions(ctx, accesscontrol.GetUserPermissionsQuery{
		TeamIDs:      teamIDs,
		OrgID:        orgID,
		RolePrefixes: OSSRolesPrefixes,
	})

	for teamID, permissions := range teamPermissions {
		teamPermissions[teamID] = s.actionResolver.ExpandActionSets(permissions)
	}

	return teamPermissions, err
}

// Returns only permissions directly assigned to user, without basic role and team permissions
func (s *Service) getUserDirectPermissions(ctx context.Context, user identity.Requester) ([]accesscontrol.Permission, error) {
	ctx, span := tracer.Start(ctx, "accesscontrol.acimpl.getUserDirectPermissions")
	defer span.End()

	var userID int64
	if user.IsIdentityType(claims.TypeUser, claims.TypeServiceAccount) {
		var err error
		userID, err = user.GetInternalID()
		if err != nil {
			return nil, err
		}
	}

	permissions, err := s.store.GetUserPermissions(ctx, accesscontrol.GetUserPermissionsQuery{
		OrgID:        user.GetOrgID(),
		UserID:       userID,
		RolePrefixes: OSSRolesPrefixes,
	})
	if err != nil {
		return nil, err
	}

	permissions = s.actionResolver.ExpandActionSets(permissions)
	permissions = append(permissions, SharedWithMeFolderPermission)

	return permissions, nil
}

func (s *Service) getCachedUserPermissions(ctx context.Context, user identity.Requester, options accesscontrol.Options) ([]accesscontrol.Permission, error) {
	ctx, span := tracer.Start(ctx, "accesscontrol.acimpl.getCachedUserPermissions")
	defer span.End()

	permissions, err := s.getCachedBasicRolesPermissions(ctx, user, options)
	if err != nil {
		return nil, err
	}

	teamsPermissions, err := s.getCachedTeamsPermissions(ctx, user, options)
	if err != nil {
		return nil, err
	}
	permissions = append(permissions, teamsPermissions...)

	userManagedPermissions, err := s.getCachedUserDirectPermissions(ctx, user, options)
	if err != nil {
		return nil, err
	}
	permissions = append(permissions, userManagedPermissions...)
	span.SetAttributes(attribute.Int("num_permissions", len(permissions)))

	return permissions, nil
}

func (s *Service) getCachedBasicRolesPermissions(ctx context.Context, user identity.Requester, options accesscontrol.Options) ([]accesscontrol.Permission, error) {
	ctx, span := tracer.Start(ctx, "accesscontrol.acimpl.getCachedBasicRolesPermissions")
	defer span.End()

	// Viewer role has ~30 permissions, so we can pre-allocate memory
	permissions := make([]accesscontrol.Permission, 0, 50)
	basicRoles := accesscontrol.GetOrgRoles(user)
	span.SetAttributes(attribute.Int("roles", len(basicRoles)))
	for _, role := range basicRoles {
		perms, err := s.getCachedBasicRolePermissions(ctx, role, user.GetOrgID(), options)
		span.SetAttributes(attribute.Int(fmt.Sprintf("role_%s_permissions", role), len(perms)))
		if err != nil {
			return nil, err
		}
		permissions = append(permissions, perms...)
	}
	return permissions, nil
}

func (s *Service) getCachedBasicRolePermissions(ctx context.Context, role string, orgID int64, options accesscontrol.Options) ([]accesscontrol.Permission, error) {
	ctx, span := tracer.Start(ctx, "accesscontrol.acimpl.getCachedBasicRolePermissions")
	defer span.End()

	key := accesscontrol.GetBasicRolePermissionCacheKey(role, orgID)
	getPermissionsFn := func(ctx context.Context) ([]accesscontrol.Permission, error) {
		return s.getBasicRolePermissions(ctx, role, orgID)
	}
	return s.getCachedPermissions(ctx, key, getPermissionsFn, options)
}

func (s *Service) getCachedUserDirectPermissions(ctx context.Context, user identity.Requester, options accesscontrol.Options) ([]accesscontrol.Permission, error) {
	ctx, span := tracer.Start(ctx, "accesscontrol.acimpl.getCachedUserDirectPermissions")
	defer span.End()

	key := accesscontrol.GetUserDirectPermissionCacheKey(user)
	getUserPermissionsFn := func(ctx context.Context) ([]accesscontrol.Permission, error) {
		return s.getUserDirectPermissions(ctx, user)
	}
	return s.getCachedPermissions(ctx, key, getUserPermissionsFn, options)
}

type getPermissionsFunc = func(ctx context.Context) ([]accesscontrol.Permission, error)

// Generic method for getting various permissions from cache
func (s *Service) getCachedPermissions(ctx context.Context, key string, getPermissionsFn getPermissionsFunc, options accesscontrol.Options) ([]accesscontrol.Permission, error) {
	ctx, span := tracer.Start(ctx, "accesscontrol.acimpl.getCachedPermissions")
	defer span.End()

	if !options.ReloadCache {
		permissions, ok := s.cache.Get(key)
		if ok {
			span.SetAttributes(attribute.Int("num_permissions_cached", len(permissions.([]accesscontrol.Permission))))
			metrics.MAccessPermissionsCacheUsage.WithLabelValues(accesscontrol.CacheHit).Inc()
			return permissions.([]accesscontrol.Permission), nil
		}
	}

	span.AddEvent("cache miss")
	metrics.MAccessPermissionsCacheUsage.WithLabelValues(accesscontrol.CacheMiss).Inc()
	permissions, err := getPermissionsFn(ctx)
	span.SetAttributes(attribute.Int("num_permissions_fetched", len(permissions)))
	if err != nil {
		return nil, err
	}

	s.cache.Set(key, permissions, cacheTTL)
	return permissions, nil
}

func (s *Service) getCachedTeamsPermissions(ctx context.Context, user identity.Requester, options accesscontrol.Options) ([]accesscontrol.Permission, error) {
	ctx, span := tracer.Start(ctx, "accesscontrol.acimpl.getCachedTeamsPermissions")
	defer span.End()

	teams := user.GetTeams()
	orgID := user.GetOrgID()
	if len(teams) == 0 {
		return []accesscontrol.Permission{}, nil
	}

	miss := make([]int64, 0)
	permissions := make([]accesscontrol.Permission, 0)

	if !options.ReloadCache {
		for _, teamID := range teams {
			key := accesscontrol.GetTeamPermissionCacheKey(teamID, orgID)
			teamPermissions, ok := s.cache.Get(key)
			if ok {
				metrics.MAccessPermissionsCacheUsage.WithLabelValues(accesscontrol.CacheHit).Inc()
				span.SetAttributes(attribute.Int("num_permissions_cached", len(teamPermissions.([]accesscontrol.Permission))))
				permissions = append(permissions, teamPermissions.([]accesscontrol.Permission)...)
			} else {
				miss = append(miss, teamID)
			}
		}
	} else {
		// reload cache and fetch all teams permissions
		miss = teams
	}

	if len(miss) > 0 {
		span.AddEvent("cache miss")
		metrics.MAccessPermissionsCacheUsage.WithLabelValues(accesscontrol.CacheMiss).Inc()
		teamsPermissions, err := s.getTeamsPermissions(ctx, miss, orgID)
		span.SetAttributes(attribute.Int("num_permissions_fetched", len(teamsPermissions)))
		if err != nil {
			return nil, err
		}

		for teamID, teamPermissions := range teamsPermissions {
			key := accesscontrol.GetTeamPermissionCacheKey(teamID, orgID)
			s.cache.Set(key, teamPermissions, cacheTTL)
			permissions = append(permissions, teamPermissions...)
		}
	}

	return permissions, nil
}

func (s *Service) ClearUserPermissionCache(user identity.Requester) {
	s.cache.Delete(accesscontrol.GetUserDirectPermissionCacheKey(user))
}

func (s *Service) DeleteUserPermissions(ctx context.Context, orgID int64, userID int64) error {
	ctx, span := tracer.Start(ctx, "accesscontrol.acimpl.DeleteUserPermissions")
	defer span.End()

	return s.store.DeleteUserPermissions(ctx, orgID, userID)
}

func (s *Service) DeleteTeamPermissions(ctx context.Context, orgID int64, teamID int64) error {
	ctx, span := tracer.Start(ctx, "accesscontrol.acimpl.DeleteTeamPermissions")
	defer span.End()

	return s.store.DeleteTeamPermissions(ctx, orgID, teamID)
}

// DeclareFixedRoles allow the caller to declare, to the service, fixed roles and their assignments
// to organization roles ("Viewer", "Editor", "Admin") or "Grafana Admin"
func (s *Service) DeclareFixedRoles(registrations ...accesscontrol.RoleRegistration) error {
	for _, r := range registrations {
		err := accesscontrol.ValidateFixedRole(r.Role)
		if err != nil {
			return err
		}

		err = accesscontrol.ValidateBuiltInRoles(r.Grants)
		if err != nil {
			return err
		}

		for i := range r.Role.Permissions {
			if err := s.permRegistry.RegisterPermission(r.Role.Permissions[i].Action, r.Role.Permissions[i].Scope); err != nil {
				return err
			}
		}

		s.registrations.Append(r)
	}

	return nil
}

// RegisterFixedRoles registers all declared roles in RAM
func (s *Service) RegisterFixedRoles(ctx context.Context) error {
	_, span := tracer.Start(ctx, "accesscontrol.acimpl.RegisterFixedRoles")
	defer span.End()

	s.registrations.Range(func(registration accesscontrol.RoleRegistration) bool {
		for br := range accesscontrol.BuiltInRolesWithParents(registration.Grants) {
			if basicRole, ok := s.roles[br]; ok {
				for _, p := range registration.Role.Permissions {
					if registration.Role.IsPlugin() && p.Action == pluginaccesscontrol.ActionAppAccess {
						s.log.Debug("Plugin is attempting to grant access permission, but this permission is already granted by default and will be ignored",
							"role", registration.Role.Name, "permission", p.Action, "scope", p.Scope)
						continue
					}
					perm := accesscontrol.Permission{
						Action: p.Action,
						Scope:  p.Scope,
					}

					perm.Kind, perm.Attribute, perm.Identifier = accesscontrol.SplitScope(perm.Scope)
					basicRole.Permissions = append(basicRole.Permissions, perm)
				}
			} else {
				s.log.Error("Unknown builtin role", "builtInRole", br)
			}
		}
		return true
	})

	return nil
}

// DeclarePluginRoles allow the caller to declare, to the service, plugin roles and their assignments
// to organization roles ("Viewer", "Editor", "Admin") or "Grafana Admin"
func (s *Service) DeclarePluginRoles(ctx context.Context, ID, name string, regs []plugins.RoleRegistration) error {
	_, span := tracer.Start(ctx, "accesscontrol.acimpl.DeclarePluginRoles")
	defer span.End()

	acRegs := pluginutils.ToRegistrations(ID, name, regs)
	for _, r := range acRegs {
		if err := pluginutils.ValidatePluginRole(ID, r.Role); err != nil {
			return err
		}

		if err := accesscontrol.ValidateBuiltInRoles(r.Grants); err != nil {
			return err
		}

		for i := range r.Role.Permissions {
			// Register plugin actions and their possible scopes for permission validation
			s.permRegistry.RegisterPluginScope(r.Role.Permissions[i].Scope)
			if err := s.permRegistry.RegisterPermission(r.Role.Permissions[i].Action, r.Role.Permissions[i].Scope); err != nil {
				return err
			}
		}

		s.log.Debug("Registering plugin role", "role", r.Role.Name)
		s.registrations.Append(r)
	}

	return nil
}

func GetActionFilter(options accesscontrol.SearchOptions) func(action string) bool {
	return func(action string) bool {
		if options.ActionPrefix != "" {
			return strings.HasPrefix(action, options.ActionPrefix)
		} else {
			return action == options.Action
		}
	}
}

// SearchUsersPermissions returns all users' permissions filtered by action prefixes
func (s *Service) SearchUsersPermissions(ctx context.Context, usr identity.Requester, options accesscontrol.SearchOptions) (map[int64][]accesscontrol.Permission, error) {
	ctx, span := tracer.Start(ctx, "accesscontrol.acimpl.SearchUsersPermissions")
	defer span.End()

	// Limit roles to available in OSS
	options.RolePrefixes = OSSRolesPrefixes
	if options.UserID > 0 {
		// Reroute to the user specific implementation of search permissions
		// because it leverages the user permission cache.
		userPerms, err := s.SearchUserPermissions(ctx, usr.GetOrgID(), options)
		if err != nil {
			return nil, err
		}
		return map[int64][]accesscontrol.Permission{options.UserID: userPerms}, nil
	}

	timer := prometheus.NewTimer(metrics.MAccessSearchPermissionsSummary)
	defer timer.ObserveDuration()

	// Filter ram permissions
	basicPermissions := map[string][]accesscontrol.Permission{}
	for role, basicRole := range s.roles {
		for i := range basicRole.Permissions {
			if PermissionMatchesSearchOptions(basicRole.Permissions[i], &options) {
				basicPermissions[role] = append(basicPermissions[role], basicRole.Permissions[i])
			}
		}
	}

	usersRoles, err := s.store.GetUsersBasicRoles(ctx, nil, usr.GetOrgID())
	if err != nil {
		return nil, err
	}

	options.ActionSets = s.actionResolver.ResolveAction(options.Action)
	options.ActionSets = append(options.ActionSets,
		s.actionResolver.ResolveActionPrefix(options.ActionPrefix)...)

	// Get managed permissions (DB)
	usersPermissions, err := s.store.SearchUsersPermissions(ctx, usr.GetOrgID(), options)
	if err != nil {
		return nil, err
	}

	// helper to filter out permissions the signed in users cannot see
	canView := func() func(userID int64) bool {
		siuPermissions := usr.GetPermissions()
		if len(siuPermissions) == 0 {
			return func(_ int64) bool { return false }
		}
		scopes, ok := siuPermissions[accesscontrol.ActionUsersPermissionsRead]
		if !ok {
			return func(_ int64) bool { return false }
		}

		ids := map[int64]bool{}
		for i := range scopes {
			if strings.HasSuffix(scopes[i], "*") {
				return func(_ int64) bool { return true }
			}
			parts := strings.Split(scopes[i], ":")
			if len(parts) != 3 {
				continue
			}
			id, err := strconv.ParseInt(parts[2], 10, 64)
			if err != nil {
				continue
			}
			ids[id] = true
		}

		return func(userID int64) bool { return ids[userID] }
	}()

	// Merge stored (DB) and basic role permissions (RAM)
	// Assumes that all users with stored permissions have org roles
	res := map[int64][]accesscontrol.Permission{}
	for userID, roles := range usersRoles {
		if !canView(userID) {
			continue
		}
		perms := []accesscontrol.Permission{}
		for i := range roles {
			basicPermission, ok := basicPermissions[roles[i]]
			if !ok {
				continue
			}
			perms = append(perms, basicPermission...)
		}
		if dbPerms, ok := usersPermissions[userID]; ok {
			perms = append(perms, dbPerms...)
		}
		if len(perms) > 0 {
			res[userID] = perms
		}
	}

	if len(options.ActionSets) > 0 {
		for id, perms := range res {
			res[id] = s.actionResolver.ExpandActionSetsWithFilter(perms, GetActionFilter(options))
		}
	}

	return res, nil
}

func (s *Service) SearchUserPermissions(ctx context.Context, orgID int64, searchOptions accesscontrol.SearchOptions) ([]accesscontrol.Permission, error) {
	ctx, span := tracer.Start(ctx, "accesscontrol.acimpl.SearchUserPermissions")
	defer span.End()

	timer := prometheus.NewTimer(metrics.MAccessPermissionsSummary)
	defer timer.ObserveDuration()

	if searchOptions.UserID <= 0 {
		return nil, fmt.Errorf("expected namespaced ID to be specified")
	}

	if permissions, success := s.searchUserPermissionsFromCache(ctx, orgID, searchOptions); success {
		return permissions, nil
	}
	return s.searchUserPermissions(ctx, orgID, searchOptions)
}

func (s *Service) searchUserPermissions(ctx context.Context, orgID int64, searchOptions accesscontrol.SearchOptions) ([]accesscontrol.Permission, error) {
	ctx, span := tracer.Start(ctx, "accesscontrol.acimpl.searchUserPermissions")
	defer span.End()

	// Get permissions for user's basic roles from RAM
	roleList, err := s.store.GetUsersBasicRoles(ctx, []int64{searchOptions.UserID}, orgID)
	if err != nil {
		return nil, fmt.Errorf("could not fetch basic roles for the user: %w", err)
	}
	var roles []string
	var ok bool
	if roles, ok = roleList[searchOptions.UserID]; !ok {
		return nil, fmt.Errorf("found no basic roles for user %d in organisation %d", searchOptions.UserID, orgID)
	}
	permissions := make([]accesscontrol.Permission, 0)
	for _, builtin := range roles {
		if basicRole, ok := s.roles[builtin]; ok {
			for _, permission := range basicRole.Permissions {
				if PermissionMatchesSearchOptions(permission, &searchOptions) {
					permissions = append(permissions, permission)
				}
			}
		}
	}

	searchOptions.ActionSets = s.actionResolver.ResolveAction(searchOptions.Action)
	searchOptions.ActionSets = append(searchOptions.ActionSets,
		s.actionResolver.ResolveActionPrefix(searchOptions.ActionPrefix)...)

	// Get permissions from the DB
	dbPermissions, err := s.store.SearchUsersPermissions(ctx, orgID, searchOptions)
	if err != nil {
		return nil, err
	}
	permissions = append(permissions, dbPermissions[searchOptions.UserID]...)

	if len(searchOptions.ActionSets) != 0 {
		permissions = s.actionResolver.ExpandActionSetsWithFilter(permissions, GetActionFilter(searchOptions))
	}

	key, err := accesscontrol.GetSearchPermissionCacheKey(s.log, &user.SignedInUser{UserID: searchOptions.UserID, OrgID: orgID}, searchOptions)
	if err != nil {
		s.log.Warn("failed to create search permission cache key", "err", err)
	} else {
		s.cache.Set(key, permissions, cacheTTL)
	}

	return permissions, nil
}

func (s *Service) searchUserPermissionsFromCache(ctx context.Context, orgID int64, searchOptions accesscontrol.SearchOptions) ([]accesscontrol.Permission, bool) {
	_, span := tracer.Start(ctx, "accesscontrol.acimpl.searchUserPermissionsFromCache")
	defer span.End()

	// Create a temp signed in user object to retrieve cache key
	tempUser := &user.SignedInUser{
		UserID: searchOptions.UserID,
		OrgID:  orgID,
	}

	key, err := accesscontrol.GetSearchPermissionCacheKey(s.log, tempUser, searchOptions)
	if err != nil {
		s.log.Warn("failed to create search permission cache key", "err", err)
		return nil, false
	}
	permissions, ok := s.cache.Get((key))
	if !ok {
		metrics.MAccessSearchUserPermissionsCacheUsage.WithLabelValues(accesscontrol.CacheMiss).Inc()
		return nil, false
	}

	s.log.Debug("Using cached permissions", "key", key)
	metrics.MAccessSearchUserPermissionsCacheUsage.WithLabelValues(accesscontrol.CacheHit).Inc()

	return permissions.([]accesscontrol.Permission), true
}

func PermissionMatchesSearchOptions(permission accesscontrol.Permission, searchOptions *accesscontrol.SearchOptions) bool {
	if searchOptions.Scope != "" {
		// Permissions including the scope should also match
		scopes := append(searchOptions.Wildcards(), searchOptions.Scope)
		if !slices.Contains(scopes, permission.Scope) {
			return false
		}
	}
	if searchOptions.Action != "" {
		return permission.Action == searchOptions.Action
	}
	return strings.HasPrefix(permission.Action, searchOptions.ActionPrefix)
}

func (s *Service) SaveExternalServiceRole(ctx context.Context, cmd accesscontrol.SaveExternalServiceRoleCommand) error {
	ctx, span := tracer.Start(ctx, "accesscontrol.acimpl.SaveExternalServiceRole")
	defer span.End()

	if !s.cfg.ManagedServiceAccountsEnabled || !s.features.IsEnabled(ctx, featuremgmt.FlagExternalServiceAccounts) {
		s.log.Debug("Registering an external service role is behind a feature flag, enable it to use this feature.")
		return nil
	}

	if err := cmd.Validate(); err != nil {
		return err
	}

	return s.store.SaveExternalServiceRole(ctx, cmd)
}

func (s *Service) DeleteExternalServiceRole(ctx context.Context, externalServiceID string) error {
	ctx, span := tracer.Start(ctx, "accesscontrol.acimpl.DeleteExternalServiceRole")
	defer span.End()

	if !s.cfg.ManagedServiceAccountsEnabled || !s.features.IsEnabled(ctx, featuremgmt.FlagExternalServiceAccounts) {
		s.log.Debug("Deleting an external service role is behind a feature flag, enable it to use this feature.")
		return nil
	}

	slug := slugify.Slugify(externalServiceID)

	return s.store.DeleteExternalServiceRole(ctx, slug)
}

func (s *Service) SyncUserRoles(ctx context.Context, orgID int64, cmd accesscontrol.SyncUserRolesCommand) error {
	return nil
}

func (s *Service) GetStaticRoles(ctx context.Context) map[string]*accesscontrol.RoleDTO {
	return s.roles
}

func (s *Service) GetRoleByName(ctx context.Context, orgID int64, roleName string) (*accesscontrol.RoleDTO, error) {
	_, span := tracer.Start(ctx, "accesscontrol.acimpl.GetRoleByName")
	defer span.End()

	err := accesscontrol.ErrRoleNotFound
	if _, ok := s.roles[roleName]; ok {
		return nil, err
	}

	var role *accesscontrol.RoleDTO
	s.registrations.Range(func(registration accesscontrol.RoleRegistration) bool {
		if registration.Role.Name == roleName {
			role = &accesscontrol.RoleDTO{
				Name:        registration.Role.Name,
				Permissions: registration.Role.Permissions,
				DisplayName: registration.Role.DisplayName,
				Description: registration.Role.Description,
			}
			err = nil
			return false
		}
		return true
	})
	return role, err
}
