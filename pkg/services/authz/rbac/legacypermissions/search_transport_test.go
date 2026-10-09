package legacypermissions

import (
	"context"
	"errors"
	"fmt"
	"io"
	"net"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"github.com/go-jose/go-jose/v4/jwt"
	authnlib "github.com/grafana/authlib/authn"
	authlib "github.com/grafana/authlib/types"
	"github.com/stretchr/testify/require"
	"google.golang.org/grpc"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/credentials/insecure"
	"google.golang.org/grpc/status"
	"google.golang.org/grpc/test/bufconn"

	"github.com/grafana/grafana/pkg/infra/localcache"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/authz/legacyclient"
	authzv1 "github.com/grafana/grafana/pkg/services/authz/proto/v1"
	"github.com/grafana/grafana/pkg/setting"
)

type legacySearchTestCaller struct {
	kind       authlib.IdentityType
	uid        string
	internalID *int64
}

type legacySearchTestStore struct {
	permissions       []accesscontrol.Permission
	results           map[int64][]accesscontrol.Permission
	namespaceResults  map[string][]accesscontrol.Permission
	visibility        string
	calls             atomic.Int64
	rolesCalls        atomic.Int64
	queryCalls        atomic.Int64
	failCaller        bool
	failRoleOnce      atomic.Bool
	failSearchOnce    atomic.Bool
	denyCaller        atomic.Bool
	blockSearch       <-chan struct{}
	searchStarted     chan struct{}
	searchCanceled    chan struct{}
	mu                sync.Mutex
	lastCaller        legacySearchTestCaller
	lastSearchOptions accesscontrol.SearchOptions
}

func (s *legacySearchTestStore) GetSearchCallerID(_ context.Context, _ authlib.NamespaceInfo, kind authlib.IdentityType, uid string, internalID *int64) (int64, error) {
	s.queryCalls.Add(1)
	s.mu.Lock()
	s.lastCaller = legacySearchTestCaller{kind: kind, uid: uid}
	if internalID != nil {
		id := *internalID
		s.lastCaller.internalID = &id
	}
	s.mu.Unlock()
	if s.failCaller {
		return 0, fmt.Errorf("caller lookup failed")
	}
	return 1, nil
}

func (s *legacySearchTestStore) GetUsersBasicRoles(_ context.Context, _ authlib.NamespaceInfo, ids []int64) (map[int64][]string, error) {
	s.queryCalls.Add(1)
	if len(ids) > 0 {
		if ids[0] != 1 {
			s.rolesCalls.Add(1)
			if s.failRoleOnce.CompareAndSwap(true, false) {
				return nil, fmt.Errorf("role lookup failed")
			}
		}
		return map[int64][]string{ids[0]: {"None"}}, nil
	}
	if s.results != nil {
		roles := make(map[int64][]string, len(s.results))
		for id := range s.results {
			roles[id] = []string{"None"}
		}
		return roles, nil
	}
	return map[int64][]string{2: {"None"}}, nil
}

func (s *legacySearchTestStore) SearchUsersPermissions(ctx context.Context, ns authlib.NamespaceInfo, options accesscontrol.SearchOptions) (map[int64][]accesscontrol.Permission, error) {
	s.queryCalls.Add(1)
	if options.Action == accesscontrol.ActionUsersPermissionsRead {
		if s.denyCaller.Load() {
			return nil, nil
		}
		return map[int64][]accesscontrol.Permission{1: {{Action: accesscontrol.ActionUsersPermissionsRead, Scope: s.visibility}}}, nil
	}
	s.calls.Add(1)
	s.mu.Lock()
	s.lastSearchOptions = options
	s.mu.Unlock()
	if s.blockSearch != nil {
		close(s.searchStarted)
		select {
		case <-s.blockSearch:
		case <-ctx.Done():
			close(s.searchCanceled)
			return nil, ctx.Err()
		}
	}
	if s.failSearchOnce.CompareAndSwap(true, false) {
		return nil, fmt.Errorf("permission lookup failed")
	}
	if s.namespaceResults != nil {
		return map[int64][]accesscontrol.Permission{2: s.namespaceResults[ns.Value]}, nil
	}
	if s.results != nil {
		return s.results, nil
	}
	return map[int64][]accesscontrol.Permission{2: s.permissions}, nil
}

