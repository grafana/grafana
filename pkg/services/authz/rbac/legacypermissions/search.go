package legacypermissions

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"slices"
	"sort"
	"strings"

	authzlib "github.com/grafana/authlib/authz"
	"github.com/grafana/authlib/types"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
	"google.golang.org/protobuf/proto"
	"k8s.io/apiserver/pkg/endpoints/request"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	authzv1 "github.com/grafana/grafana/pkg/services/authz/proto/v1"
	"github.com/grafana/grafana/pkg/services/authz/rbac/store"
	"github.com/grafana/grafana/pkg/services/contexthandler/ctxkey"
	contextmodel "github.com/grafana/grafana/pkg/services/contexthandler/model"
	"github.com/grafana/grafana/pkg/web"
)

const LegacySearchDelegatedGrant = "authz.grafana.app/legacyuserpermissions:search"

const userPermissionsChunkSize = 1000

type LegacySearchService struct {
	authzv1.UnimplementedLegacyAuthzServiceServer
	store              store.SearchPermissionStore
	staticRoles        func(context.Context) map[string]*accesscontrol.RoleDTO
	actions            accesscontrol.ActionResolver
	enforcementEnabled func() bool
	callerPermissions  func(context.Context, types.NamespaceInfo, *authzv1.LegacyPermissionIdentity, bool) ([]accesscontrol.Permission, error)
	mergePermissions   func(context.Context, identity.Requester, accesscontrol.SearchOptions, map[int64][]accesscontrol.Permission, bool) map[int64][]accesscontrol.Permission
}

func NewLegacySearchService(searchStore store.SearchPermissionStore, staticRoles func(context.Context) map[string]*accesscontrol.RoleDTO, actions accesscontrol.ActionResolver) *LegacySearchService {
	return &LegacySearchService{store: searchStore, staticRoles: staticRoles, actions: actions}
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
	if uid == "" || !types.IsIdentityType(kind, types.TypeUser, types.TypeServiceAccount, types.TypeAnonymous, types.TypeRenderService, types.TypeAPIKey) {
		return status.Error(codes.InvalidArgument, "a supported legacy caller identity is required")
	}
	if req.GetUserId() <= 0 && req.GetAction() == "" && req.GetActionPrefix() == "" {
		return status.Error(codes.InvalidArgument, "an action filter or target is required")
	}
	if req.GetAction() != "" && req.GetActionPrefix() != "" {
		return status.Error(codes.InvalidArgument, "action and action prefix are mutually exclusive")
	}
	ctx = request.WithNamespace(ctx, ns.Value)
	caller := proto.Clone(req.Caller).(*authzv1.LegacyPermissionIdentity)
	userCaller := types.IsIdentityType(kind, types.TypeUser, types.TypeServiceAccount)
	if userCaller {
		callerID, err := s.store.GetSearchCallerID(ctx, ns, kind, uid, caller.InternalId)
		if err != nil {
			return searchRPCError(err, codes.PermissionDenied, "caller could not be resolved")
		}
		caller.InternalId = &callerID
	} else if s.callerPermissions == nil {
		return status.Error(codes.PermissionDenied, "caller permission evaluator is required")
	}
	enforced := s.enforcementEnabled != nil && s.enforcementEnabled()
	var callerPermissions []accesscontrol.Permission
	if s.callerPermissions != nil {
		callerPermissions, err = s.callerPermissions(ctx, ns, caller, enforced)
	} else {
		var result map[int64][]accesscontrol.Permission
		result, err = s.search(ctx, ns, accesscontrol.SearchOptions{UserID: caller.GetInternalId(), Action: accesscontrol.ActionUsersPermissionsRead}, enforced)
		callerPermissions = result[caller.GetInternalId()]
	}
	if err != nil {
		return searchRPCError(err, codes.Internal, "could not evaluate caller visibility")
	}
	visible := searchVisibility(callerPermissions)
	options := accesscontrol.SearchOptions{UserID: req.GetUserId(), Action: req.GetAction(), ActionPrefix: req.GetActionPrefix(), Scope: req.GetScope()}
	if options.UserID > 0 && !visible(options.UserID) {
		return status.Error(codes.PermissionDenied, "target permission search denied")
	}
	results, err := s.search(ctx, ns, options, enforced)
	if err != nil {
		return searchRPCError(err, codes.Internal, err.Error())
	}
	if s.mergePermissions != nil {
		requester := searchRequester(ns, caller, callerPermissions)
		results = s.mergePermissions(withSearchDirectoryContext(ctx, requester, ns.Value), requester, options, results, enforced)
	}
	return streamSearchResults(ctx, stream, results, visible)
}

