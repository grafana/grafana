package acimpl

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"sync"
	"time"

	authzv1 "github.com/grafana/authlib/authz/proto/v1"
	"github.com/grafana/authlib/types"
	"golang.org/x/sync/errgroup"
	"golang.org/x/sync/singleflight"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/client-go/dynamic"

	iamv0 "github.com/grafana/grafana/apps/iam/pkg/apis/iam/v0alpha1"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/infra/localcache"
	"github.com/grafana/grafana/pkg/infra/log"
	ac "github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/apiserver/restcfg"
	"github.com/grafana/grafana/pkg/services/authz/zanzana"
	"github.com/grafana/grafana/pkg/services/authz/zanzana/common"
	"github.com/grafana/grafana/pkg/services/user"
)

var zLogger = log.New("accesscontrol.zanzana_resolver")

// ZanzanaPermissionResolver handles resolving user permissions using Zanzana
type ZanzanaPermissionResolver struct {
	client        zanzana.Client
	userSvc       user.Service
	scopeResolver *uidToIDResolver
	// useExternalGroups mirrors cfg.IDUseExternalGroupsForGroupsClaim: it selects which
	// team memberships are sent as Zanzana contextual tuples for the current user, so the
	// merged permissions match what the forward Check path (which uses the groups claim)
	// enforces.
	useExternalGroups bool
}

func NewZanzanaPermissionResolver(
	client zanzana.Client,
	userSvc user.Service,
	configProvider restcfg.RestConfigProvider,
	useExternalGroups bool,
) *ZanzanaPermissionResolver {
	return &ZanzanaPermissionResolver{
		client:            client,
		userSvc:           userSvc,
		useExternalGroups: useExternalGroups,
		scopeResolver:     newUIDToIDResolver(configProvider),
	}
}

// teamsForCurrentUser returns the team memberships to send as Zanzana contextual tuples
// for the signed-in user, mirroring the id token groups claim (resolveGroupsClaim):
// proxy/IdP-supplied external groups when id_use_external_groups_for_groups_claim is set,
// otherwise the user's stored team memberships. Without this, team-based grants are not
// reflected in the merged legacy permissions.
func (r *ZanzanaPermissionResolver) teamsForCurrentUser(usr identity.Requester) []string {
	if r.useExternalGroups {
		return usr.GetExternalGroups()
	}
	return usr.GetGroups()
}

// ResolveCurrentUserPermissions lists Zanzana-supported permissions for the signed-in identity.
func (r *ZanzanaPermissionResolver) ResolveCurrentUserPermissions(ctx context.Context, usr identity.Requester) ([]ac.Permission, error) {
	subject := usr.GetUID()
	namespace := types.OrgNamespaceFormatter(usr.GetOrgID())
	return r.listAllWithPrefix(ctx, namespace, subject, r.teamsForCurrentUser(usr), "", "")
}

// searchUsersPermissions searches for users' permissions using Zanzana
func (r *ZanzanaPermissionResolver) SearchUsersPermissions(ctx context.Context, signedInUser identity.Requester, orgID int64, options ac.SearchOptions) (map[int64][]ac.Permission, error) {
	// If we have a specific user ID, search for that user
	if options.UserID > 0 {
		return r.searchSingleUser(ctx, orgID, options.UserID, options)
	}

	// Otherwise, we need to search across all users with the given action
	return r.searchAllUsers(ctx, signedInUser, orgID, options)
}

// searchSingleUser searches permissions for a single user.
func (r *ZanzanaPermissionResolver) searchSingleUser(ctx context.Context, orgID, userID int64, options ac.SearchOptions) (map[int64][]ac.Permission, error) {
	usr, err := r.userSvc.GetByID(ctx, &user.GetUserByIDQuery{ID: userID})
	if err != nil {
		return nil, fmt.Errorf("failed to get user: %w", err)
	}
	return r.searchPermissionsForIdentity(ctx, orgID, userID, usr.UID, usr.IsServiceAccount, options)
}