func legacySearchTestAuth(namespace string, grants ...string) authlib.AuthInfo {
	return authnlib.NewAccessTokenAuthInfo(authnlib.Claims[authnlib.AccessTokenClaims]{
		Claims: jwt.Claims{Subject: "access-policy:embedded-grafana"},
		Rest:   authnlib.AccessTokenClaims{Namespace: namespace, Permissions: grants},
	})
}

type legacySearchTestTransport struct {
	raw    authzv1.LegacyAuthzServiceClient
	client *legacyclient.LegacyClient
}

func newLegacySearchTransport(t *testing.T, service authzv1.LegacyAuthzServiceServer, auth authlib.AuthInfo) legacySearchTestTransport {
	t.Helper()
	listener := bufconn.Listen(1024 * 1024)
	server := grpc.NewServer(grpc.StreamInterceptor(func(srv any, stream grpc.ServerStream, _ *grpc.StreamServerInfo, handler grpc.StreamHandler) error {
		if auth == nil {
			return handler(srv, stream)
		}
		return handler(srv, &legacySearchAuthStream{ServerStream: stream, ctx: authlib.WithAuthInfo(stream.Context(), auth)})
	}))
	authzv1.RegisterLegacyAuthzServiceServer(server, service)
	go func() { _ = server.Serve(listener) }()
	t.Cleanup(func() { server.Stop(); _ = listener.Close() })
	conn, err := grpc.NewClient("passthrough:///permission-search", grpc.WithTransportCredentials(insecure.NewCredentials()), grpc.WithContextDialer(func(ctx context.Context, _ string) (net.Conn, error) { return listener.DialContext(ctx) }))
	require.NoError(t, err)
	t.Cleanup(func() { require.NoError(t, conn.Close()) })
	return legacySearchTestTransport{raw: authzv1.NewLegacyAuthzServiceClient(conn), client: legacyclient.NewLegacyClient(conn)}
}

type legacySearchAuthStream struct {
	grpc.ServerStream
	ctx context.Context
}

func (s *legacySearchAuthStream) Context() context.Context { return s.ctx }

func newLegacySearchTestService(store *legacySearchTestStore, cache *localcache.CacheService) *LegacySearchService {
	return NewLegacySearchService(store, func(context.Context) map[string]*accesscontrol.RoleDTO {
		return accesscontrol.BuildBasicRoleDefinitions()
	}, nil, cache)
}

func legacySearchTestRequest() legacyclient.LegacySearchUsersPermissionsRequest {
	return legacyclient.LegacySearchUsersPermissionsRequest{
		Namespace: "default", Caller: legacyclient.LegacyPermissionIdentity{Type: authlib.TypeUser, UID: "caller-one"}, UserID: 2, Action: "test:read",
	}
}

func legacySearchTestPermissions(permissions []accesscontrol.Permission) []authlib.Permission {
	result := make([]authlib.Permission, 0, len(permissions))
	for _, p := range permissions {
		result = append(result, authlib.Permission{Action: p.Action, Scope: p.Scope})
	}
	return result
}

