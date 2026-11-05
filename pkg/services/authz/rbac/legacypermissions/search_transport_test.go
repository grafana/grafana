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
	"github.com/grafana/authlib/authz"
	authlib "github.com/grafana/authlib/types"
	"github.com/stretchr/testify/require"
	"google.golang.org/grpc"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/credentials/insecure"
	"google.golang.org/grpc/status"
	"google.golang.org/grpc/test/bufconn"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/authz/legacyclient"
	authzv1 "github.com/grafana/grafana/pkg/services/authz/proto/v1"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/setting"
)

func TestSearchDirectoryContextScopesServiceIdentity(t *testing.T) {
	ctx := withSearchDirectoryContext(t.Context(), &legacyRequester{SignedInUser: &user.SignedInUser{OrgID: 2}}, "org-2")
	service, err := identity.GetRequester(ctx)
	require.NoError(t, err)
	require.True(t, identity.IsServiceIdentity(ctx))
	require.Equal(t, "org-2", service.GetNamespace())
	require.Equal(t, int64(2), service.GetOrgID())
	require.True(t, authz.CheckServicePermissions(service, "iam.grafana.app", "searchUsers", "list").Allowed)
}

type legacySearchTestCaller struct {
	kind       authlib.IdentityType
	uid        string
	internalID *int64
}

type legacySearchTestStore struct {
	permissions       []accesscontrol.Permission
	results           map[int64][]accesscontrol.Permission
	visibility        string
	calls             atomic.Int64
	queryCalls        atomic.Int64
	failCaller        bool
	callerErr         error
	visibilityErr     error
	searchErr         error
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
	if s.callerErr != nil {
		return 0, s.callerErr
	}
	if s.failCaller {
		return 0, fmt.Errorf("caller lookup failed")
	}
	return 1, nil
}