// searchPermissionsForIdentity resolves permissions when uid and account type are already known.
// Used by searchAllUsers with data from user.Search (avoids one GetByID per user). Search results
// only include non-service accounts; pass isServiceAccount accordingly for other call sites.
func (r *ZanzanaPermissionResolver) searchPermissionsForIdentity(ctx context.Context, orgID, userID int64, uid string, isServiceAccount bool, options ac.SearchOptions) (map[int64][]ac.Permission, error) {
	result := make(map[int64][]ac.Permission)
	permissions := []ac.Permission{}

	var subject string
	if isServiceAccount {
		subject = types.NewTypeID(types.TypeServiceAccount, uid)
	} else {
		subject = types.NewTypeID(types.TypeUser, uid)
	}

	namespace := types.OrgNamespaceFormatter(orgID)

	var err error
	if options.Action != "" {
		group, resource, verb := common.TranslateActionToListParams(options.Action)
		if group != "" && resource != "" {
			// Per-user search resolves another identity's permissions; their request-time
			// contextual team membership isn't available here, so no teams are passed.
			perms, err := r.listPermissions(ctx, namespace, subject, nil, group, resource, verb, options.Action, options.Scope)
			if err != nil {
				return nil, err
			}
			permissions = append(permissions, perms...)
		}
	} else if options.ActionPrefix != "" {
		permissions, err = r.listAllWithPrefix(ctx, namespace, subject, nil, options.ActionPrefix, options.Scope)
		if err != nil {
			return nil, err
		}
	} else {
		// Neither action nor prefix specified (namespacedId-only query): list every supported action.
		permissions, err = r.listAllWithPrefix(ctx, namespace, subject, nil, "", options.Scope)
		if err != nil {
			return nil, err
		}
	}

	if len(permissions) > 0 {
		result[userID] = permissions
	}

	return result, nil
}

// searchAllUsers searches permissions across all users for a given action
func (r *ZanzanaPermissionResolver) searchAllUsers(ctx context.Context, signedInUser identity.Requester, orgID int64, options ac.SearchOptions) (map[int64][]ac.Permission, error) {
	result := make(map[int64][]ac.Permission)

	if options.Action == "" && options.ActionPrefix == "" {
		return result, nil
	}

	// Keep the same semantics as the legacy endpoint and iterate over all pages.
	const usersPageSize = 500
	const maxConcurrentRequests = 16
	page := 1
	for {
		searchQuery := &user.SearchUsersQuery{
			SignedInUser: signedInUser,
			OrgID:        orgID,
			Query:        "",
			Page:         page,
			Limit:        usersPageSize,
		}
		searchResult, err := r.userSvc.Search(ctx, searchQuery)
		if err != nil {
			return nil, fmt.Errorf("failed to search users: %w", err)
		}
		if len(searchResult.Users) == 0 {
			break
		}

		var mu sync.Mutex
		g, gctx := errgroup.WithContext(ctx)
		g.SetLimit(maxConcurrentRequests)
		for _, userHit := range searchResult.Users {
			userHit := userHit
			g.Go(func() error {
				var userPerms map[int64][]ac.Permission
				var err error
				// user.Search already returns id and uid; org user search excludes service accounts.
				if userHit.UID != "" {
					userPerms, err = r.searchPermissionsForIdentity(gctx, orgID, userHit.ID, userHit.UID, false, options)
				} else {
					userPerms, err = r.searchSingleUser(gctx, orgID, userHit.ID, options)
				}
				if err != nil {
					if errors.Is(err, context.Canceled) || errors.Is(err, context.DeadlineExceeded) {
						return err
					}
					zLogger.Warn("failed to resolve zanzana permissions for user", "userID", userHit.ID, "error", err)
					return nil
				}

				if len(userPerms) > 0 {
					mu.Lock()
					for uid, perms := range userPerms {
						if len(perms) > 0 {
							result[uid] = perms
						}
					}
					mu.Unlock()
				}
				return nil
			})
		}
		if err := g.Wait(); err != nil {
			return nil, err
		}

		if len(searchResult.Users) < usersPageSize {
			break
		}
		page++
		if int64((page-1)*usersPageSize) >= searchResult.TotalCount {
			break
		}
		if ctx.Err() != nil {
			return nil, ctx.Err()
		}
	}

	return result, nil
}

