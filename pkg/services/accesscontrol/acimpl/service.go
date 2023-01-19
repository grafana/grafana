package acimpl

import (
	"context"
	"fmt"
	"strconv"
	"strings"
	"time"

	"github.com/prometheus/client_golang/prometheus"

	"github.com/grafana/grafana/pkg/api/routing"
	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/infra/localcache"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/metrics"
	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/accesscontrol/api"
	"github.com/grafana/grafana/pkg/services/accesscontrol/database"
	"github.com/grafana/grafana/pkg/services/accesscontrol/pluginutils"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/setting"
)

var _ plugins.RoleRegistry = &Service{}

const (
	cacheTTL = 10 * time.Second
)

func ProvideService(cfg *setting.Cfg, store db.DB, routeRegister routing.RouteRegister, cache *localcache.CacheService,
	accessControl accesscontrol.AccessControl, features *featuremgmt.FeatureManager) (*Service, error) {
	service := ProvideOSSService(cfg, database.ProvideService(store), cache, features)

	if !accesscontrol.IsDisabled(cfg) {
		api.NewAccessControlAPI(routeRegister, accessControl, service, features).RegisterAPIEndpoints()
		if err := accesscontrol.DeclareFixedRoles(service); err != nil {
			return nil, err
		}
	}

	return service, nil
}

func ProvideOSSService(cfg *setting.Cfg, store store, cache *localcache.CacheService, features *featuremgmt.FeatureManager) *Service {
	s := &Service{
		cfg:      cfg,
		store:    store,
		log:      log.New("accesscontrol.service"),
		cache:    cache,
		roles:    accesscontrol.BuildBasicRoleDefinitions(),
		features: features,
	}

	return s
}

type store interface {
	GetUserPermissions(ctx context.Context, query accesscontrol.GetUserPermissionsQuery) ([]accesscontrol.Permission, error)
	SearchUsersPermissions(ctx context.Context, orgID int64, options accesscontrol.SearchOptions) (map[int64][]accesscontrol.Permission, error)
	GetUsersBasicRoles(ctx context.Context, userFilter []int64, orgID int64) (map[int64][]string, error)
	DeleteUserPermissions(ctx context.Context, orgID, userID int64) error
}

// Service is the service implementing role based access control.
type Service struct {
	log           log.Logger
	cfg           *setting.Cfg
	store         store
	cache         *localcache.CacheService
	registrations accesscontrol.RegistrationList
	roles         map[string]*accesscontrol.RoleDTO
	features      *featuremgmt.FeatureManager
}

func (s *Service) GetUsageStats(_ context.Context) map[string]interface{} {
	enabled := 0
	if !accesscontrol.IsDisabled(s.cfg) {
		enabled = 1
	}

	return map[string]interface{}{
		"stats.oss.accesscontrol.enabled.count": enabled,
	}
}

// GetUserPermissions returns user permissions based on built-in roles
func (s *Service) GetUserPermissions(ctx context.Context, user *user.SignedInUser, options accesscontrol.Options) ([]accesscontrol.Permission, error) {
	timer := prometheus.NewTimer(metrics.MAccessPermissionsSummary)
	defer timer.ObserveDuration()

	if !s.cfg.RBACPermissionCache || !user.HasUniqueId() {
		return s.getUserPermissions(ctx, user, options)
	}

	return s.getCachedUserPermissions(ctx, user, options)
}

func (s *Service) getUserPermissions(ctx context.Context, user *user.SignedInUser, options accesscontrol.Options) ([]accesscontrol.Permission, error) {
	permissions := make([]accesscontrol.Permission, 0)
	for _, builtin := range accesscontrol.GetOrgRoles(user) {
		if basicRole, ok := s.roles[builtin]; ok {
			permissions = append(permissions, basicRole.Permissions...)
		}
	}

	dbPermissions, err := s.store.GetUserPermissions(ctx, accesscontrol.GetUserPermissionsQuery{
		OrgID:      user.OrgID,
		UserID:     user.UserID,
		Roles:      accesscontrol.GetOrgRoles(user),
		TeamIDs:    user.Teams,
		RolePrefix: accesscontrol.ManagedRolePrefix,
	})
	if err != nil {
		return nil, err
	}

	return append(permissions, dbPermissions...), nil
}

