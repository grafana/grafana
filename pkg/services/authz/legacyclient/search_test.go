package legacyclient

import (
	"context"
	"io"
	"testing"
	"time"

	authzlib "github.com/grafana/authlib/authz"
	"github.com/grafana/authlib/types"
	"github.com/stretchr/testify/require"
	"go.opentelemetry.io/otel/trace/noop"
	"google.golang.org/grpc"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
	"google.golang.org/protobuf/proto"

	authzv1 "github.com/grafana/grafana/pkg/services/authz/proto/v1"
)

const searchTestGrant = "authz.grafana.app/legacyuserpermissions:search"

func searchRequest() LegacySearchUsersPermissionsRequest {
	return LegacySearchUsersPermissionsRequest{Namespace: "stacks-12", Caller: legacyRequest().Identity, UserID: 3}
}

func TestClient_LegacySearchUsersPermissionsCompleteSnapshot(t *testing.T) {
	rpc := &searchTestRPC{responses: []*authzv1.LegacySearchUsersPermissionsResponse{
		{UserId: 3, Permissions: []*authzv1.LegacyPermission{{Action: "users:create"}}},
		{UserId: 9},
		{UserId: 3, Permissions: []*authzv1.LegacyPermission{{Action: "users:create"}, {Action: "dashboards:read", Scope: "*"}}},
	}}
	client := &LegacyClient{clientV1: rpc, tracer: noop.Tracer{}}
	req := searchRequest()
	req.UserID, req.ActionPrefix = 0, "users:"
	want := map[int64][]types.Permission{3: {{Action: "users:create"}, {Action: "users:create"}, {Action: "dashboards:read", Scope: "*"}}, 9: {}}
	for _, phase := range []string{"initial request", "repeat request"} {
		got, err := client.LegacySearchUsersPermissions(t.Context(), legacyCaller(req.Namespace, searchTestGrant), req)
		require.NoError(t, err)
		require.Equal(t, want, got.Permissions, phase)
	}
	require.Equal(t, 2, rpc.calls, "the client must not cache search snapshots")
}

func TestClient_LegacySearchUsersPermissionsForwardsFilters(t *testing.T) {
	for _, tc := range []struct {
		name                  string
		id                    int64
		action, prefix, scope string
	}{
		{"target without filter", 3, "", "", ""},
		{"target action", 3, "dashboards:read", "", "dashboards:uid:one"},
		{"target prefix", 3, "", "dashboards:", "dashboards:*"},
		{"all users action", 0, "users:read", "", "*"},
		{"all users prefix", 0, "", "users:", ""},
		{"negative target with action", -1, "users:read", "", ""},
		{"prefix SQL wildcard characters", 0, "", "dashboards:%_", ""},
	} {
		t.Run(tc.name, func(t *testing.T) {
			rpc := &searchTestRPC{}
			client := &LegacyClient{clientV1: rpc, tracer: noop.Tracer{}}
			req := searchRequest()
			req.UserID, req.Action, req.ActionPrefix, req.Scope = tc.id, tc.action, tc.prefix, tc.scope
			got, err := client.LegacySearchUsersPermissions(t.Context(), legacyCaller(req.Namespace, searchTestGrant), req)
			require.NoError(t, err)
			require.NotNil(t, got.Permissions)
			require.Empty(t, got.Permissions)
			require.Equal(t, tc.id, rpc.request.UserId)
			require.Equal(t, tc.action, rpc.request.Action)
			require.Equal(t, tc.prefix, rpc.request.ActionPrefix)
			require.Equal(t, tc.scope, rpc.request.Scope)
		})
	}
}