// resourceScope scopes an object by the resource type Zanzana listed it under
// (e.g. "folders:uid:abc"), not by the action prefix, so permission actions like
// "folders.permissions:read" stay scoped on "folders:uid:<uid>".
func resourceScope(resource, name string) string {
	return ac.Scope(resource, "uid", name)
}

// resourceWildcardScope is the org-wide scope for the listed resource ("folders:*").
func resourceWildcardScope(resource string) string {
	return ac.Scope(resource, "*")
}

// folderScopeForLegacyRBAC returns a legacy RBAC scope for folder-scoped access (folders:uid:<uid>).
func folderScopeForLegacyRBAC(folderUID string) string {
	return ac.Scope("folders", "uid", folderUID)
}

// isDashboardRBACAction matches actions backed by the dashboard generic list path, which returns
// both direct dashboard objects (Items) and enclosing folders (Folders).
func isDashboardRBACAction(action string) bool {
	return strings.HasPrefix(action, "dashboards:")
}

// isTeamRBACAction matches team-management actions whose scopes need UID→ID translation.
func isTeamRBACAction(action string) bool {
	return strings.HasPrefix(action, "teams:") || strings.HasPrefix(action, "teams.")
}

// resolveTeamScope translates a team UID to the legacy teams:id:<numericID> scope.
func (r *ZanzanaPermissionResolver) resolveTeamScope(ctx context.Context, namespace, teamUID string) (string, error) {
	if r.scopeResolver == nil {
		return "", errors.New("scope resolver not initialized")
	}
	nsInfo, err := types.ParseNamespace(namespace)
	if err != nil {
		return "", fmt.Errorf("failed to parse namespace: %w", err)
	}
	id, err := r.scopeResolver.GetTeamIDByUID(ctx, nsInfo, teamUID)
	if err != nil {
		return "", err
	}
	return ac.Scope("teams", "id", fmt.Sprintf("%d", id)), nil
}

// teamWildcardScope returns the legacy wildcard scope for teams (teams:id:*).
func teamWildcardScope() string {
	return ac.Scope("teams", "id", "*")
}

// isUserRBACAction matches user-management actions, including the org.users:* family.
func isUserRBACAction(action string) bool {
	return strings.HasPrefix(action, "users:") || strings.HasPrefix(action, "users.") ||
		strings.HasPrefix(action, "org.users:")
}

// userScopeKind returns the legacy RBAC scope kind for a user-management action.
// Most user actions are server-level and scoped to global.users (users:read/write/delete and
// users.permissions:write all grant global.users:* in the fixed roles). The org-level
// exceptions, scoped to the users kind, are users.permissions:read (fixed:org.users:reader)
// and the org.users:* family (fixed:org.users:reader/writer).
func userScopeKind(action string) string {
	// users.permissions:read and the org.users:* family are org-scoped (the users kind);
	// the remaining user-management actions are server-level (global.users).
	if action == ac.ActionUsersPermissionsRead || strings.HasPrefix(action, "org.users:") {
		return "users"
	}
	return "global.users"
}

// resolveUserScope translates a user UID to the legacy <kind>:id:<numericID> scope for the action.
func (r *ZanzanaPermissionResolver) resolveUserScope(ctx context.Context, namespace, action, userUID string) (string, error) {
	if r.scopeResolver == nil {
		return "", errors.New("scope resolver not initialized")
	}
	nsInfo, err := types.ParseNamespace(namespace)
	if err != nil {
		return "", fmt.Errorf("failed to parse namespace: %w", err)
	}
	id, err := r.scopeResolver.GetUserIDByUID(ctx, nsInfo, userUID)
	if err != nil {
		return "", err
	}
	return ac.Scope(userScopeKind(action), "id", fmt.Sprintf("%d", id)), nil
}