func (s *legacySearchTestStore) GetUsersBasicRoles(_ context.Context, _ authlib.NamespaceInfo, ids []int64) (map[int64][]string, error) {
	s.queryCalls.Add(1)
	if len(ids) > 0 {
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

func (s *legacySearchTestStore) SearchUsersPermissions(ctx context.Context, _ authlib.NamespaceInfo, options accesscontrol.SearchOptions) (map[int64][]accesscontrol.Permission, error) {
	s.queryCalls.Add(1)
	if options.Action == accesscontrol.ActionUsersPermissionsRead {
		if s.visibilityErr != nil {
			return nil, s.visibilityErr
		}
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
	if s.searchErr != nil {
		return nil, s.searchErr
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

func newLegacySearchTestService(store *legacySearchTestStore) *LegacySearchService {
	return NewLegacySearchService(store, func(context.Context) map[string]*accesscontrol.RoleDTO {
		return accesscontrol.BuildBasicRoleDefinitions()
	}, nil)
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
			transport := newLegacySearchTransport(t, newLegacySearchTestService(store), tt.auth)
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
	for _, count := range []int{0, 1, 1000, 1001, 2001} {
		t.Run(fmt.Sprint(count), func(t *testing.T) {
			store := &legacySearchTestStore{visibility: "users:*"}
			for i := range count {
				store.permissions = append(store.permissions, accesscontrol.Permission{Action: "test:read", Scope: fmt.Sprintf("tests:id:%d", i)})
			}
			auth := legacySearchTestAuth("*", LegacySearchDelegatedGrant)
			transport := newLegacySearchTransport(t, newLegacySearchTestService(store), auth)
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
	transport := newLegacySearchTransport(t, newLegacySearchTestService(store), auth)
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
			transport := newLegacySearchTransport(t, newLegacySearchTestService(store), auth)
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
			transport := newLegacySearchTransport(t, newLegacySearchTestService(store), auth)
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
	transport := newLegacySearchTransport(t, newLegacySearchTestService(store), auth)
	result, err := transport.client.LegacySearchUsersPermissions(t.Context(), auth, legacySearchTestRequest())
	require.Equal(t, codes.PermissionDenied, status.Code(err))
	require.Nil(t, result.Permissions)
	require.Equal(t, int64(1), store.queryCalls.Load())
	require.Zero(t, store.calls.Load())
}

type partialLegacySearchServer struct {
	authzv1.UnimplementedLegacyAuthzServiceServer
}

func (s *partialLegacySearchServer) LegacySearchUsersPermissions(_ *authzv1.LegacySearchUsersPermissionsRequest, stream authzv1.LegacyAuthzService_LegacySearchUsersPermissionsServer) error {
	if err := stream.Send(&authzv1.LegacySearchUsersPermissionsResponse{UserId: 2, Permissions: []*authzv1.LegacyUserPermission{{Action: "test:read", Scope: "tests:id:one"}}}); err != nil {
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

func TestLegacySearchTransportRechecksVisibilityAfterSearch(t *testing.T) {
	store := &legacySearchTestStore{visibility: "users:*", permissions: []accesscontrol.Permission{{Action: "test:read", Scope: "tests:id:one"}}}
	auth := legacySearchTestAuth("*", LegacySearchDelegatedGrant)
	transport := newLegacySearchTransport(t, newLegacySearchTestService(store), auth)
	result, err := transport.client.LegacySearchUsersPermissions(t.Context(), auth, legacySearchTestRequest())
	require.NoError(t, err)
	require.Equal(t, legacySearchTestPermissions(store.permissions), result.Permissions[2])
	store.denyCaller.Store(true)
	result, err = transport.client.LegacySearchUsersPermissions(t.Context(), auth, legacySearchTestRequest())
	require.Equal(t, codes.PermissionDenied, status.Code(err))
	require.Nil(t, result.Permissions)
	require.Equal(t, int64(1), store.calls.Load(), "revoked visibility must be checked before querying target permissions")
}

func TestLegacySearchTransportForwardsFilters(t *testing.T) {
	store := &legacySearchTestStore{visibility: "users:*", permissions: []accesscontrol.Permission{{Action: "test:read", Scope: "tests:id:one"}}}
	auth := legacySearchTestAuth("*", LegacySearchDelegatedGrant)
	transport := newLegacySearchTransport(t, newLegacySearchTestService(store), auth)
	requests := []legacyclient.LegacySearchUsersPermissionsRequest{legacySearchTestRequest(), legacySearchTestRequest(), legacySearchTestRequest(), legacySearchTestRequest()}
	requests[1].Action = "test:write"
	requests[2].Action, requests[2].ActionPrefix = "", "test:"
	requests[3].Scope, requests[3].UserID = "tests:id:one", 3
	for _, req := range requests {
		_, err := transport.client.LegacySearchUsersPermissions(t.Context(), auth, req)
		require.NoError(t, err)
		store.mu.Lock()
		require.Equal(t, req.Action, store.lastSearchOptions.Action)
		require.Equal(t, req.ActionPrefix, store.lastSearchOptions.ActionPrefix)
		require.Equal(t, req.Scope, store.lastSearchOptions.Scope)
		require.Equal(t, req.UserID, store.lastSearchOptions.UserID)
		store.mu.Unlock()
	}
	require.Equal(t, int64(len(requests)), store.calls.Load())
}

func TestLegacySearchTransportPreservesContextErrors(t *testing.T) {
	for _, tc := range []struct {
		stage string
		cause error
	}{
		{"caller lookup", context.Canceled},
		{"visibility", context.DeadlineExceeded},
		{"target search", context.Canceled},
	} {
		t.Run(tc.stage, func(t *testing.T) {
			store := &legacySearchTestStore{visibility: "users:*"}
			failure := fmt.Errorf("query interrupted: %w", tc.cause)
			switch tc.stage {
			case "caller lookup":
				store.callerErr = failure
			case "visibility":
				store.visibilityErr = failure
			case "target search":
				store.searchErr = failure
			}
			auth := legacySearchTestAuth("*", LegacySearchDelegatedGrant)
			transport := newLegacySearchTransport(t, newLegacySearchTestService(store), auth)
			result, err := transport.client.LegacySearchUsersPermissions(t.Context(), auth, legacySearchTestRequest())
			require.Equal(t, status.FromContextError(tc.cause).Code(), status.Code(err))
			require.Nil(t, result.Permissions)
		})
	}
}

func TestLegacySearchTransportCancelsInFlightQuery(t *testing.T) {
	for _, deadline := range []bool{false, true} {
		t.Run(fmt.Sprint(deadline), func(t *testing.T) {
			store := &legacySearchTestStore{visibility: "users:*", blockSearch: make(chan struct{}), searchStarted: make(chan struct{}), searchCanceled: make(chan struct{})}
			auth := legacySearchTestAuth("*", LegacySearchDelegatedGrant)
			transport := newLegacySearchTransport(t, newLegacySearchTestService(store), auth)
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
			transport := newLegacySearchTransport(t, &embeddedServer{loader: &Loader{search: newLegacySearchTestService(store)}, cfg: setting.NewCfg(), guard: guard}, auth)
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
			client := NewEmbeddedClient(&Loader{search: newLegacySearchTestService(store)}, cfg)
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
			client := NewEmbeddedClient(&Loader{search: newLegacySearchTestService(store)}, cfg)
			req := legacySearchTestRequest()
			req.Namespace = tc.namespace
			result, err := client.LegacySearchUsersPermissions(t.Context(), legacySearchTestAuth("*", LegacySearchDelegatedGrant), req)
			require.NoError(t, err)
			require.Equal(t, legacySearchTestPermissions(store.permissions), result.Permissions[2])
			require.Equal(t, int64(1), store.calls.Load())
		})
	}
}