func TestClient_LegacySearchUsersPermissionsCallerValidation(t *testing.T) {
	for _, tc := range []struct {
		name   string
		caller types.AuthInfo
		want   error
	}{
		{"nil", nil, authzlib.ErrMissingAuthInfo},
		{"missing subject", emptySearchSubject{legacyCaller("stacks-12", searchTestGrant)}, authzlib.ErrMissingAuthInfo},
		{"no grant", legacyCaller("stacks-12"), ErrLegacySearchUsersPermissionsDenied},
		{"get grant only", legacyCaller("stacks-12", "authz.grafana.app/legacyuserpermissions:get"), ErrLegacySearchUsersPermissionsDenied},
		{"other resource", legacyCaller("stacks-12", "authz.grafana.app/userpermissions:search"), ErrLegacySearchUsersPermissionsDenied},
		{"other tenant", legacyCaller("stacks-13", searchTestGrant), authzlib.ErrNamespaceMismatch},
		{"user with delegated grant", delegatedSearchCaller{legacyCaller("stacks-12", searchTestGrant)}, ErrLegacySearchUsersPermissionsDenied},
	} {
		t.Run(tc.name, func(t *testing.T) {
			rpc := &searchTestRPC{}
			client := &LegacyClient{clientV1: rpc, tracer: noop.Tracer{}}
			got, err := client.LegacySearchUsersPermissions(t.Context(), tc.caller, searchRequest())
			require.ErrorIs(t, err, tc.want)
			require.Nil(t, got.Permissions)
			require.Zero(t, rpc.calls)
		})
	}
}

func TestClient_LegacySearchUsersPermissionsRequestValidation(t *testing.T) {
	for _, tc := range []struct {
		name   string
		change func(*LegacySearchUsersPermissionsRequest)
	}{
		{"empty namespace", func(r *LegacySearchUsersPermissionsRequest) { r.Namespace = "" }},
		{"wildcard namespace", func(r *LegacySearchUsersPermissionsRequest) { r.Namespace = "*" }},
		{"global namespace", func(r *LegacySearchUsersPermissionsRequest) { r.Namespace = "org-0" }},
		{"negative org", func(r *LegacySearchUsersPermissionsRequest) { r.Namespace = "org--1" }},
		{"invalid stack", func(r *LegacySearchUsersPermissionsRequest) { r.Namespace = "stacks-zero" }},
		{"unknown namespace", func(r *LegacySearchUsersPermissionsRequest) { r.Namespace = "other-12" }},
		{"missing identity type", func(r *LegacySearchUsersPermissionsRequest) { r.Caller.Type = "" }},
		{"anonymous caller", func(r *LegacySearchUsersPermissionsRequest) { r.Caller.Type = types.TypeAnonymous }},
		{"renderer caller", func(r *LegacySearchUsersPermissionsRequest) { r.Caller.Type = types.TypeRenderService }},
		{"API key caller", func(r *LegacySearchUsersPermissionsRequest) { r.Caller.Type = types.TypeAPIKey }},
		{"empty UID", func(r *LegacySearchUsersPermissionsRequest) { r.Caller.UID = "" }},
		{"requester namespace conflict", func(r *LegacySearchUsersPermissionsRequest) { ns := "stacks-13"; r.Caller.RequesterNamespace = &ns }},
		{"action and prefix", func(r *LegacySearchUsersPermissionsRequest) { r.Action, r.ActionPrefix = "users:read", "users:" }},
		{"no filter or target", func(r *LegacySearchUsersPermissionsRequest) { r.UserID = 0 }},
		{"scope alone", func(r *LegacySearchUsersPermissionsRequest) { r.UserID, r.Scope = 0, "users:*" }},
		{"negative target alone", func(r *LegacySearchUsersPermissionsRequest) { r.UserID = -1 }},
	} {
		t.Run(tc.name, func(t *testing.T) {
			rpc := &searchTestRPC{}
			client := &LegacyClient{clientV1: rpc, tracer: noop.Tracer{}}
			req := searchRequest()
			tc.change(&req)
			got, err := client.LegacySearchUsersPermissions(t.Context(), legacyCaller("*", searchTestGrant), req)
			require.ErrorIs(t, err, ErrInvalidLegacySearchUsersPermissionsRequest)
			require.Nil(t, got.Permissions)
			require.Zero(t, rpc.calls)
		})
	}
}

func TestClient_LegacySearchUsersPermissionsConcreteNamespaces(t *testing.T) {
	for _, namespace := range []string{"default", "org-2", "stacks-12"} {
		t.Run(namespace, func(t *testing.T) {
			rpc := &searchTestRPC{}
			client := &LegacyClient{clientV1: rpc, tracer: noop.Tracer{}}
			req := searchRequest()
			req.Namespace = namespace
			_, err := client.LegacySearchUsersPermissions(t.Context(), legacyCaller("*", searchTestGrant), req)
			require.NoError(t, err)
			require.Equal(t, namespace, rpc.request.Namespace)
		})
	}
}