// userWildcardScope returns the legacy wildcard scope for a user action (<kind>:id:*).
func userWildcardScope(action string) string {
	return ac.Scope(userScopeKind(action), "id", "*")
}

// listPermissions lists permissions for a subject on a given group/resource
func (r *ZanzanaPermissionResolver) listPermissions(ctx context.Context, namespace, subject string, teams []string, group, resource, verb, action, scope string) ([]ac.Permission, error) {
	req := &authzv1.ListRequest{
		Namespace: namespace,
		Subject:   subject,
		Group:     group,
		Verb:      verb,
		Resource:  resource,
		Teams:     teams,
	}

	resp, err := r.client.List(ctx, req)
	if err != nil {
		return nil, fmt.Errorf("zanzana list failed: %w", err)
	}

	permissions := []ac.Permission{}

	// Build the set of scopes that satisfy the filter: the exact scope plus
	// every wildcard that encompasses it (mirrors legacy RBAC semantics).
	// e.g. scope "folders:uid:abc" matches "folders:uid:abc", "folders:uid:*", "folders:*", "*".
	var scopeSet map[string]struct{}
	if scope != "" {
		wildcards := ac.WildcardsFromPrefix(ac.ScopePrefix(scope))
		scopeSet = make(map[string]struct{}, len(wildcards)+1)
		scopeSet[scope] = struct{}{}
		for _, w := range wildcards {
			scopeSet[w] = struct{}{}
		}
	}

	appendIfMatches := func(p ac.Permission) {
		if scope == "" {
			permissions = append(permissions, p)
			return
		}
		if _, ok := scopeSet[p.Scope]; ok {
			permissions = append(permissions, p)
		}
	}

	// If All is true, the user has access to all resources of this type.
	if resp.All {
		if isDashboardRBACAction(action) {
			// Legacy RBAC sometimes stores scope "*" for org-wide dashboard access. Only add it
			// when there is no scope filter: with a non-empty filter, "*" would match queries where
			// legacy rows only had dashboards:* / folders:* (see PermissionMatchesSearchOptions).
			if scope == "" {
				appendIfMatches(ac.Permission{
					Action: action,
					Scope:  "*",
				})
			}
			appendIfMatches(ac.Permission{
				Action: action,
				Scope:  resourceWildcardScope(resource),
			})
			// Generic dashboard list grants org-wide dashboard access; legacy RBAC also records
			// folder wildcard for the same action (see SearchUsersPermissions / Reduce).
			appendIfMatches(ac.Permission{
				Action: action,
				Scope:  ac.Scope("folders", "*"),
			})
		} else if isTeamRBACAction(action) {
			appendIfMatches(ac.Permission{
				Action: action,
				Scope:  teamWildcardScope(),
			})
		} else if isUserRBACAction(action) {
			appendIfMatches(ac.Permission{
				Action: action,
				Scope:  userWildcardScope(action),
			})
		} else {
			appendIfMatches(ac.Permission{
				Action: action,
				Scope:  resourceWildcardScope(resource),
			})
		}
	}

	// Items are objects of the listed resource type, scoped by that resource.
	// Team and user actions need UID→ID translation so scopes match legacy RBAC
	// (teams:id:<n> / users:id:<n>).
	for _, item := range resp.Items {
		var itemScope string
		switch {
		case isTeamRBACAction(action):
			resolved, err := r.resolveTeamScope(ctx, namespace, item)
			if err != nil {
				zLogger.Warn("failed to resolve team UID to ID, using uid scope", "uid", item, "error", err)
				itemScope = resourceScope(resource, item)
			} else {
				itemScope = resolved
			}
		case isUserRBACAction(action):
			resolved, err := r.resolveUserScope(ctx, namespace, action, item)
			if err != nil {
				zLogger.Warn("failed to resolve user UID to ID, using uid scope", "uid", item, "error", err)
				itemScope = resourceScope(resource, item)
			} else {
				itemScope = resolved
			}
		default:
			itemScope = resourceScope(resource, item)
		}
		appendIfMatches(ac.Permission{
			Action: action,
			Scope:  itemScope,
		})
	}

	// listGeneric on the Zanzana server returns folder UIDs separately; map them to folders:uid:*
	// scopes so they match legacy RBAC (not dashboards:uid:<folderUID>).
	for _, folderUID := range resp.Folders {
		appendIfMatches(ac.Permission{
			Action: action,
			Scope:  folderScopeForLegacyRBAC(folderUID),
		})
	}

	return permissions, nil
}

