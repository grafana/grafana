package legacypermissions

import (
	"context"
	"fmt"
	"slices"
	"strings"

	"github.com/prometheus/client_golang/prometheus"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/infra/localcache"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/metrics"
	ac "github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/accesscontrol/shadow"
	"github.com/grafana/grafana/pkg/services/authz/zanzana/legacyscopes"
	"github.com/grafana/grafana/pkg/services/user"
)

type SearchStore interface {
	SearchUsersPermissions(context.Context, int64, ac.SearchOptions) (map[int64][]ac.Permission, error)
	GetUsersBasicRoles(context.Context, []int64, int64) (map[int64][]string, error)
}

// PermissionSearch implements the legacy search policy for local callers and the embedded RPC.
type PermissionSearch struct {
	store         SearchStore
	basicRoles    func() map[string][]ac.Permission
	actions       ac.ActionResolver
	cache         *localcache.CacheService
	scopeResolver legacyscopes.ScopeResolver
	zanzana       *ZanzanaPermissionResolver
	log           log.Logger
}

func NewPermissionSearch(store SearchStore, basicRoles func() map[string][]ac.Permission, actions ac.ActionResolver, cache *localcache.CacheService, scopeResolver legacyscopes.ScopeResolver, zanzana *ZanzanaPermissionResolver, logger log.Logger) *PermissionSearch {
	return &PermissionSearch{store: store, basicRoles: basicRoles, actions: actions, cache: cache, scopeResolver: scopeResolver, zanzana: zanzana, log: logger}
}

func (s *PermissionSearch) Search(ctx context.Context, usr identity.Requester, options ac.SearchOptions, enforced bool) (map[int64][]ac.Permission, error) {
	originalScope := options.Scope
	scope, err := legacyscopes.LegacySearchScope(ctx, usr, s.scopeResolver, originalScope)
	if err != nil {
		return nil, err
	}
	options.Scope = scope
	if !enforced {
		options.RolePrefixes = []string{ac.ManagedRolePrefix, ac.ExternalServiceRolePrefix}
	}

	var results map[int64][]ac.Permission
	if options.UserID > 0 {
		permissions, err := s.SearchUserPermissions(ctx, usr.GetOrgID(), options, enforced)
		if err != nil {
			return nil, err
		}
		results = map[int64][]ac.Permission{options.UserID: permissions}
	} else {
		if !shadow.IsShadow(ctx) {
			timer := prometheus.NewTimer(metrics.MAccessSearchPermissionsSummary)
			defer timer.ObserveDuration()
		}
		results, err = s.searchAll(ctx, usr, options, enforced)
		if err != nil {
			return nil, err
		}
	}

	options.Scope = originalScope
	if shadow.IsShadow(ctx) && s.zanzana != nil {
		migrated, err := s.zanzana.SearchUsersPermissions(ctx, usr, usr.GetOrgID(), options)
		if err != nil {
			return nil, err
		}
		results = MergePermissions(results, migrated)
	} else {
		results = s.zanzana.MergeSearch(ctx, usr, usr.GetOrgID(), options, results, s.log)
	}
	return legacyscopes.ResolveSearchScopes(ctx, usr, originalScope, s.scopeResolver, results)
}

func (s *PermissionSearch) searchAll(ctx context.Context, usr identity.Requester, options ac.SearchOptions, enforced bool) (map[int64][]ac.Permission, error) {
	var roles map[int64][]string
	var basicPermissions map[string][]ac.Permission
	if !enforced {
		basicPermissions = make(map[string][]ac.Permission)
		for role, permissions := range s.basicRoles() {
			for _, p := range permissions {
				if PermissionMatchesSearchOptions(p, &options) {
					basicPermissions[role] = append(basicPermissions[role], p)
				}
			}
		}
		var err error
		roles, err = s.store.GetUsersBasicRoles(ctx, nil, usr.GetOrgID())
		if err != nil {
			return nil, err
		}
	}

	options.ActionSets = s.actions.ResolveAction(options.Action)
	options.ActionSets = append(options.ActionSets, s.actions.ResolveActionPrefix(options.ActionPrefix)...)
	stored, err := s.store.SearchUsersPermissions(ctx, usr.GetOrgID(), options)
	if err != nil {
		return nil, err
	}
	canView, err := legacyscopes.UserPermissionsReadFilter(ctx, usr, s.scopeResolver)
	if err != nil {
		return nil, err
	}

	results := make(map[int64][]ac.Permission)
	if enforced {
		for id, permissions := range stored {
			if canView(id) {
				results[id] = permissions
			}
		}
	} else {
		for id, names := range roles {
			if !canView(id) {
				continue
			}
			var permissions []ac.Permission
			for _, name := range names {
				permissions = append(permissions, basicPermissions[name]...)
			}
			permissions = append(permissions, stored[id]...)
			if len(permissions) > 0 {
				results[id] = permissions
			}
		}
	}
	if len(options.ActionSets) > 0 {
		filter := SearchActionFilter(options)
		for id, permissions := range results {
			results[id] = s.actions.ExpandActionSetsWithFilter(permissions, filter)
		}
	}
	return results, nil
}