func TestClient_LegacySearchUsersPermissionsIdentityWirePresence(t *testing.T) {
	zero, negative := int64(0), int64(-1)
	empty, key, namespace := "", "caller-cache", "stacks-12"
	for _, tc := range []struct {
		name     string
		identity LegacyPermissionIdentity
	}{
		{"numeric UID and distinct ID", legacyRequest().Identity},
		{"service account", LegacyPermissionIdentity{Type: types.TypeServiceAccount, UID: "service", HasUniqueID: true}},
		{"absent ID and context", LegacyPermissionIdentity{Type: types.TypeUser, UID: "8"}},
		{"zero ID and empty context", LegacyPermissionIdentity{Type: types.TypeUser, UID: "8", InternalID: &zero, CacheKey: &empty, RequesterNamespace: &empty}},
		{"negative legacy ID", LegacyPermissionIdentity{Type: types.TypeUser, UID: "8", InternalID: &negative}},
		{"explicit context", LegacyPermissionIdentity{Type: types.TypeUser, UID: "8", CacheKey: &key, RequesterNamespace: &namespace}},
	} {
		t.Run(tc.name, func(t *testing.T) {
			server := &searchTransportServer{handle: func(req *authzv1.LegacySearchUsersPermissionsRequest, _ authzv1.LegacyAuthzService_LegacySearchUsersPermissionsServer) error {
				i := req.Caller
				require.Equal(t, string(tc.identity.Type), i.Type)
				require.Equal(t, tc.identity.UID, i.Uid)
				require.Equal(t, tc.identity.InternalID, i.InternalId)
				require.Equal(t, tc.identity.HasUniqueID, i.HasUniqueId)
				require.Equal(t, tc.identity.OrgRole, i.OrgRole)
				require.Equal(t, tc.identity.IsGrafanaAdmin, i.IsGrafanaAdmin)
				require.Equal(t, tc.identity.TeamIDs, i.TeamIds)
				require.Equal(t, tc.identity.Groups, i.Groups)
				require.Equal(t, tc.identity.CacheKey, i.CacheKey)
				require.Equal(t, tc.identity.RequesterNamespace, i.RequesterNamespace)
				return nil
			}}
			req := searchRequest()
			req.Caller = tc.identity
			_, err := newLegacyTransportClient(t, server).LegacySearchUsersPermissions(t.Context(), legacyGroupedCaller{legacyCaller(req.Namespace, searchTestGrant)}, req)
			require.NoError(t, err)
		})
	}
}

func TestClient_LegacySearchUsersPermissionsCopiesAssertions(t *testing.T) {
	rpc := &searchTestRPC{}
	client := &LegacyClient{clientV1: rpc, tracer: noop.Tracer{}}
	req := searchRequest()
	key, namespace := "original", ""
	req.Caller.CacheKey, req.Caller.RequesterNamespace = &key, &namespace
	_, err := client.LegacySearchUsersPermissions(t.Context(), legacyGroupedCaller{legacyCaller(req.Namespace, searchTestGrant)}, req)
	require.NoError(t, err)
	encoded, err := proto.Marshal(rpc.request)
	require.NoError(t, err)
	key, namespace = "changed", "changed"
	*req.Caller.InternalID = 99
	req.Caller.TeamIDs[0], req.Caller.Groups[0] = 99, "changed"
	encodedAfterMutation, err := proto.Marshal(rpc.request)
	require.NoError(t, err)
	require.Equal(t, encoded, encodedAfterMutation, "transport assertions must not alias caller state")
}