func (r *ZanzanaPermissionResolver) listAllWithPrefix(ctx context.Context, namespace, subject string, teams []string, prefix, scope string) ([]ac.Permission, error) {
	var permissions []ac.Permission
	for _, entry := range common.SupportedActions() {
		if strings.HasPrefix(entry.Action, prefix) {
			perms, err := r.listPermissions(ctx, namespace, subject, teams, entry.Group, entry.Resource, entry.Verb, entry.Action, scope)
			if err != nil {
				if errors.Is(err, context.Canceled) || errors.Is(err, context.DeadlineExceeded) {
					return nil, err
				}
				zLogger.Warn("failed to list zanzana permissions for action, skipping", "action", entry.Action, "error", err)
				continue
			}
			permissions = append(permissions, perms...)
		}
	}
	return permissions, nil
}

// permKey is the dedup key for action+scope pairs. Using a struct avoids the
// per-permission string concatenation that the previous "action|scope" form did.
type permKey struct {
	action string
	scope  string
}

// MergePermissions unions permissions from two sources, deduplicating by action+scope per user.
// Inputs are consumed: returned slices may alias entries in a or b, so callers must not retain
// or mutate the inputs after this call.
func MergePermissions(a, b map[int64][]ac.Permission) map[int64][]ac.Permission {
	if len(b) == 0 {
		return a
	}
	if len(a) == 0 {
		return b
	}

	result := make(map[int64][]ac.Permission, len(a)+len(b))
	// Users only in a: alias the slice. No copy until we know we'll mutate it.
	for userID, perms := range a {
		result[userID] = perms
	}

	for userID, perms := range b {
		existing, ok := result[userID]
		if !ok || len(existing) == 0 {
			result[userID] = perms
			continue
		}

		seen := make(map[permKey]struct{}, len(existing)+len(perms))
		for _, p := range existing {
			seen[permKey{p.Action, p.Scope}] = struct{}{}
		}
		// Single allocation sized to the worst-case merged length; avoids
		// repeated grow during the append loop and also detaches from a's slice.
		merged := make([]ac.Permission, len(existing), len(existing)+len(perms))
		copy(merged, existing)
		for _, p := range perms {
			k := permKey{p.Action, p.Scope}
			if _, dup := seen[k]; dup {
				continue
			}
			merged = append(merged, p)
			seen[k] = struct{}{}
		}
		result[userID] = merged
	}

	return result
}

// MergeUserPermissions unions permissions from legacy RBAC and Zanzana for a single user,
// deduplicating by action+scope. Mutates and returns the legacy slice (after a single
// pre-grow if needed).
func MergeUserPermissions(legacy, zanzana []ac.Permission) []ac.Permission {
	if len(zanzana) == 0 {
		return legacy
	}

	seen := make(map[permKey]struct{}, len(legacy)+len(zanzana))
	for _, p := range legacy {
		seen[permKey{p.Action, p.Scope}] = struct{}{}
	}
	// Pre-grow once to the worst-case combined length so the append loop never reallocates.
	if cap(legacy)-len(legacy) < len(zanzana) {
		grown := make([]ac.Permission, len(legacy), len(legacy)+len(zanzana))
		copy(grown, legacy)
		legacy = grown
	}
	for _, p := range zanzana {
		k := permKey{p.Action, p.Scope}
		if _, dup := seen[k]; dup {
			continue
		}
		legacy = append(legacy, p)
		seen[k] = struct{}{}
	}
	return legacy
}