func TestLegacySearchTransportAuthorizationAndValidation(t *testing.T) {
	caller := &authzv1.LegacyPermissionIdentity{Type: "user", Uid: "caller-one"}
	tests := []struct {
		name    string
		auth    authlib.AuthInfo
		request *authzv1.LegacySearchUsersPermissionsRequest
		code    codes.Code
	}{
		{"unauthenticated", nil, &authzv1.LegacySearchUsersPermissionsRequest{Namespace: "default", Caller: caller, Action: "test:read"}, codes.Unauthenticated},
		{"wrong namespace", legacySearchTestAuth("org-2", LegacySearchDelegatedGrant), &authzv1.LegacySearchUsersPermissionsRequest{Namespace: "default", Caller: caller, Action: "test:read"}, codes.PermissionDenied},
		{"missing service grant", legacySearchTestAuth("default"), &authzv1.LegacySearchUsersPermissionsRequest{Namespace: "default", Caller: caller, Action: "test:read"}, codes.PermissionDenied},
		{"enumeration grant is insufficient", legacySearchTestAuth("default", "authz.grafana.app/legacyuserpermissions:get"), &authzv1.LegacySearchUsersPermissionsRequest{Namespace: "default", Caller: caller, Action: "test:read"}, codes.PermissionDenied},
		{"invalid namespace", legacySearchTestAuth("*", LegacySearchDelegatedGrant), &authzv1.LegacySearchUsersPermissionsRequest{Namespace: "org-1", Caller: caller, Action: "test:read"}, codes.InvalidArgument},
		{"unknown namespace", legacySearchTestAuth("*", LegacySearchDelegatedGrant), &authzv1.LegacySearchUsersPermissionsRequest{Namespace: "unknown", Caller: caller, Action: "test:read"}, codes.InvalidArgument},
		{"wildcard namespace", legacySearchTestAuth("*", LegacySearchDelegatedGrant), &authzv1.LegacySearchUsersPermissionsRequest{Namespace: "*", Caller: caller, Action: "test:read"}, codes.InvalidArgument},
		{"empty caller UID", legacySearchTestAuth("*", LegacySearchDelegatedGrant), &authzv1.LegacySearchUsersPermissionsRequest{Namespace: "default", Caller: &authzv1.LegacyPermissionIdentity{Type: "user"}, Action: "test:read"}, codes.InvalidArgument},
		{"missing namespace", legacySearchTestAuth("*", LegacySearchDelegatedGrant), &authzv1.LegacySearchUsersPermissionsRequest{Caller: caller, Action: "test:read"}, codes.InvalidArgument},
		{"missing caller", legacySearchTestAuth("*", LegacySearchDelegatedGrant), &authzv1.LegacySearchUsersPermissionsRequest{Namespace: "default", Action: "test:read"}, codes.InvalidArgument},
		{"unsupported caller", legacySearchTestAuth("*", LegacySearchDelegatedGrant), &authzv1.LegacySearchUsersPermissionsRequest{Namespace: "default", Caller: &authzv1.LegacyPermissionIdentity{Type: "team", Uid: "caller-one"}, Action: "test:read"}, codes.InvalidArgument},
		{"conflicting filters", legacySearchTestAuth("*", LegacySearchDelegatedGrant), &authzv1.LegacySearchUsersPermissionsRequest{Namespace: "default", Caller: caller, Action: "test:read", ActionPrefix: "test:"}, codes.InvalidArgument},
		{"no filters", legacySearchTestAuth("*", LegacySearchDelegatedGrant), &authzv1.LegacySearchUsersPermissionsRequest{Namespace: "default", Caller: caller}, codes.InvalidArgument},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			store := &legacySearchTestStore{visibility: "users:*"}
			transport := newLegacySearchTransport(t, newLegacySearchTestService(store, nil), tt.auth)
			ctx, cancel := context.WithTimeout(t.Context(), 5*time.Second)
			defer cancel()
			stream, err := transport.raw.LegacySearchUsersPermissions(ctx, tt.request)
			if err == nil {
				_, err = stream.Recv()
			}
			require.Equal(t, tt.code, status.Code(err))
			require.Zero(t, store.queryCalls.Load(), "invalid requests must not query permissions")
		})
	}
}

func TestLegacySearchTransportChunkBoundaries(t *testing.T) {
	for _, count := range []int{0, 1, 999, 1000, 1001, 2000, 2001} {
		t.Run(fmt.Sprint(count), func(t *testing.T) {
			store := &legacySearchTestStore{visibility: "users:*"}
			for i := range count {
				store.permissions = append(store.permissions, accesscontrol.Permission{Action: "test:read", Scope: fmt.Sprintf("tests:id:%d", i)})
			}
			auth := legacySearchTestAuth("*", LegacySearchDelegatedGrant)
			transport := newLegacySearchTransport(t, newLegacySearchTestService(store, nil), auth)
			ctx, cancel := context.WithTimeout(t.Context(), 5*time.Second)
			defer cancel()
			stream, err := transport.raw.LegacySearchUsersPermissions(ctx, &authzv1.LegacySearchUsersPermissionsRequest{Namespace: "default", Caller: &authzv1.LegacyPermissionIdentity{Type: "user", Uid: "caller-one"}, Action: "test:read", UserId: 2})
			require.NoError(t, err)
			remaining, chunks := count, 0
			for {
				chunk, err := stream.Recv()
				if errors.Is(err, io.EOF) {
					break
				}
				require.NoError(t, err)
				require.Equal(t, int64(2), chunk.UserId)
				require.Len(t, chunk.Permissions, min(remaining, 1000))
				remaining -= len(chunk.Permissions)
				chunks++
			}
			require.Zero(t, remaining)
			require.Equal(t, max(1, (count+999)/1000), chunks)
			result, err := transport.client.LegacySearchUsersPermissions(ctx, auth, legacySearchTestRequest())
			require.NoError(t, err)
			require.Equal(t, legacySearchTestPermissions(store.permissions), result.Permissions[2])
		})
	}
}