func TestClient_LegacySearchUsersPermissionsStreamValidation(t *testing.T) {
	valid := &authzv1.LegacySearchUsersPermissionsResponse{UserId: 3, Permissions: []*authzv1.LegacyPermission{{Action: "users:create"}}}
	for _, tc := range []struct {
		name             string
		responses        []*authzv1.LegacySearchUsersPermissionsResponse
		openErr, recvErr error
		nilStream        bool
		want             error
	}{
		{name: "empty stream"},
		{name: "empty target record", responses: []*authzv1.LegacySearchUsersPermissionsResponse{{UserId: 3}}},
		{name: "nil stream", nilStream: true, want: ErrInvalidLegacySearchUsersPermissionsResponse},
		{name: "nil first chunk", responses: []*authzv1.LegacySearchUsersPermissionsResponse{nil}, want: ErrInvalidLegacySearchUsersPermissionsResponse},
		{name: "nil chunk after data", responses: []*authzv1.LegacySearchUsersPermissionsResponse{valid, nil}, want: ErrInvalidLegacySearchUsersPermissionsResponse},
		{name: "nil permission after data", responses: []*authzv1.LegacySearchUsersPermissionsResponse{valid, {UserId: 3, Permissions: []*authzv1.LegacyPermission{nil}}}, want: ErrInvalidLegacySearchUsersPermissionsResponse},
		{name: "zero user ID", responses: []*authzv1.LegacySearchUsersPermissionsResponse{valid, {}}, want: ErrInvalidLegacySearchUsersPermissionsResponse},
		{name: "negative user ID", responses: []*authzv1.LegacySearchUsersPermissionsResponse{{UserId: -1}}, want: ErrInvalidLegacySearchUsersPermissionsResponse},
		{name: "unexpected target", responses: []*authzv1.LegacySearchUsersPermissionsResponse{valid, {UserId: 9}}, want: ErrInvalidLegacySearchUsersPermissionsResponse},
		{name: "unsupported server", openErr: status.Error(codes.Unimplemented, "old server")},
		{name: "failure after data", responses: []*authzv1.LegacySearchUsersPermissionsResponse{valid}, recvErr: status.Error(codes.Unavailable, "interrupted")},
		{name: "cancellation", responses: []*authzv1.LegacySearchUsersPermissionsResponse{valid}, recvErr: context.Canceled},
		{name: "deadline", responses: []*authzv1.LegacySearchUsersPermissionsResponse{valid}, recvErr: context.DeadlineExceeded},
	} {
		t.Run(tc.name, func(t *testing.T) {
			rpc := &searchTestRPC{responses: tc.responses, openErr: tc.openErr, recvErr: tc.recvErr, nilStream: tc.nilStream}
			client := &LegacyClient{clientV1: rpc, tracer: noop.Tracer{}}
			got, err := client.LegacySearchUsersPermissions(t.Context(), legacyCaller("stacks-12", searchTestGrant), searchRequest())
			wantErr := tc.want
			if tc.openErr != nil {
				wantErr = tc.openErr
			}
			if tc.recvErr != nil {
				wantErr = tc.recvErr
			}
			if wantErr != nil {
				require.ErrorIs(t, err, wantErr)
				require.Nil(t, got.Permissions, "never publish a partial snapshot")
			} else {
				require.NoError(t, err)
				require.NotNil(t, got.Permissions)
				if len(tc.responses) > 0 {
					require.Equal(t, []types.Permission{}, got.Permissions[3])
				}
			}
			select {
			case <-rpc.ctx.Done():
			default:
				t.Fatal("stream context was not canceled after completion")
			}
		})
	}
}

func TestClient_LegacySearchUsersPermissionsWireSnapshot(t *testing.T) {
	server := &searchTransportServer{handle: func(req *authzv1.LegacySearchUsersPermissionsRequest, stream authzv1.LegacyAuthzService_LegacySearchUsersPermissionsServer) error {
		require.Equal(t, "stacks-12", req.Namespace)
		require.Equal(t, "users:", req.ActionPrefix)
		require.Equal(t, "users:*", req.Scope)
		for _, id := range []int64{3, 9, 3} {
			if err := stream.Send(&authzv1.LegacySearchUsersPermissionsResponse{UserId: id, Permissions: []*authzv1.LegacyPermission{{Action: "users:create"}}}); err != nil {
				return err
			}
		}
		return stream.Send(&authzv1.LegacySearchUsersPermissionsResponse{UserId: 10})
	}}
	req := searchRequest()
	req.UserID, req.ActionPrefix, req.Scope = 0, "users:", "users:*"
	got, err := newLegacyTransportClient(t, server).LegacySearchUsersPermissions(t.Context(), legacyCaller(req.Namespace, searchTestGrant), req)
	require.NoError(t, err)
	require.Equal(t, map[int64][]types.Permission{3: {{Action: "users:create"}, {Action: "users:create"}}, 9: {{Action: "users:create"}}, 10: {}}, got.Permissions)
}