// MergeCurrentUser unions a single identity's legacy permissions with the ones Zanzana
// resolves for migrated resources. It returns legacy unchanged when the resolver is nil
// (Zanzana merge disabled) or when the Zanzana lookup fails, so callers don't need to
// guard the nil case or handle the error themselves.
func (r *ZanzanaPermissionResolver) MergeCurrentUser(ctx context.Context, usr identity.Requester, legacy []ac.Permission, log log.Logger) []ac.Permission {
	if r == nil {
		return legacy
	}
	zPerms, err := r.ResolveCurrentUserPermissions(ctx, usr)
	if err != nil {
		log.Warn("could not get zanzana user permissions, using legacy only", "error", err)
		return legacy
	}
	return MergeUserPermissions(legacy, zPerms)
}

// MergeSearch unions per-user legacy permissions with the ones Zanzana resolves for migrated
// resources. It returns legacy unchanged when the resolver is nil (Zanzana merge disabled) or
// when the Zanzana lookup fails, so callers don't need to guard the nil case or the error.
func (r *ZanzanaPermissionResolver) MergeSearch(ctx context.Context, usr identity.Requester, orgID int64, options ac.SearchOptions, legacy map[int64][]ac.Permission, log log.Logger) map[int64][]ac.Permission {
	if r == nil {
		return legacy
	}
	zPerms, err := r.SearchUsersPermissions(ctx, usr, orgID, options)
	if err != nil {
		log.Warn("could not get zanzana user permissions, using legacy only", "error", err)
		return legacy
	}
	return MergePermissions(legacy, zPerms)
}

// GVRs are derived from the IAM resource info so the group/version/resource always match what
// the apiserver serves, instead of hardcoding (which previously drifted to the wrong group).
var (
	teamGVR = iamv0.TeamResourceInfo.GroupVersionResource()
	userGVR = iamv0.UserResourceInfo.GroupVersionResource()
)

// UID→internal-ID mappings are immutable for an object's lifetime, so a long TTL is safe;
// the bound just caps memory and tolerates the rare deleted-then-absent UID.
const uidToIDCacheTTL = 1 * time.Hour

// Bounds the detached singleflight fetch. The fetch runs on a context decoupled from any single
// caller (see getObjectID), so without this a hung apiserver Get would block the flight—and every
// follower waiting on it—indefinitely.
const uidToIDFetchTimeout = 10 * time.Second

type uidToIDResolver struct {
	mu             sync.RWMutex
	clients        map[schema.GroupVersionResource]dynamic.NamespaceableResourceInterface
	configProvider restcfg.RestConfigProvider
	// cache stores resolved UID→internal-ID mappings; sf collapses concurrent resolutions
	// of the same key into a single apiserver Get. Both teams and users resolve through here,
	// and the same UIDs recur across every action during a permission merge, so this removes
	// the bulk of the redundant apiserver lookups.
	cache *localcache.CacheService
	sf    singleflight.Group
}

func newUIDToIDResolver(configProvider restcfg.RestConfigProvider) *uidToIDResolver {
	return &uidToIDResolver{
		clients:        make(map[schema.GroupVersionResource]dynamic.NamespaceableResourceInterface),
		configProvider: configProvider,
		cache:          localcache.New(uidToIDCacheTTL, 10*time.Minute),
	}
}