func TestLegacySearchTransportMultipleUsers(t *testing.T) {
	store := &legacySearchTestStore{visibility: "users:*", results: map[int64][]accesscontrol.Permission{
		8: {{Action: "test:read", Scope: "tests:id:eight"}},
		2: {{Action: "test:read", Scope: "tests:id:two"}, {Action: "test:read", Scope: "tests:id:two"}},
		5: {},
	}}
	auth := legacySearchTestAuth("*", LegacySearchDelegatedGrant)
	transport := newLegacySearchTransport(t, newLegacySearchTestService(store, nil), auth)
	stream, err := transport.raw.LegacySearchUsersPermissions(t.Context(), &authzv1.LegacySearchUsersPermissionsRequest{Namespace: "default", Caller: &authzv1.LegacyPermissionIdentity{Type: "user", Uid: "caller-one"}, Action: "test:read"})
	require.NoError(t, err)
	for _, id := range []int64{2, 8} {
		chunk, err := stream.Recv()
		require.NoError(t, err)
		require.Equal(t, id, chunk.UserId)
		require.Len(t, chunk.Permissions, len(store.results[id]))
	}
	_, err = stream.Recv()
	require.ErrorIs(t, err, io.EOF)
	req := legacySearchTestRequest()
	req.UserID = 0
	result, err := transport.client.LegacySearchUsersPermissions(t.Context(), auth, req)
	require.NoError(t, err)
	require.Equal(t, map[int64][]authlib.Permission{2: legacySearchTestPermissions(store.results[2]), 8: legacySearchTestPermissions(store.results[8])}, result.Permissions)
}

func TestLegacySearchTransportEmptyResults(t *testing.T) {
	for _, target := range []int64{0, 2} {
		t.Run(fmt.Sprint(target), func(t *testing.T) {
			store := &legacySearchTestStore{visibility: "users:*"}
			auth := legacySearchTestAuth("*", LegacySearchDelegatedGrant)
			transport := newLegacySearchTransport(t, newLegacySearchTestService(store, nil), auth)
			req := legacySearchTestRequest()
			req.UserID = target
			result, err := transport.client.LegacySearchUsersPermissions(t.Context(), auth, req)
			require.NoError(t, err)
			require.NotNil(t, result.Permissions)
			if target == 0 {
				require.Empty(t, result.Permissions)
			} else {
				require.Equal(t, map[int64][]authlib.Permission{2: {}}, result.Permissions)
			}
		})
	}
}

func TestLegacySearchTransportCallerIdentity(t *testing.T) {
	internalID := int64(41)
	zero := int64(0)
	for _, tc := range []struct {
		name       string
		kind       authlib.IdentityType
		uid        string
		internalID *int64
	}{
		{"user with distinct UID and internal ID", authlib.TypeUser, "uid-one", &internalID},
		{"numeric UID without internal ID", authlib.TypeUser, "41", nil},
		{"explicit zero internal ID", authlib.TypeUser, "uid-one", &zero},
		{"service account", authlib.TypeServiceAccount, "account-one", &internalID},
	} {
		t.Run(tc.name, func(t *testing.T) {
			store := &legacySearchTestStore{visibility: "users:*"}
			auth := legacySearchTestAuth("*", LegacySearchDelegatedGrant)
			transport := newLegacySearchTransport(t, newLegacySearchTestService(store, nil), auth)
			req := legacySearchTestRequest()
			req.Caller = legacyclient.LegacyPermissionIdentity{Type: tc.kind, UID: tc.uid, InternalID: tc.internalID}
			_, err := transport.client.LegacySearchUsersPermissions(t.Context(), auth, req)
			require.NoError(t, err)
			store.mu.Lock()
			defer store.mu.Unlock()
			require.Equal(t, legacySearchTestCaller{kind: tc.kind, uid: tc.uid, internalID: tc.internalID}, store.lastCaller)
		})
	}
}