func TestClient_LegacySearchUsersPermissionsWireLargeSnapshot(t *testing.T) {
	const count = 2507
	server := &searchTransportServer{handle: func(_ *authzv1.LegacySearchUsersPermissionsRequest, stream authzv1.LegacyAuthzService_LegacySearchUsersPermissionsServer) error {
		for start := 0; start < count; start += 1000 {
			chunk := &authzv1.LegacySearchUsersPermissionsResponse{UserId: 3}
			for i := start; i < min(start+1000, count); i++ {
				chunk.Permissions = append(chunk.Permissions, &authzv1.LegacyPermission{Action: "users:read", Scope: "users:*"})
			}
			if err := stream.Send(chunk); err != nil {
				return err
			}
		}
		return nil
	}}
	got, err := newLegacyTransportClient(t, server).LegacySearchUsersPermissions(t.Context(), legacyCaller("stacks-12", searchTestGrant), searchRequest())
	require.NoError(t, err)
	require.Len(t, got.Permissions[3], count)
	for _, permission := range got.Permissions[3] {
		require.Equal(t, types.Permission{Action: "users:read", Scope: "users:*"}, permission)
	}
}

func TestClient_LegacySearchUsersPermissionsWireFailuresDiscardChunks(t *testing.T) {
	for _, code := range []codes.Code{codes.Internal, codes.Unavailable, codes.PermissionDenied, codes.InvalidArgument, codes.Canceled, codes.DeadlineExceeded} {
		t.Run(code.String(), func(t *testing.T) {
			server := &searchTransportServer{handle: func(_ *authzv1.LegacySearchUsersPermissionsRequest, stream authzv1.LegacyAuthzService_LegacySearchUsersPermissionsServer) error {
				if err := stream.Send(&authzv1.LegacySearchUsersPermissionsResponse{UserId: 3, Permissions: []*authzv1.LegacyPermission{{Action: "users:create"}}}); err != nil {
					return err
				}
				return status.Error(code, "failed after chunk")
			}}
			got, err := newLegacyTransportClient(t, server).LegacySearchUsersPermissions(t.Context(), legacyCaller("stacks-12", searchTestGrant), searchRequest())
			require.Equal(t, code, status.Code(err))
			require.Nil(t, got.Permissions)
		})
	}
}

func TestClient_LegacySearchUsersPermissionsWireCancellation(t *testing.T) {
	entered := make(chan struct{})
	server := &searchTransportServer{handle: func(_ *authzv1.LegacySearchUsersPermissionsRequest, stream authzv1.LegacyAuthzService_LegacySearchUsersPermissionsServer) error {
		if err := stream.Send(&authzv1.LegacySearchUsersPermissionsResponse{UserId: 3, Permissions: []*authzv1.LegacyPermission{{Action: "users:create"}}}); err != nil {
			return err
		}
		close(entered)
		<-stream.Context().Done()
		return status.FromContextError(stream.Context().Err()).Err()
	}}
	client := newLegacyTransportClient(t, server)
	ctx, cancel := context.WithTimeout(t.Context(), 10*time.Second)
	defer cancel()
	type result struct {
		response LegacySearchUsersPermissionsResponse
		err      error
	}
	done := make(chan result, 1)
	go func() {
		response, err := client.LegacySearchUsersPermissions(ctx, legacyCaller("stacks-12", searchTestGrant), searchRequest())
		done <- result{response, err}
	}()
	select {
	case <-entered:
	case <-ctx.Done():
		t.Fatal("server did not receive request")
	}
	cancel()
	select {
	case got := <-done:
		require.Equal(t, codes.Canceled, status.Code(got.err))
		require.Nil(t, got.response.Permissions)
	case <-time.After(10 * time.Second):
		t.Fatal("client did not observe cancellation")
	}
}

func TestClient_LegacySearchUsersPermissionsWireDeadline(t *testing.T) {
	for _, expired := range []bool{false, true} {
		t.Run(map[bool]string{false: "preserved", true: "expired"}[expired], func(t *testing.T) {
			observed := make(chan time.Time, 1)
			server := &searchTransportServer{handle: func(_ *authzv1.LegacySearchUsersPermissionsRequest, stream authzv1.LegacyAuthzService_LegacySearchUsersPermissionsServer) error {
				deadline, ok := stream.Context().Deadline()
				if !ok {
					return status.Error(codes.InvalidArgument, "deadline was lost")
				}
				observed <- deadline
				return nil
			}}
			client := newLegacyTransportClient(t, server)
			deadline := time.Now().Add(10 * time.Second)
			if expired {
				deadline = time.Now().Add(-time.Second)
			}
			ctx, cancel := context.WithDeadline(t.Context(), deadline)
			defer cancel()
			got, err := client.LegacySearchUsersPermissions(ctx, legacyCaller("stacks-12", searchTestGrant), searchRequest())
			if expired {
				require.Equal(t, codes.DeadlineExceeded, status.Code(err))
				require.Nil(t, got.Permissions)
			} else {
				require.NoError(t, err)
				select {
				case value := <-observed:
					require.WithinDuration(t, deadline, value, time.Second)
				default:
					t.Fatal("deadline was not observed")
				}
			}
		})
	}
}