func (s *Service) getCachedUserPermissions(ctx context.Context, user *user.SignedInUser, options accesscontrol.Options) ([]accesscontrol.Permission, error) {
	key, err := permissionCacheKey(user)
	if err != nil {
		return nil, err
	}

	if !options.ReloadCache {
		permissions, ok := s.cache.Get(key)
		if ok {
			s.log.Debug("using cached permissions", "key", key)
			return permissions.([]accesscontrol.Permission), nil
		}
	}

	s.log.Debug("fetch permissions from store", "key", key)
	permissions, err := s.getUserPermissions(ctx, user, options)
	if err != nil {
		return nil, err
	}

	s.log.Debug("cache permissions", "key", key)
	s.cache.Set(key, permissions, cacheTTL)

	return permissions, nil
}

func (s *Service) ClearUserPermissionCache(user *user.SignedInUser) {
	key, err := permissionCacheKey(user)
	if err != nil {
		return
	}
	s.cache.Delete(key)
}

func (s *Service) DeleteUserPermissions(ctx context.Context, orgID int64, userID int64) error {
	return s.store.DeleteUserPermissions(ctx, orgID, userID)
}

// DeclareFixedRoles allow the caller to declare, to the service, fixed roles and their assignments
// to organization roles ("Viewer", "Editor", "Admin") or "Grafana Admin"
func (s *Service) DeclareFixedRoles(registrations ...accesscontrol.RoleRegistration) error {
	// If accesscontrol is disabled no need to register roles
	if accesscontrol.IsDisabled(s.cfg) {
		return nil
	}

	for _, r := range registrations {
		err := accesscontrol.ValidateFixedRole(r.Role)
		if err != nil {
			return err
		}

		err = accesscontrol.ValidateBuiltInRoles(r.Grants)
		if err != nil {
			return err
		}

		s.registrations.Append(r)
	}

	return nil
}

// RegisterFixedRoles registers all declared roles in RAM
func (s *Service) RegisterFixedRoles(ctx context.Context) error {
	// If accesscontrol is disabled no need to register roles
	if accesscontrol.IsDisabled(s.cfg) {
		return nil
	}
	s.registrations.Range(func(registration accesscontrol.RoleRegistration) bool {
		for br := range accesscontrol.BuiltInRolesWithParents(registration.Grants) {
			if basicRole, ok := s.roles[br]; ok {
				basicRole.Permissions = append(basicRole.Permissions, registration.Role.Permissions...)
			} else {
				s.log.Error("Unknown builtin role", "builtInRole", br)
			}
		}
		return true
	})
	return nil
}

func (s *Service) IsDisabled() bool {
	return accesscontrol.IsDisabled(s.cfg)
}

func permissionCacheKey(user *user.SignedInUser) (string, error) {
	key, err := user.GetCacheKey()
	if err != nil {
		return "", err
	}
	return fmt.Sprintf("rbac-permissions-%s", key), nil
}

// DeclarePluginRoles allow the caller to declare, to the service, plugin roles and their assignments
// to organization roles ("Viewer", "Editor", "Admin") or "Grafana Admin"
func (s *Service) DeclarePluginRoles(_ context.Context, ID, name string, regs []plugins.RoleRegistration) error {
	// If accesscontrol is disabled no need to register roles
	if accesscontrol.IsDisabled(s.cfg) {
		return nil
	}

	// Protect behind feature toggle
	if !s.features.IsEnabled(featuremgmt.FlagAccessControlOnCall) {
		return nil
	}

	acRegs := pluginutils.ToRegistrations(ID, name, regs)
	for _, r := range acRegs {
		if err := pluginutils.ValidatePluginRole(ID, r.Role); err != nil {
			return err
		}

		if err := accesscontrol.ValidateBuiltInRoles(r.Grants); err != nil {
			return err
		}

		s.log.Debug("Registering plugin role", "role", r.Role.Name)
		s.registrations.Append(r)
	}

	return nil
}