func TestLegacySearchTransportCallerResolutionFailure(t *testing.T) {
	store := &legacySearchTestStore{visibility: "users:*", failCaller: true}
	auth := legacySearchTestAuth("*", LegacySearchDelegatedGrant)
	transport := newLegacySearchTransport(t, newLegacySearchTestService(store, nil), auth)
	result, err := transport.client.LegacySearchUsersPermissions(t.Context(), auth, legacySearchTestRequest())
	require.Equal(t, codes.PermissionDenied, status.Code(err))
	require.Nil(t, result.Permissions)
	require.Equal(t, int64(1), store.queryCalls.Load())
	require.Zero(t, store.calls.Load())
}

func TestLegacySearchTransportCacheErrorRecovery(t *testing.T) {
	for _, failure := range []string{"basic roles", "permissions"} {
		t.Run(failure, func(t *testing.T) {
			store := &legacySearchTestStore{visibility: "users:*", permissions: []accesscontrol.Permission{{Action: "test:read", Scope: "tests:id:one"}}}
			if failure == "basic roles" {
				store.failRoleOnce.Store(true)
			} else {
				store.failSearchOnce.Store(true)
			}
			cache := localcache.ProvideService()
			auth := legacySearchTestAuth("*", LegacySearchDelegatedGrant)
			transport := newLegacySearchTransport(t, newLegacySearchTestService(store, cache), auth)
			result, err := transport.client.LegacySearchUsersPermissions(t.Context(), auth, legacySearchTestRequest())
			require.Equal(t, codes.Internal, status.Code(err))
			require.Nil(t, result.Permissions)
			require.Empty(t, cache.Items())
			t.Run("retry after failure", func(t *testing.T) {
				result, err := transport.client.LegacySearchUsersPermissions(t.Context(), auth, legacySearchTestRequest())
				require.NoError(t, err)
				require.Equal(t, legacySearchTestPermissions(store.permissions), result.Permissions[2])
			})
			calls, roles := store.calls.Load(), store.rolesCalls.Load()
			t.Run("cached retry", func(t *testing.T) {
				result, err := transport.client.LegacySearchUsersPermissions(t.Context(), auth, legacySearchTestRequest())
				require.NoError(t, err)
				require.Equal(t, legacySearchTestPermissions(store.permissions), result.Permissions[2])
				require.Equal(t, calls, store.calls.Load())
				require.Equal(t, roles, store.rolesCalls.Load())
			})
		})
	}
}

type partialLegacySearchServer struct {
	authzv1.UnimplementedLegacyAuthzServiceServer
}

func (s *partialLegacySearchServer) LegacySearchUsersPermissions(_ *authzv1.LegacySearchUsersPermissionsRequest, stream authzv1.LegacyAuthzService_LegacySearchUsersPermissionsServer) error {
	if err := stream.Send(&authzv1.LegacySearchUsersPermissionsResponse{UserId: 2, Permissions: []*authzv1.LegacyPermission{{Action: "test:read", Scope: "tests:id:one"}}}); err != nil {
		return err
	}
	return status.Error(codes.Internal, "search interrupted")
}

func TestLegacySearchTransportDiscardsPartialResults(t *testing.T) {
	auth := legacySearchTestAuth("*", LegacySearchDelegatedGrant)
	transport := newLegacySearchTransport(t, &partialLegacySearchServer{}, auth)
	result, err := transport.client.LegacySearchUsersPermissions(t.Context(), auth, legacySearchTestRequest())
	require.Equal(t, codes.Internal, status.Code(err))
	require.Nil(t, result.Permissions)
}

