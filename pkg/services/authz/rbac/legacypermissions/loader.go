// Package legacypermissions loads the legacy permission snapshot inside embedded
// AuthZ. It is not a standalone or multi-tenant authorization service.
package legacypermissions

import (
	"context"
	"time"

	claims "github.com/grafana/authlib/types"
	"go.opentelemetry.io/otel"
	"golang.org/x/sync/singleflight"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/infra/localcache"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/metrics"
	ac "github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/folder"
	"github.com/grafana/grafana/pkg/services/licensing"
	"github.com/grafana/grafana/pkg/setting"
)

const cacheTTL = 60 * time.Second

var tracer = otel.Tracer("github.com/grafana/grafana/pkg/services/authz/rbac/legacypermissions")

// Snapshot once per request so its SQL contributions use the same settings,
// while subsequent requests observe license and feature changes.
type loadSettings struct {
	enforcementEnabled                 bool
	excludeRedundantManagedPermissions bool
}

// MigratedPermissions resolves only Zanzana grants, never legacy RBAC grants.
type MigratedPermissions interface {
	ResolveCurrentUserPermissions(context.Context, identity.Requester) ([]ac.Permission, error)
}

type Loader struct {
	store    permissionStore
	catalog  *RoleCatalog
	actions  ac.ActionResolver
	cache    *localcache.CacheService
	cfg      *setting.Cfg
	features featuremgmt.FeatureToggles
	license  licensing.Licensing
	zanzana  MigratedPermissions
	flight   singleflight.Group
	log      log.Logger
}

func NewLoader(sql db.DB, catalog *RoleCatalog, actionResolver ac.ActionResolver,
	cache *localcache.CacheService, cfg *setting.Cfg, features featuremgmt.FeatureToggles,
	license licensing.Licensing, zanzana MigratedPermissions,
) *Loader {
	return &Loader{
		store:    permissionStore{sql},
		catalog:  catalog,
		actions:  actionResolver,
		cache:    cache,
		cfg:      cfg,
		features: features,
		license:  license,
		zanzana:  zanzana,
		log:      log.New("authz.legacypermissions"),
	}
}

var _ ac.UserPermissionsEvaluator = (*Loader)(nil)

// GetLocalUserPermissions is the existing RBAC RPC's evaluator seam. Identity
// reconstruction and final deduplication stay in that RPC, not in the loader.
func (l *Loader) GetLocalUserPermissions(ctx context.Context, user identity.Requester, options ac.Options) ([]ac.Permission, error) {
	return l.GetUserPermissions(ctx, user, options)
}

// GetUserPermissions accepts an already authenticated, normalized requester.
// The eventual transport adapter must validate caller trust and namespace before
// constructing it. This method does not authenticate arbitrary identity claims.
func (l *Loader) GetUserPermissions(ctx context.Context, user identity.Requester, options ac.Options) ([]ac.Permission, error) {
	ctx, span := tracer.Start(ctx, "authz.legacypermissions.GetUserPermissions")
	defer span.End()
	settings := loadSettings{
		enforcementEnabled: l.license.FeatureEnabled("accesscontrol.enforcement"),
		//nolint:staticcheck // Preserve the current global feature-toggle behavior.
		excludeRedundantManagedPermissions: l.features.IsEnabledGlobally(featuremgmt.FlagExcludeRedundantManagedPermissions),
	}
	started := time.Now()
	cached := l.cfg.RBAC.PermissionCache && user.HasUniqueId()
	var permissions []ac.Permission
	var err error
	if !cached {
		permissions, err = l.uncached(ctx, user, settings)
	} else if settings.enforcementEnabled || options.ReloadCache {
		permissions, err = l.assemble(ctx, user, options, settings)
	} else {
		value, loadErr, _ := l.flight.Do(user.GetCacheKey(), func() (any, error) {
			return l.assemble(ctx, user, options, settings)
		})
		err = loadErr
		if err == nil {
			permissions = value.([]ac.Permission)
		}
	}
	metrics.MAccessPermissionsSummary.Observe(time.Since(started).Seconds())
	if err != nil {
		return nil, err
	}
	if l.zanzana == nil {
		return permissions, nil
	}
	resolve := func() ([]ac.Permission, error) { return l.zanzana.ResolveCurrentUserPermissions(ctx, user) }
	var migrated []ac.Permission
	if !cached || options.SkipZanzanaCache {
		migrated, err = resolve()
	} else {
		migrated, err = l.cached(ac.GetZanzanaUserPermissionCacheKey(user), options, resolve)
	}
	if err != nil {
		l.log.Warn("could not get zanzana user permissions, using legacy only", "error", err)
		return permissions, nil
	}
	return MergeUserPermissions(permissions, migrated), nil
}

func queryFor(orgID int64, p loadSettings) ac.GetUserPermissionsQuery {
	q := ac.GetUserPermissionsQuery{OrgID: orgID, ExcludeRedundantManagedPermissions: p.excludeRedundantManagedPermissions}
	if !p.enforcementEnabled {
		q.RolePrefixes = []string{ac.ManagedRolePrefix, ac.ExternalServiceRolePrefix}
	}
	return q
}

func internalID(user identity.Requester) (int64, error) {
	if user.IsIdentityType(claims.TypeUser, claims.TypeServiceAccount) {
		return user.GetInternalID()
	}
	return 0, nil
}

func sharedWithMe() ac.Permission {
	return ac.Permission{Action: folder.ActionFoldersRead, Scope: folder.ScopeFoldersProvider.GetResourceScopeUID(folder.SharedWithMeFolderUID)}
}

