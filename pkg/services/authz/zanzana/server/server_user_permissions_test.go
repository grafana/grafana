package server

import (
	"context"
	"errors"
	"fmt"
	"io"
	"testing"
	"time"

	"github.com/fullstorydev/grpchan/inprocgrpc"
	authnlib "github.com/grafana/authlib/authn"
	authzv1 "github.com/grafana/authlib/authz/proto/v1"
	"github.com/grafana/authlib/types"
	openfgav1 "github.com/openfga/api/proto/openfga/v1"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/stretchr/testify/require"
	"google.golang.org/grpc"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"

	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/authz/zanzana/common"
)

type permissionResponseStream struct {
	grpc.ServerStream
	ctx         context.Context
	permissions []*authzv1.UserPermission
	onSend      func() error
}

func (s *permissionResponseStream) Context() context.Context { return s.ctx }
func (s *permissionResponseStream) Send(response *authzv1.GetUserPermissionsResponse) error {
	if s.onSend != nil {
		if err := s.onSend(); err != nil {
			return err
		}
	}
	s.permissions = append(s.permissions, response.Permissions...)
	return nil
}

func TestUserPermissionsAuthorization(t *testing.T) {
	authorized := newContextWithNamespace()
	otherNamespace := types.WithAuthInfo(context.Background(), authnlib.NewAccessTokenAuthInfo(authnlib.Claims[authnlib.AccessTokenClaims]{Rest: authnlib.AccessTokenClaims{Namespace: "stacks-99"}}))
	for _, tc := range []struct {
		name string
		ctx  context.Context
		req  *authzv1.GetUserPermissionsRequest
		code codes.Code
	}{
		{"unauthenticated", context.Background(), &authzv1.GetUserPermissionsRequest{Namespace: "default", Subject: "user:alice"}, codes.Unauthenticated},
		{"namespace boundary", otherNamespace, &authzv1.GetUserPermissionsRequest{Namespace: "default", Subject: "user:alice"}, codes.PermissionDenied},
		{"missing namespace", authorized, &authzv1.GetUserPermissionsRequest{Subject: "user:alice"}, codes.InvalidArgument},
		{"missing subject", authorized, &authzv1.GetUserPermissionsRequest{Namespace: "default"}, codes.InvalidArgument},
		{"unsupported subject", authorized, &authzv1.GetUserPermissionsRequest{Namespace: "default", Subject: "api-key:7"}, codes.PermissionDenied},
	} {
		t.Run(tc.name, func(t *testing.T) {
			s := &Server{tracer: tracing.NewNoopTracerService(), metrics: newZanzanaServerMetrics(prometheus.NewRegistry())}
			stream := &permissionResponseStream{ctx: tc.ctx}
			require.Equal(t, tc.code, status.Code(s.GetUserPermissions(tc.req, stream)))
			require.Empty(t, stream.permissions)
		})
	}
}

func TestUserPermissionsAcceptsNamespaceCallerWithoutServiceGrant(t *testing.T) {
	server, _, _ := newPermissionTestServer(t, permissionParityTuples())
	ctx := types.WithAuthInfo(t.Context(), authnlib.NewAccessTokenAuthInfo(authnlib.Claims[authnlib.AccessTokenClaims]{Rest: authnlib.AccessTokenClaims{Namespace: namespace}}))
	stream := &permissionResponseStream{ctx: ctx}
	require.NoError(t, server.GetUserPermissions(&authzv1.GetUserPermissionsRequest{Namespace: namespace, Subject: "user:direct"}, stream))
	require.NotEmpty(t, stream.permissions)
}

type permissionAuthenticatedStream struct {
	grpc.ServerStream
	ctx context.Context
}

func (s permissionAuthenticatedStream) Context() context.Context { return s.ctx }

func permissionRPC(t *testing.T, s *Server) authzv1.AuthzServiceClient {
	t.Helper()
	channel := (&inprocgrpc.Channel{}).WithServerStreamInterceptor(func(srv any, stream grpc.ServerStream, _ *grpc.StreamServerInfo, handler grpc.StreamHandler) error {
		info, _ := types.AuthInfoFrom(newContextWithNamespace())
		return handler(srv, permissionAuthenticatedStream{ServerStream: stream, ctx: types.WithAuthInfo(stream.Context(), info)})
	})
	authzv1.RegisterAuthzServiceServer(channel, s)
	return authzv1.NewAuthzServiceClient(channel)
}