func TestLegacySearchTransportCancellation(t *testing.T) {
	for _, deadline := range []bool{false, true} {
		t.Run(fmt.Sprint(deadline), func(t *testing.T) {
			auth := legacySearchTestAuth("*", LegacySearchDelegatedGrant)
			transport := newLegacySearchTransport(t, &partialLegacySearchServer{}, auth)
			var ctx context.Context
			var cancel context.CancelFunc
			code := codes.Canceled
			if deadline {
				ctx, cancel = context.WithDeadline(t.Context(), time.Now().Add(-time.Second))
				code = codes.DeadlineExceeded
			} else {
				ctx, cancel = context.WithCancel(t.Context())
				cancel()
			}
			defer cancel()
			result, err := transport.client.LegacySearchUsersPermissions(ctx, auth, legacySearchTestRequest())
			require.Nil(t, result.Permissions)
			require.Equal(t, code, status.Code(err))
		})
	}
}

func TestLegacySearchTransportRechecksVisibilityAfterCacheHit(t *testing.T) {
	store := &legacySearchTestStore{visibility: "users:*", permissions: []accesscontrol.Permission{{Action: "test:read", Scope: "tests:id:one"}}}
	cache := localcache.ProvideService()
	auth := legacySearchTestAuth("*", LegacySearchDelegatedGrant)
	transport := newLegacySearchTransport(t, newLegacySearchTestService(store, cache), auth)
	result, err := transport.client.LegacySearchUsersPermissions(t.Context(), auth, legacySearchTestRequest())
	require.NoError(t, err)
	require.Equal(t, legacySearchTestPermissions(store.permissions), result.Permissions[2])
	require.Len(t, cache.Items(), 1)
	store.denyCaller.Store(true)
	result, err = transport.client.LegacySearchUsersPermissions(t.Context(), auth, legacySearchTestRequest())
	require.Equal(t, codes.PermissionDenied, status.Code(err))
	require.Nil(t, result.Permissions)
	require.Equal(t, int64(1), store.calls.Load(), "revoked visibility must be checked before looking up cached target permissions")
}

func TestLegacySearchTransportCacheIsolatesNamespaces(t *testing.T) {
	store := &legacySearchTestStore{visibility: "users:*", namespaceResults: map[string][]accesscontrol.Permission{
		"stacks-1": {{Action: "test:read", Scope: "tests:id:one"}},
		"stacks-2": {{Action: "test:read", Scope: "tests:id:two"}},
	}}
	cache := localcache.ProvideService()
	auth := legacySearchTestAuth("*", LegacySearchDelegatedGrant)
	transport := newLegacySearchTransport(t, newLegacySearchTestService(store, cache), auth)
	for _, namespace := range []string{"stacks-1", "stacks-2", "stacks-1"} {
		req := legacySearchTestRequest()
		req.Namespace = namespace
		result, err := transport.client.LegacySearchUsersPermissions(t.Context(), auth, req)
		require.NoError(t, err)
		require.Equal(t, legacySearchTestPermissions(store.namespaceResults[namespace]), result.Permissions[2])
	}
	require.Len(t, cache.Items(), 2)
	require.Equal(t, int64(2), store.calls.Load(), "tenants with the same org ID must not share cached target results")
}

func TestLegacySearchTransportCacheIsolatesFilters(t *testing.T) {
	store := &legacySearchTestStore{visibility: "users:*", permissions: []accesscontrol.Permission{{Action: "test:read", Scope: "tests:id:one"}}}
	cache := localcache.ProvideService()
	auth := legacySearchTestAuth("*", LegacySearchDelegatedGrant)
	transport := newLegacySearchTransport(t, newLegacySearchTestService(store, cache), auth)
	requests := []legacyclient.LegacySearchUsersPermissionsRequest{legacySearchTestRequest(), legacySearchTestRequest(), legacySearchTestRequest(), legacySearchTestRequest()}
	requests[1].Action = "test:write"
	requests[2].Action, requests[2].ActionPrefix = "", "test:"
	requests[3].Scope = "tests:id:one"
	for _, req := range requests {
		_, err := transport.client.LegacySearchUsersPermissions(t.Context(), auth, req)
		require.NoError(t, err)
		store.mu.Lock()
		require.Equal(t, req.Action, store.lastSearchOptions.Action)
		require.Equal(t, req.ActionPrefix, store.lastSearchOptions.ActionPrefix)
		require.Equal(t, req.Scope, store.lastSearchOptions.Scope)
		store.mu.Unlock()
	}
	require.Equal(t, int64(len(requests)), store.calls.Load())
	_, err := transport.client.LegacySearchUsersPermissions(t.Context(), auth, requests[0])
	require.NoError(t, err)
	require.Equal(t, int64(len(requests)), store.calls.Load(), "identical filters should reuse the target cache")
}