func withSearchDirectoryContext(ctx context.Context, requester *legacyRequester, namespace string) context.Context {
	// Native IAM's directory needs a request context and service authorization
	// for broad searches. The RPC has already checked caller visibility and
	// filters results again before streaming; only validated caller data is
	// placed in this context.
	ctx = identity.WithOrgID(ctx, requester.GetOrgID())
	ctx = identity.WithServiceIdentityContext(ctx, requester.GetOrgID(), func(service *identity.StaticRequester) {
		service.Namespace = namespace
	})
	req := (&http.Request{Method: http.MethodGet}).WithContext(ctx)
	return ctxkey.Set(ctx, &contextmodel.ReqContext{
		Context:      &web.Context{Req: req},
		SignedInUser: requester.SignedInUser,
	})
}

func searchRPCError(err error, fallback codes.Code, message string) error {
	if errors.Is(err, context.Canceled) || errors.Is(err, context.DeadlineExceeded) {
		return status.FromContextError(err).Err()
	}
	return status.Error(fallback, message)
}

func searchVisibility(permissions []accesscontrol.Permission) func(int64) bool {
	var scopes []string
	for _, permission := range permissions {
		if permission.Action == accesscontrol.ActionUsersPermissionsRead {
			scopes = append(scopes, permission.Scope)
		}
	}
	ids := map[any]struct{}{}
	for _, prefix := range []string{"users:id:", "global.users:id:"} {
		parsed, all := accesscontrol.ParseScopes(prefix, scopes)
		if all {
			return func(int64) bool { return true }
		}
		for id := range parsed {
			ids[id] = struct{}{}
		}
	}
	return func(id int64) bool {
		_, ok := ids[id]
		return ok
	}
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
				chunk.Permissions = append(chunk.Permissions, &authzv1.LegacyUserPermission{Action: p.Action, Scope: p.Scope})
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

func (s *LegacySearchService) search(ctx context.Context, ns types.NamespaceInfo, options accesscontrol.SearchOptions, enforced bool) (map[int64][]accesscontrol.Permission, error) {
	// Role and membership mutations do not invalidate filtered search results,
	// and self-permission reload only refreshes enumeration caches. Read current
	// grants on each search until invalidation can cross the RPC boundary.
	options.RolePrefixes = []string{accesscontrol.ManagedRolePrefix, accesscontrol.ExternalServiceRolePrefix}
	if enforced {
		options.RolePrefixes = nil
	}
	var roles map[int64][]string
	if !enforced {
		var filter []int64
		if options.UserID > 0 {
			filter = []int64{options.UserID}
		}
		var err error
		roles, err = s.store.GetUsersBasicRoles(ctx, ns, filter)
		if err != nil {
			return nil, err
		}
		if options.UserID > 0 {
			if _, ok := roles[options.UserID]; !ok {
				return nil, fmt.Errorf("found no basic roles for user %d in organisation %d", options.UserID, ns.OrgID)
			}
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
	if enforced {
		// Licensed searches include stored global grants even for targets without
		// organization membership, and retain empty records for positive targets.
		roles = make(map[int64][]string, len(stored)+1)
		for id := range stored {
			roles[id] = nil
		}
		if options.UserID > 0 {
			roles[options.UserID] = nil
		}
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
