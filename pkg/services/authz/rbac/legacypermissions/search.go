package legacypermissions

import (
	"context"
	"fmt"
	"slices"
	"sort"
	"strconv"
	"strings"
	"time"

	authzlib "github.com/grafana/authlib/authz"
	"github.com/grafana/authlib/types"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
	"google.golang.org/protobuf/proto"
	"k8s.io/apiserver/pkg/endpoints/request"

	"github.com/grafana/grafana/pkg/infra/localcache"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/metrics"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	authzv1 "github.com/grafana/grafana/pkg/services/authz/proto/v1"
	"github.com/grafana/grafana/pkg/services/authz/rbac/store"
	"github.com/grafana/grafana/pkg/services/user"
)

const LegacySearchDelegatedGrant = "authz.grafana.app/legacyuserpermissions:search"

const userPermissionsChunkSize = 1000

type LegacySearchService struct {
	authzv1.UnimplementedLegacyAuthzServiceServer
	store              store.SearchPermissionStore
	staticRoles        func(context.Context) map[string]*accesscontrol.RoleDTO
	actions            accesscontrol.ActionResolver
	cache              *localcache.CacheService
	enforcementEnabled func() bool
	callerPermissions  func(context.Context, types.NamespaceInfo, *authzv1.LegacyPermissionIdentity, bool) ([]accesscontrol.Permission, error)
}

func NewLegacySearchService(searchStore store.SearchPermissionStore, staticRoles func(context.Context) map[string]*accesscontrol.RoleDTO, actions accesscontrol.ActionResolver, cache *localcache.CacheService) *LegacySearchService {
	return &LegacySearchService{store: searchStore, staticRoles: staticRoles, actions: actions, cache: cache}
}

func (s *LegacySearchService) LegacySearchUsersPermissions(req *authzv1.LegacySearchUsersPermissionsRequest, stream authzv1.LegacyAuthzService_LegacySearchUsersPermissionsServer) error {
	ctx := stream.Context()
	if _, ok := types.AuthInfoFrom(ctx); !ok {
		return status.Error(codes.Unauthenticated, "authentication is required")
	}
	if req == nil || req.Caller == nil {
		return status.Error(codes.InvalidArgument, "caller identity is required")
	}
	info, _ := types.AuthInfoFrom(ctx)
	if !types.NamespaceMatches(info.GetNamespace(), req.GetNamespace()) {
		return status.Error(codes.PermissionDenied, "namespace mismatch")
	}
	ns, err := types.ParseNamespace(req.GetNamespace())
	if err != nil {
		if status.Code(err) == codes.Unknown {
			return status.Error(codes.InvalidArgument, "invalid namespace")
		}
		return err
	}
	if ns.OrgID <= 0 {
		return status.Error(codes.InvalidArgument, "invalid namespace")
	}
	permission := authzlib.CheckServicePermissions(info, "authz.grafana.app", "legacyuserpermissions", "search")
	if !permission.ServiceCall || !permission.Allowed {
		return status.Error(codes.PermissionDenied, "permission search request denied")
	}
	kind, uid := types.IdentityType(req.Caller.Type), req.Caller.Uid
	if uid == "" || !types.IsIdentityType(kind, types.TypeUser, types.TypeServiceAccount) {
		return status.Error(codes.InvalidArgument, "a user or service account subject is required")
	}
	if req.GetUserId() <= 0 && req.GetAction() == "" && req.GetActionPrefix() == "" {
		return status.Error(codes.InvalidArgument, "an action filter or target is required")
	}
	if req.GetAction() != "" && req.GetActionPrefix() != "" {
		return status.Error(codes.InvalidArgument, "action and action prefix are mutually exclusive")
	}
	ctx = request.WithNamespace(ctx, ns.Value)
	callerID, err := s.store.GetSearchCallerID(ctx, ns, kind, uid, req.Caller.InternalId)
	if err != nil {
		return status.Error(codes.PermissionDenied, "caller could not be resolved")
	}
	enforced := s.enforcementEnabled != nil && s.enforcementEnabled()
	var callerPermissions []accesscontrol.Permission
	if s.callerPermissions != nil {
		caller := proto.Clone(req.Caller).(*authzv1.LegacyPermissionIdentity)
		caller.InternalId = &callerID
		callerPermissions, err = s.callerPermissions(ctx, ns, caller, enforced)
	} else {
		var result map[int64][]accesscontrol.Permission
		result, err = s.search(ctx, ns, accesscontrol.SearchOptions{UserID: callerID, Action: accesscontrol.ActionUsersPermissionsRead}, enforced, false)
		callerPermissions = result[callerID]
	}
	if err != nil {
		return status.Error(codes.Internal, "could not evaluate caller visibility")
	}
	visible := searchVisibility(callerPermissions)
	options := accesscontrol.SearchOptions{UserID: req.GetUserId(), Action: req.GetAction(), ActionPrefix: req.GetActionPrefix(), Scope: req.GetScope()}
	if options.UserID > 0 && !visible(options.UserID) {
		return status.Error(codes.PermissionDenied, "target permission search denied")
	}
	results, err := s.search(ctx, ns, options, enforced, true)
	if err != nil {
		return status.Error(codes.Internal, err.Error())
	}
	return streamSearchResults(ctx, stream, results, visible)
}