func TestUserPermissionsRPCChunksAndFailure(t *testing.T) {
	tuples := make([]*openfgav1.TupleKey, 1005)
	for i := range tuples {
		tuples[i] = common.NewResourceTuple("user:many", common.RelationGet, dashboardGroup, dashboardResource, "", fmt.Sprintf("dashboard-%04d", i))
	}
	server, ds, _ := newPermissionTestServer(t, tuples)
	client := permissionRPC(t, server)
	req := &authzv1.GetUserPermissionsRequest{Namespace: namespace, Subject: "user:many"}
	stream, err := client.GetUserPermissions(t.Context(), req)
	require.NoError(t, err)
	var sizes []int
	for {
		chunk, err := stream.Recv()
		if errors.Is(err, io.EOF) {
			break
		}
		require.NoError(t, err)
		sizes = append(sizes, len(chunk.Permissions))
	}
	require.Equal(t, []int{1000, 5}, sizes)
	sendFailure := errors.New("final send failed")
	for _, tc := range []struct {
		name        string
		cancelAfter int
		sendError   error
		wantError   error
		wantCount   int
	}{
		{"cancellation after final send", 2, nil, nil, len(tuples)},
		{"cancellation before final send", 1, nil, context.Canceled, userPermissionsChunkSize},
		{"final send failure", 0, sendFailure, sendFailure, userPermissionsChunkSize},
	} {
		t.Run(tc.name, func(t *testing.T) {
			ctx, cancel := context.WithCancel(newContextWithNamespace())
			defer cancel()
			calls := 0
			response := &permissionResponseStream{ctx: ctx, onSend: func() error {
				calls++
				if calls == tc.cancelAfter {
					cancel()
				}
				if calls == 2 {
					return tc.sendError
				}
				return nil
			}}
			err := server.GetUserPermissions(req, response)
			require.ErrorIs(t, err, tc.wantError)
			require.Len(t, response.permissions, tc.wantCount)
		})
	}
	ds.mu.Lock()
	ds.failRead = errors.New("remote datastore unavailable")
	ds.mu.Unlock()
	stream, err = client.GetUserPermissions(t.Context(), req)
	require.NoError(t, err)
	chunk, err := stream.Recv()
	require.Error(t, err)
	require.NotErrorIs(t, err, io.EOF)
	require.Nil(t, chunk, "storage failure must occur before publishing any permissions")
}

func TestResolveUserPermissionsDeduplicatesFormattedActionScopes(t *testing.T) {
	srv, _, store := newPermissionTestServer(t, nil)
	enablePrincipalCache(srv)
	grants := []permissionListResult{
		{Entry: common.ActionListEntry{Action: "folders:read"}, List: &authzv1.ListResponse{Items: []string{"alpha", "zeta"}, Folders: []string{"alpha", "middle"}}},
		{Entry: common.ActionListEntry{Action: "folders:write"}, List: &authzv1.ListResponse{Items: []string{"alpha"}}},
		{Entry: common.ActionListEntry{Action: "dashboards:read"}, List: &authzv1.ListResponse{All: true}},
	}
	cache := srv.principalCache()
	cache.mu.Lock()
	// Item and folder entries can format to the same legacy scope.
	cache.entries.Add(permissionPrincipalKey{store.ID, store.ModelID, "user:alice"}, permissionPrincipalEntry{grants: &principalGrants{grants: grants}, expires: cache.clock.Now().Add(time.Minute)})
	cache.mu.Unlock()

	got, err := srv.resolveUserPermissions(newContextWithNamespace(), &authzv1.GetUserPermissionsRequest{Namespace: namespace, Subject: "user:alice"})
	require.NoError(t, err)
	scopes := map[string][]string{
		"folders:read":    {"folders:uid:alpha", "folders:uid:zeta", "folders:uid:middle"},
		"folders:write":   {"folders:uid:alpha"},
		"dashboards:read": {"*", "dashboards:*", "folders:*"},
	}
	want := make([]accesscontrol.Permission, 0, 7)
	for _, entry := range common.SupportedActions() {
		for _, scope := range scopes[entry.Action] {
			want = append(want, accesscontrol.Permission{Action: entry.Action, Scope: scope})
		}
	}
	require.Equal(t, want, got, "keep first occurrence order, different actions and overlapping wildcard scopes")
}

func TestUserPermissionsRPCUIDScopes(t *testing.T) {
	srv, _, _ := newPermissionTestServer(t, []*openfgav1.TupleKey{
		common.NewTypedTuple(common.TypeTeam, "user:alice", common.RelationGet, "platform"),
		common.NewTypedTuple(common.TypeUser, "user:alice", common.RelationGet, "bob"),
		common.NewTypedTuple(common.TypeServiceAccount, "user:alice", common.RelationGet, "robot"),
	})
	stream, err := permissionRPC(t, srv).GetUserPermissions(t.Context(), &authzv1.GetUserPermissionsRequest{Namespace: namespace, Subject: "user:alice"})
	require.NoError(t, err)
	response, err := stream.Recv()
	require.NoError(t, err)
	require.ElementsMatch(t, []*authzv1.UserPermission{
		{Action: "teams:read", Scope: "teams:uid:platform"},
		{Action: "users:read", Scope: "global.users:uid:bob"},
		{Action: "org.users:read", Scope: "users:uid:bob"},
		{Action: "serviceaccounts:read", Scope: "serviceaccounts:uid:robot"},
	}, response.Permissions)
	_, err = stream.Recv()
	require.ErrorIs(t, err, io.EOF)
}