func TestLegacySearchTransportCancelsInFlightQuery(t *testing.T) {
	for _, deadline := range []bool{false, true} {
		t.Run(fmt.Sprint(deadline), func(t *testing.T) {
			store := &legacySearchTestStore{visibility: "users:*", blockSearch: make(chan struct{}), searchStarted: make(chan struct{}), searchCanceled: make(chan struct{})}
			auth := legacySearchTestAuth("*", LegacySearchDelegatedGrant)
			transport := newLegacySearchTransport(t, newLegacySearchTestService(store, nil), auth)
			var ctx context.Context
			var cancel context.CancelFunc
			code := codes.Canceled
			if deadline {
				ctx, cancel = context.WithTimeout(t.Context(), time.Second)
				code = codes.DeadlineExceeded
			} else {
				ctx, cancel = context.WithCancel(t.Context())
			}
			defer cancel()
			done := make(chan error, 1)
			go func() {
				result, err := transport.client.LegacySearchUsersPermissions(ctx, auth, legacySearchTestRequest())
				if result.Permissions != nil {
					done <- fmt.Errorf("received results from canceled query")
					return
				}
				done <- err
			}()
			select {
			case <-store.searchStarted:
			case <-time.After(5 * time.Second):
				t.Fatal("server query did not start")
			}
			if !deadline {
				cancel()
			}
			select {
			case err := <-done:
				require.Equal(t, code, status.Code(err))
			case <-time.After(5 * time.Second):
				t.Fatal("client did not cancel")
			}
			select {
			case <-store.searchCanceled:
			case <-time.After(5 * time.Second):
				t.Fatal("server query did not cancel")
			}
		})
	}
}

func TestEmbeddedLegacySearchRejectsUntrustedTransport(t *testing.T) {
	for _, guard := range []*int{nil, new(int)} {
		t.Run(fmt.Sprint(guard != nil), func(t *testing.T) {
			store := &legacySearchTestStore{visibility: "users:*"}
			auth := legacySearchTestAuth("*", LegacySearchDelegatedGrant)
			transport := newLegacySearchTransport(t, &embeddedServer{loader: &Loader{search: newLegacySearchTestService(store, nil)}, cfg: setting.NewCfg(), guard: guard}, auth)
			result, err := transport.client.LegacySearchUsersPermissions(t.Context(), auth, legacySearchTestRequest())
			require.Equal(t, codes.PermissionDenied, status.Code(err))
			require.Nil(t, result.Permissions)
			require.Zero(t, store.queryCalls.Load())
		})
	}
}

func TestEmbeddedLegacySearchNamespaceValidation(t *testing.T) {
	for _, tc := range []struct{ name, stack, namespace string }{
		{"wrong stack", "12", "stacks-13"},
		{"org alias on cloud", "12", "default"},
		{"stack on self managed", "", "stacks-12"},
	} {
		t.Run(tc.name, func(t *testing.T) {
			cfg := setting.NewCfg()
			cfg.StackID = tc.stack
			store := &legacySearchTestStore{visibility: "users:*"}
			client := NewEmbeddedClient(&Loader{search: newLegacySearchTestService(store, nil)}, cfg)
			req := legacySearchTestRequest()
			req.Namespace = tc.namespace
			result, err := client.LegacySearchUsersPermissions(t.Context(), legacySearchTestAuth("*", LegacySearchDelegatedGrant), req)
			require.Equal(t, codes.PermissionDenied, status.Code(err))
			require.Nil(t, result.Permissions)
			require.Zero(t, store.queryCalls.Load())
		})
	}
}