func (s *PermissionSearch) SearchUserPermissions(ctx context.Context, orgID int64, searchOptions ac.SearchOptions, enforced bool) ([]ac.Permission, error) {
	ctx, span := tracer.Start(ctx, "authz.legacypermissions.SearchUserPermissions")
	defer span.End()

	if !shadow.IsShadow(ctx) {
		timer := prometheus.NewTimer(metrics.MAccessPermissionsSummary)
		defer timer.ObserveDuration()
	}

	if searchOptions.UserID <= 0 {
		return nil, fmt.Errorf("expected namespaced ID to be specified")
	}

	// The primary may have just filled the cache. A shadow read must run
	// the actual search to compare independently of that result.
	if shadow.IsShadow(ctx) {
		return s.SearchUserPermissionsUncached(ctx, orgID, searchOptions, enforced)
	}
	if permissions, success := s.searchUserPermissionsFromCache(ctx, orgID, searchOptions); success {
		return permissions, nil
	}
	return s.SearchUserPermissionsUncached(ctx, orgID, searchOptions, enforced)
}

func (s *PermissionSearch) SearchUserPermissionsUncached(ctx context.Context, orgID int64, searchOptions ac.SearchOptions, enforced bool) ([]ac.Permission, error) {
	ctx, span := tracer.Start(ctx, "authz.legacypermissions.searchUserPermissions")
	defer span.End()

	// OSS uses the in-memory basic roles and requires a target with an org role.
	var permissions []ac.Permission
	if !enforced {
		permissions = make([]ac.Permission, 0)
		roleList, err := s.store.GetUsersBasicRoles(ctx, []int64{searchOptions.UserID}, orgID)
		if err != nil {
			return nil, fmt.Errorf("could not fetch basic roles for the user: %w", err)
		}
		roles, ok := roleList[searchOptions.UserID]
		if !ok {
			return nil, fmt.Errorf("found no basic roles for user %d in organisation %d", searchOptions.UserID, orgID)
		}
		basicRoles := s.basicRoles()
		for _, role := range roles {
			for _, permission := range basicRoles[role] {
				if PermissionMatchesSearchOptions(permission, &searchOptions) {
					permissions = append(permissions, permission)
				}
			}
		}
	}

	searchOptions.ActionSets = s.actions.ResolveAction(searchOptions.Action)
	searchOptions.ActionSets = append(searchOptions.ActionSets,
		s.actions.ResolveActionPrefix(searchOptions.ActionPrefix)...)

	// Get permissions from the DB
	dbPermissions, err := s.store.SearchUsersPermissions(ctx, orgID, searchOptions)
	if err != nil {
		return nil, err
	}
	permissions = append(permissions, dbPermissions[searchOptions.UserID]...)

	if len(searchOptions.ActionSets) != 0 {
		permissions = s.actions.ExpandActionSetsWithFilter(permissions, SearchActionFilter(searchOptions))
	}

	if shadow.IsShadow(ctx) {
		return permissions, nil
	}

	key, err := ac.GetSearchPermissionCacheKey(s.log, &user.SignedInUser{UserID: searchOptions.UserID, OrgID: orgID}, searchOptions)
	if err != nil {
		s.log.Warn("failed to create search permission cache key", "err", err)
	} else {
		s.cache.Set(key, permissions, ac.PermissionCacheTTL)
	}

	return permissions, nil
}

func (s *PermissionSearch) searchUserPermissionsFromCache(ctx context.Context, orgID int64, searchOptions ac.SearchOptions) ([]ac.Permission, bool) {
	_, span := tracer.Start(ctx, "authz.legacypermissions.searchUserPermissionsFromCache")
	defer span.End()

	// Create a temp signed in user object to retrieve cache key
	tempUser := &user.SignedInUser{
		UserID: searchOptions.UserID,
		OrgID:  orgID,
	}

	key, err := ac.GetSearchPermissionCacheKey(s.log, tempUser, searchOptions)
	if err != nil {
		s.log.Warn("failed to create search permission cache key", "err", err)
		return nil, false
	}
	permissions, ok := s.cache.Get(key)
	if !ok {
		metrics.MAccessSearchUserPermissionsCacheUsage.WithLabelValues(ac.CacheMiss).Inc()
		return nil, false
	}

	s.log.Debug("Using cached permissions", "key", key)
	metrics.MAccessSearchUserPermissionsCacheUsage.WithLabelValues(ac.CacheHit).Inc()

	return permissions.([]ac.Permission), true
}

func SearchActionFilter(options ac.SearchOptions) func(action string) bool {
	return func(action string) bool {
		if options.ActionPrefix != "" {
			return strings.HasPrefix(action, options.ActionPrefix)
		} else {
			return action == options.Action
		}
	}
}

func PermissionMatchesSearchOptions(permission ac.Permission, searchOptions *ac.SearchOptions) bool {
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