func searchVisibility(permissions []accesscontrol.Permission) func(int64) bool {
	ids := map[int64]bool{}
	for _, permission := range permissions {
		if permission.Action != accesscontrol.ActionUsersPermissionsRead {
			continue
		}
		if permission.Scope == "*" || permission.Scope == "users:*" || permission.Scope == "users:id:*" {
			return func(int64) bool { return true }
		}
		if value, ok := strings.CutPrefix(permission.Scope, "users:id:"); ok {
			if id, err := strconv.ParseInt(value, 10, 64); err == nil {
				ids[id] = true
			}
		}
	}
	return func(id int64) bool { return ids[id] }
}

func streamSearchResults(ctx context.Context, stream authzv1.LegacyAuthzService_LegacySearchUsersPermissionsServer, results map[int64][]accesscontrol.Permission, visible func(int64) bool) error {
	ids := make([]int64, 0, len(results))
	for id := range results {
		if visible(id) {
			ids = append(ids, id)
		}
	}
	sort.Slice(ids, func(i, j int) bool { return ids[i] < ids[j] })
	for _, id := range ids {
		if err := ctx.Err(); err != nil {
			return status.FromContextError(err).Err()
		}
		permissions := results[id]
		// Empty target results must still have a stream record to retain the HTTP empty-object contract.
		for start := 0; start < len(permissions) || start == 0; start += userPermissionsChunkSize {
			end := min(start+userPermissionsChunkSize, len(permissions))
			chunk := &authzv1.LegacySearchUsersPermissionsResponse{UserId: id}
			for _, p := range permissions[start:end] {
				chunk.Permissions = append(chunk.Permissions, &authzv1.LegacyPermission{Action: p.Action, Scope: p.Scope})
			}
			if err := stream.Send(chunk); err != nil {
				return err
			}
			if len(permissions) == 0 {
				break
			}
		}
	}
	return nil
}

func (s *LegacySearchService) search(ctx context.Context, ns types.NamespaceInfo, options accesscontrol.SearchOptions, enforced, cacheTarget bool) (map[int64][]accesscontrol.Permission, error) {
	cacheKey := ""
	if cacheTarget && options.UserID > 0 && s.cache != nil {
		key, err := accesscontrol.GetSearchPermissionCacheKey(log.New("authz-permission-search"), &user.SignedInUser{UserID: options.UserID, OrgID: ns.OrgID}, options)
		if err == nil {
			cacheKey = fmt.Sprintf("%s/legacy-search/%t/%s", ns.Value, enforced, key)
		}
		if cacheKey != "" {
			if cached, ok := s.cache.Get(cacheKey); ok {
				metrics.MAccessSearchUserPermissionsCacheUsage.WithLabelValues(accesscontrol.CacheHit).Inc()
				return map[int64][]accesscontrol.Permission{options.UserID: cached.([]accesscontrol.Permission)}, nil
			}
			metrics.MAccessSearchUserPermissionsCacheUsage.WithLabelValues(accesscontrol.CacheMiss).Inc()
		}
	}
	options.RolePrefixes = []string{accesscontrol.ManagedRolePrefix, accesscontrol.ExternalServiceRolePrefix}
	if enforced {
		options.RolePrefixes = nil
	}
	var filter []int64
	if options.UserID > 0 {
		filter = []int64{options.UserID}
	}
	roles, err := s.store.GetUsersBasicRoles(ctx, ns, filter)
	if err != nil {
		return nil, err
	}
	if options.UserID > 0 {
		if _, ok := roles[options.UserID]; !ok {
			return nil, fmt.Errorf("found no basic roles for user %d in organisation %d", options.UserID, ns.OrgID)
		}
	}
	if s.actions != nil {
		options.ActionSets = s.actions.ResolveAction(options.Action)
		options.ActionSets = append(options.ActionSets, s.actions.ResolveActionPrefix(options.ActionPrefix)...)
	}
	stored, err := s.store.SearchUsersPermissions(ctx, ns, options)
	if err != nil {
		return nil, err
	}
	static := map[string]*accesscontrol.RoleDTO{}
	if !enforced {
		static = s.staticRoles(ctx)
	}
	results := map[int64][]accesscontrol.Permission{}
	for id, roleNames := range roles {
		permissions := []accesscontrol.Permission{}
		for _, name := range roleNames {
			role := static[name]
			if role == nil {
				continue
			}
			for _, p := range role.Permissions {
				if searchPermissionMatches(p, &options) {
					permissions = append(permissions, p)
				}
			}
		}
		permissions = append(permissions, stored[id]...)
		if len(options.ActionSets) > 0 && s.actions != nil {
			permissions = s.actions.ExpandActionSetsWithFilter(permissions, func(action string) bool {
				if options.ActionPrefix != "" {
					return strings.HasPrefix(action, options.ActionPrefix)
				}
				return action == options.Action
			})
		}
		if len(permissions) > 0 || options.UserID > 0 {
			results[id] = permissions
		}
	}
	if cacheKey != "" {
		s.cache.Set(cacheKey, results[options.UserID], 60*time.Second)
	}
	return results, nil
}

func searchPermissionMatches(permission accesscontrol.Permission, options *accesscontrol.SearchOptions) bool {
	if options.Scope != "" && !slices.Contains(append(options.Wildcards(), options.Scope), permission.Scope) {
		return false
	}
	if options.Action != "" {
		return permission.Action == options.Action
	}
	return strings.HasPrefix(permission.Action, options.ActionPrefix)
}