// SearchUsersPermissions returns all users' permissions filtered by action prefixes
func (s *Service) SearchUsersPermissions(ctx context.Context, user *user.SignedInUser, orgID int64,
	options accesscontrol.SearchOptions) (map[int64][]accesscontrol.Permission, error) {
	// Filter ram permissions
	basicPermissions := map[string][]accesscontrol.Permission{}
	for role, basicRole := range s.roles {
		for i := range basicRole.Permissions {
			if options.ActionPrefix != "" {
				if strings.HasPrefix(basicRole.Permissions[i].Action, options.ActionPrefix) {
					basicPermissions[role] = append(basicPermissions[role], basicRole.Permissions[i])
				}
			}
			if options.Action != "" {
				if basicRole.Permissions[i].Action == options.Action {
					basicPermissions[role] = append(basicPermissions[role], basicRole.Permissions[i])
				}
			}
		}
	}

	usersRoles, err := s.store.GetUsersBasicRoles(ctx, nil, orgID)
	if err != nil {
		return nil, err
	}

	// Get managed permissions (DB)
	usersPermissions, err := s.store.SearchUsersPermissions(ctx, orgID, options)
	if err != nil {
		return nil, err
	}

	// helper to filter out permissions the signed in users cannot see
	canView := func() func(userID int64) bool {
		siuPermissions, ok := user.Permissions[orgID]
		if !ok {
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

	return res, nil
}

func (s *Service) SearchUserPermissions(ctx context.Context, orgID int64, searchOptions accesscontrol.SearchOptions) ([]accesscontrol.Permission, error) {
	timer := prometheus.NewTimer(metrics.MAccessPermissionsSummary)
	defer timer.ObserveDuration()

	if searchOptions.UserID == 0 {
		return nil, fmt.Errorf("expected user ID to be specified")
	}

	if permissions, success := s.searchUserPermissionsFromCache(orgID, searchOptions); success {
		return permissions, nil
	}
	return s.searchUserPermissions(ctx, orgID, searchOptions)
}

func (s *Service) searchUserPermissions(ctx context.Context, orgID int64, searchOptions accesscontrol.SearchOptions) ([]accesscontrol.Permission, error) {
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
				if PermissionMatchesSearchOptions(permission, searchOptions) {
					permissions = append(permissions, permission)
				}
			}
		}
	}

	// Get permissions from the DB
	dbPermissions, err := s.store.SearchUsersPermissions(ctx, orgID, searchOptions)
	if err != nil {
		return nil, err
	}
	permissions = append(permissions, dbPermissions[searchOptions.UserID]...)

	return permissions, nil
}

func (s *Service) searchUserPermissionsFromCache(orgID int64, searchOptions accesscontrol.SearchOptions) ([]accesscontrol.Permission, bool) {
	// Create a temp signed in user object to retrieve cache key
	tempUser := &user.SignedInUser{
		UserID: searchOptions.UserID,
		OrgID:  orgID,
	}
	key, err := permissionCacheKey(tempUser)
	if err != nil {
		s.log.Debug("could not obtain cache key to search user permissions", "error", err.Error())
		return nil, false
	}

	permissions, ok := s.cache.Get(key)
	if !ok {
		return nil, false
	}

	s.log.Debug("using cached permissions", "key", key)
	filteredPermissions := make([]accesscontrol.Permission, 0)
	for _, permission := range permissions.([]accesscontrol.Permission) {
		if PermissionMatchesSearchOptions(permission, searchOptions) {
			filteredPermissions = append(filteredPermissions, permission)
		}
	}

	return filteredPermissions, true
}

func PermissionMatchesSearchOptions(permission accesscontrol.Permission, searchOptions accesscontrol.SearchOptions) bool {
	if searchOptions.Scope != "" && permission.Scope != searchOptions.Scope {
		return false
	}
	if searchOptions.Action != "" {
		return permission.Action == searchOptions.Action
	}
	return strings.HasPrefix(permission.Action, searchOptions.ActionPrefix)
}