func (l *Loader) uncached(ctx context.Context, user identity.Requester, p loadSettings) ([]ac.Permission, error) {
	q := queryFor(user.GetOrgID(), p)
	var err error
	if p.enforcementEnabled {
		q.UserID, err = internalID(user)
	} else {
		// OSS's uncached path intentionally uses the typed identifier, unlike its cached path.
		q.UserID, _ = identity.UserIdentifier(user.GetID())
	}
	if err != nil {
		return nil, err
	}
	q.Roles, q.TeamIDs = ac.GetOrgRoles(user), user.GetTeams()
	permissions, err := l.store.permissions(ctx, q)
	if err != nil {
		return nil, err
	}
	if p.enforcementEnabled {
		return l.actions.ExpandActionSets(append(permissions, sharedWithMe())), nil
	}
	static := append(l.catalog.Permissions(q.Roles...), sharedWithMe())
	return append(static, l.actions.ExpandActionSets(permissions)...), nil
}

func (l *Loader) assemble(ctx context.Context, user identity.Requester, options ac.Options, p loadSettings) ([]ac.Permission, error) {
	var permissions []ac.Permission
	for _, role := range ac.GetOrgRoles(user) {
		basic, err := l.cached(ac.GetBasicRolePermissionCacheKey(role, user.GetOrgID()), options, func() ([]ac.Permission, error) {
			q := queryFor(user.GetOrgID(), p)
			q.Roles = []string{role}
			// Both old basic-role stores drop this flag; preserve that asymmetry.
			q.ExcludeRedundantManagedPermissions = false
			stored, err := l.store.permissions(ctx, q)
			if err != nil {
				return nil, err
			}
			stored = l.actions.ExpandActionSets(stored)
			if p.enforcementEnabled {
				return stored, nil
			}
			return append(l.catalog.Permissions(role), stored...), nil
		})
		if err != nil {
			return nil, err
		}
		permissions = append(permissions, basic...)
	}
	teams, err := l.cachedTeams(ctx, user, options, p)
	if err != nil {
		return nil, err
	}
	direct, err := l.cached(ac.GetUserDirectPermissionCacheKey(user), options, func() ([]ac.Permission, error) {
		q := queryFor(user.GetOrgID(), p)
		if p.enforcementEnabled {
			q.ExcludeRedundantManagedPermissions = false
		}
		var err error
		q.UserID, err = internalID(user)
		if err != nil {
			return nil, err
		}
		stored, err := l.store.permissions(ctx, q)
		if err != nil {
			return nil, err
		}
		if p.enforcementEnabled {
			return l.actions.ExpandActionSets(append(stored, sharedWithMe())), nil
		}
		return append(l.actions.ExpandActionSets(stored), sharedWithMe()), nil
	})
	if err != nil {
		return nil, err
	}
	// Allocate once for the complete snapshot. The exact capacity also forces
	// Zanzana merging to detach from concurrent OSS assemblies' shared result.
	snapshot := make([]ac.Permission, 0, len(permissions)+len(teams)+len(direct))
	snapshot = append(snapshot, permissions...)
	snapshot = append(snapshot, teams...)
	snapshot = append(snapshot, direct...)
	return snapshot, nil
}

func (l *Loader) cachedTeams(ctx context.Context, user identity.Requester, options ac.Options, p loadSettings) ([]ac.Permission, error) {
	var permissions []ac.Permission
	var missing []int64
	for _, teamID := range user.GetTeams() {
		if value, ok := l.cache.Get(ac.GetTeamPermissionCacheKey(teamID, user.GetOrgID())); ok && !options.ReloadCache {
			metrics.MAccessPermissionsCacheUsage.WithLabelValues(ac.CacheHit).Inc()
			permissions = append(permissions, value.([]ac.Permission)...)
		} else {
			missing = append(missing, teamID)
		}
	}
	if len(missing) == 0 {
		return permissions, nil
	}
	metrics.MAccessPermissionsCacheUsage.WithLabelValues(ac.CacheMiss).Inc()
	q := queryFor(user.GetOrgID(), p)
	q.TeamIDs = missing
	if p.enforcementEnabled {
		q.ExcludeRedundantManagedPermissions = false
	}
	teams, err := l.store.teams(ctx, q)
	if err != nil {
		return nil, err
	}
	for teamID, grants := range teams {
		grants = l.actions.ExpandActionSets(grants)
		l.cache.Set(ac.GetTeamPermissionCacheKey(teamID, user.GetOrgID()), grants, cacheTTL)
		permissions = append(permissions, grants...)
	}
	return permissions, nil
}

func (l *Loader) cached(key string, options ac.Options, load func() ([]ac.Permission, error)) ([]ac.Permission, error) {
	if !options.ReloadCache {
		if value, ok := l.cache.Get(key); ok {
			metrics.MAccessPermissionsCacheUsage.WithLabelValues(ac.CacheHit).Inc()
			return value.([]ac.Permission), nil
		}
	}
	metrics.MAccessPermissionsCacheUsage.WithLabelValues(ac.CacheMiss).Inc()
	var fresh []ac.Permission
	get := func() (any, error) {
		var err error
		fresh, err = load()
		return fresh, err
	}
	if options.ReloadCache {
		if err := l.cache.ExclusiveSet(key, get, cacheTTL); err != nil {
			return nil, err
		}
		return fresh, nil
	}
	value, err := l.cache.GetOrExclusiveSet(key, get, cacheTTL)
	if err != nil {
		return nil, err
	}
	return value.([]ac.Permission), nil
}

func (l *Loader) ClearUserPermissionCache(user identity.Requester) {
	l.cache.ExclusiveDelete(ac.GetUserDirectPermissionCacheKey(user))
	l.cache.ExclusiveDelete(ac.GetZanzanaUserPermissionCacheKey(user))
}