func TestClient_LegacySearchUsersPermissionsOlderServer(t *testing.T) {
	for _, tc := range []struct {
		name    string
		handler authzv1.LegacyAuthzServiceServer
	}{
		{"service absent", nil},
		{"search method unimplemented", &legacyTransportServer{handle: func(_ *authzv1.LegacyGetUserPermissionsRequest, stream authzv1.LegacyAuthzService_LegacyGetUserPermissionsServer) error {
			return stream.Send(&authzv1.LegacyGetUserPermissionsResponse{Permissions: []*authzv1.LegacyPermission{{Action: "users:read", Scope: "users:*"}}})
		}}},
	} {
		t.Run(tc.name, func(t *testing.T) {
			client := newLegacyTransportClient(t, tc.handler)
			caller := legacyCaller("stacks-12", searchTestGrant, "authz.grafana.app/legacyuserpermissions:get")
			got, err := client.LegacySearchUsersPermissions(t.Context(), caller, searchRequest())
			require.Equal(t, codes.Unimplemented, status.Code(err))
			require.Nil(t, got.Permissions)
			if tc.handler != nil {
				old, err := client.LegacyGetUserPermissions(t.Context(), caller, legacyRequest())
				require.NoError(t, err)
				require.Equal(t, []types.Permission{{Action: "users:read", Scope: "users:*"}}, old.Permissions)
			}
		})
	}
}

type emptySearchSubject struct{ types.AuthInfo }

func (emptySearchSubject) GetSubject() string { return "" }

type delegatedSearchCaller struct{ types.AuthInfo }

func (delegatedSearchCaller) GetIdentityType() types.IdentityType { return types.TypeUser }
func (delegatedSearchCaller) GetTokenDelegatedPermissions() []string {
	return []string{searchTestGrant}
}

type searchTestRPC struct {
	authzv1.LegacyAuthzServiceClient
	ctx              context.Context
	request          *authzv1.LegacySearchUsersPermissionsRequest
	responses        []*authzv1.LegacySearchUsersPermissionsResponse
	openErr, recvErr error
	nilStream        bool
	calls            int
}

func (f *searchTestRPC) LegacySearchUsersPermissions(ctx context.Context, req *authzv1.LegacySearchUsersPermissionsRequest, _ ...grpc.CallOption) (authzv1.LegacyAuthzService_LegacySearchUsersPermissionsClient, error) {
	f.ctx, f.request = ctx, req
	f.calls++
	if f.openErr != nil {
		return nil, f.openErr
	}
	if f.nilStream {
		return nil, nil
	}
	return &searchTestStream{responses: append([]*authzv1.LegacySearchUsersPermissionsResponse{}, f.responses...), err: f.recvErr}, nil
}

type searchTestStream struct {
	grpc.ClientStream
	responses []*authzv1.LegacySearchUsersPermissionsResponse
	err       error
}

func (s *searchTestStream) Recv() (*authzv1.LegacySearchUsersPermissionsResponse, error) {
	if len(s.responses) > 0 {
		response := s.responses[0]
		s.responses = s.responses[1:]
		return response, nil
	}
	if s.err != nil {
		return nil, s.err
	}
	return nil, io.EOF
}

type searchTransportServer struct {
	authzv1.UnimplementedLegacyAuthzServiceServer
	handle func(*authzv1.LegacySearchUsersPermissionsRequest, authzv1.LegacyAuthzService_LegacySearchUsersPermissionsServer) error
}

func (s *searchTransportServer) LegacySearchUsersPermissions(req *authzv1.LegacySearchUsersPermissionsRequest, stream authzv1.LegacyAuthzService_LegacySearchUsersPermissionsServer) error {
	return s.handle(req, stream)
}