func TestEmbeddedLegacySearchValidInstance(t *testing.T) {
	for _, tc := range []struct{ name, stack, namespace string }{
		{"self managed", "", "default"},
		{"cloud", "12", "stacks-12"},
	} {
		t.Run(tc.name, func(t *testing.T) {
			cfg := setting.NewCfg()
			cfg.StackID = tc.stack
			store := &legacySearchTestStore{visibility: "users:*", permissions: []accesscontrol.Permission{{Action: "test:read", Scope: "tests:id:one"}}}
			client := NewEmbeddedClient(&Loader{search: newLegacySearchTestService(store, nil)}, cfg)
			req := legacySearchTestRequest()
			req.Namespace = tc.namespace
			result, err := client.LegacySearchUsersPermissions(t.Context(), legacySearchTestAuth("*", LegacySearchDelegatedGrant), req)
			require.NoError(t, err)
			require.Equal(t, legacySearchTestPermissions(store.permissions), result.Permissions[2])
			require.Equal(t, int64(1), store.calls.Load())
		})
	}
}

func TestLegacySearchTransportCacheIsolatesTargetUsers(t *testing.T) {
	store := &legacySearchTestStore{visibility: "users:*", results: map[int64][]accesscontrol.Permission{
		2: {{Action: "test:read", Scope: "tests:id:two"}},
		3: {{Action: "test:read", Scope: "tests:id:three"}},
	}}
	cache := localcache.ProvideService()
	auth := legacySearchTestAuth("*", LegacySearchDelegatedGrant)
	transport := newLegacySearchTransport(t, newLegacySearchTestService(store, cache), auth)
	for _, target := range []int64{2, 3, 2} {
		req := legacySearchTestRequest()
		req.UserID = target
		result, err := transport.client.LegacySearchUsersPermissions(t.Context(), auth, req)
		require.NoError(t, err)
		require.Equal(t, map[int64][]authlib.Permission{target: legacySearchTestPermissions(store.results[target])}, result.Permissions)
	}
	require.Len(t, cache.Items(), 2)
	require.Equal(t, int64(2), store.calls.Load())
}

func TestLegacySearchTransportCacheTracksEnforcement(t *testing.T) {
	store := &legacySearchTestStore{visibility: "users:*", permissions: []accesscontrol.Permission{{Action: "test:read", Scope: "tests:id:one"}}}
	cache := localcache.ProvideService()
	service := newLegacySearchTestService(store, cache)
	var enabled atomic.Bool
	service.enforcementEnabled = enabled.Load
	auth := legacySearchTestAuth("*", LegacySearchDelegatedGrant)
	transport := newLegacySearchTransport(t, service, auth)
	for _, enforcement := range []bool{false, true, false} {
		enabled.Store(enforcement)
		result, err := transport.client.LegacySearchUsersPermissions(t.Context(), auth, legacySearchTestRequest())
		require.NoError(t, err)
		require.Equal(t, legacySearchTestPermissions(store.permissions), result.Permissions[2])
	}
	require.Len(t, cache.Items(), 2)
	require.Equal(t, int64(2), store.calls.Load(), "an enforcement change must not reuse permissions loaded under another license state")
}

func TestLegacySearchTransportUncachedQueries(t *testing.T) {
	for _, tc := range []struct {
		name   string
		target int64
		cache  *localcache.CacheService
	}{
		{"target with cache disabled", 2, nil},
		{"bulk search", 0, localcache.ProvideService()},
	} {
		t.Run(tc.name, func(t *testing.T) {
			store := &legacySearchTestStore{visibility: "users:*", permissions: []accesscontrol.Permission{{Action: "test:read", Scope: "tests:id:one"}}}
			auth := legacySearchTestAuth("*", LegacySearchDelegatedGrant)
			transport := newLegacySearchTransport(t, newLegacySearchTestService(store, tc.cache), auth)
			req := legacySearchTestRequest()
			req.UserID = tc.target
			for _, phase := range []string{"first query", "repeated query"} {
				t.Run(phase, func(t *testing.T) {
					result, err := transport.client.LegacySearchUsersPermissions(t.Context(), auth, req)
					require.NoError(t, err)
					require.Equal(t, legacySearchTestPermissions(store.permissions), result.Permissions[2])
				})
			}
			require.Equal(t, int64(2), store.calls.Load())
			if tc.cache != nil {
				require.Empty(t, tc.cache.Items())
			}
		})
	}
}