func (r *uidToIDResolver) getDynamicClient(ctx context.Context, nsInfo types.NamespaceInfo, gvr schema.GroupVersionResource) (dynamic.ResourceInterface, error) {
	r.mu.RLock()
	cli, ok := r.clients[gvr]
	r.mu.RUnlock()
	if ok {
		return cli.Namespace(nsInfo.Value), nil
	}

	if r.configProvider == nil {
		return nil, errors.New("config provider not initialized")
	}

	restCfg, err := r.configProvider.GetRestConfig(ctx)
	if err != nil {
		return nil, err
	}

	dyn, err := dynamic.NewForConfig(restCfg)
	if err != nil {
		return nil, err
	}
	cli = dyn.Resource(gvr)

	r.mu.Lock()
	r.clients[gvr] = cli
	r.mu.Unlock()

	return cli.Namespace(nsInfo.Value), nil
}

func (r *uidToIDResolver) getObjectID(ctx context.Context, nsInfo types.NamespaceInfo, gvr schema.GroupVersionResource, name string) (int64, error) {
	// Key by resource type so team/user UIDs can't collide, and by the namespace value the
	// fetch actually scopes the Get on (cli.Namespace(nsInfo.Value) in fetchObjectID), so
	// tenants stay isolated. Don't key on OrgID: multiple namespaces can share an OrgID
	// (every cloud stacks-N namespace parses to OrgID 1), which would collide their entries
	// and collapse cross-tenant resolutions into a single singleflight fetch.
	key := fmt.Sprintf("%s/%s/%s", gvr.Resource, nsInfo.Value, name)
	if v, ok := r.cache.Get(key); ok {
		return v.(int64), nil
	}

	ch := r.sf.DoChan(key, func() (any, error) {
		// Re-check under the flight: a concurrent resolution may have populated the cache
		// while we were waiting for the singleflight slot.
		if v, ok := r.cache.Get(key); ok {
			return v.(int64), nil
		}
		// Detach from the caller's context so one caller cancelling (request timeout, client
		// disconnect) does not fail the shared fetch for every other caller on this flight.
		// A bounded timeout still prevents a hung Get from blocking the flight forever.
		fetchCtx, cancel := context.WithTimeout(context.WithoutCancel(ctx), uidToIDFetchTimeout)
		defer cancel()
		id, err := r.fetchObjectID(fetchCtx, nsInfo, gvr, name)
		if err != nil {
			return 0, err
		}
		// Only cache successful lookups, and skip id == 0: that is the sentinel returned when the
		// deprecated internal-ID label is missing/unparseable (e.g. a dual-write window), so caching
		// it would pin a bogus value for the full TTL instead of re-resolving once it's populated.
		if id != 0 {
			r.cache.Set(key, id, uidToIDCacheTTL)
		}
		return id, nil
	})

	// Wait on this caller's own context so a cancelled caller returns promptly while the
	// shared fetch continues for everyone else.
	select {
	case <-ctx.Done():
		return 0, ctx.Err()
	case res := <-ch:
		if res.Err != nil {
			return 0, res.Err
		}
		return res.Val.(int64), nil
	}
}

func (r *uidToIDResolver) fetchObjectID(ctx context.Context, nsInfo types.NamespaceInfo, gvr schema.GroupVersionResource, name string) (int64, error) {
	cli, err := r.getDynamicClient(ctx, nsInfo, gvr)
	if err != nil {
		return 0, err
	}

	srvCtx := identity.WithServiceIdentityContext(ctx, nsInfo.OrgID)
	result, err := cli.Get(srvCtx, name, metav1.GetOptions{})
	if err != nil {
		return 0, err
	}

	meta, err := utils.MetaAccessor(result)
	if err != nil {
		return 0, err
	}
	return meta.GetDeprecatedInternalID(), nil // nolint:staticcheck
}

func (r *uidToIDResolver) GetTeamIDByUID(ctx context.Context, nsInfo types.NamespaceInfo, uid string) (int64, error) {
	return r.getObjectID(ctx, nsInfo, teamGVR, uid)
}

func (r *uidToIDResolver) GetUserIDByUID(ctx context.Context, nsInfo types.NamespaceInfo, uid string) (int64, error) {
	return r.getObjectID(ctx, nsInfo, userGVR, uid)
}
