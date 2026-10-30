package server

import (
	"context"
	"errors"
	"fmt"
	"io"
	"testing"

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
	"github.com/grafana/grafana/pkg/services/authz/zanzana/common"
	"github.com/grafana/grafana/pkg/services/authz/zanzana/legacyscopes"
)

type permissionResponseStream struct {
	grpc.ServerStream
	ctx         context.Context
	permissions []*authzv1.UserPermission
}

func (s *permissionResponseStream) Context() context.Context { return s.ctx }
func (s *permissionResponseStream) Send(response *authzv1.GetUserPermissionsResponse) error {
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

func TestUserPermissionsRPCParity(t *testing.T) {
	server, _, _ := newPermissionTestServer(t, permissionParityTuples())
	client := permissionRPC(t, server)
	for _, tc := range []struct {
		subject string
		teams   []string
	}{
		{"user:direct", nil}, {"user:external", []string{"external-a", "external-b"}}, {"user:admin", nil}, {"user:deep", nil}, {"user:all", nil}, {"user:absent", nil},
	} {
		t.Run(tc.subject, func(t *testing.T) {
			req := &authzv1.GetUserPermissionsRequest{Namespace: namespace, Subject: tc.subject, Teams: tc.teams}
			baseline, err := baselineGrantLists(t, server, req)
			require.NoError(t, err)
			want := map[[2]string]bool{}
			formatter := legacyscopes.Formatter{}
			for _, result := range baseline {
				for _, p := range formatter.Permissions(result.Entry.Resource, result.Entry.Action, "", result.List) {
					want[[2]string{p.Action, p.Scope}] = true
				}
			}
			stream, err := client.GetUserPermissions(t.Context(), req)
			require.NoError(t, err)
			got := map[[2]string]bool{}
			for {
				chunk, err := stream.Recv()
				if errors.Is(err, io.EOF) {
					break
				}
				require.NoError(t, err)
				for _, p := range chunk.Permissions {
					key := [2]string{p.Action, p.Scope}
					require.False(t, got[key], "duplicate permission on wire")
					got[key] = true
				}
			}
			require.Equal(t, want, got)
			if tc.subject == "user:direct" {
				require.True(t, got[[2]string{"users:read", "global.users:uid:readable-user"}])
				require.True(t, got[[2]string{"org.users:read", "users:uid:readable-user"}])
			}
			if tc.subject == "user:admin" {
				require.True(t, got[[2]string{"teams:read", "teams:uid:admin-team"}])
			}
		})
	}
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

func TestUserPermissionsRPCWithoutRolloutFlag(t *testing.T) {
	server, _, _ := newPermissionTestServer(t, permissionParityTuples())
	stream, err := permissionRPC(t, server).GetUserPermissions(t.Context(), &authzv1.GetUserPermissionsRequest{
		Namespace: namespace,
		Subject:   "user:direct",
	})
	require.NoError(t, err)
	chunk, err := stream.Recv()
	require.NoError(t, err)
	require.NotEmpty(t, chunk.Permissions)
}

func TestUserPermissionsRPCPreservesGrantedFolderScopes(t *testing.T) {
	tuples := []*openfgav1.TupleKey{
		common.NewFolderTuple("user:alice", common.RelationGet, "parent"),
		common.NewFolderResourceTuple("user:alice", common.RelationGet, dashboardGroup, dashboardResource, "", "parent"),
		common.NewFolderTuple("user:alice", common.RelationUpdate, "child"),
		common.NewFolderTuple("user:alice", common.RelationGet, "child"),
		common.NewFolderParentTuple("child", "parent"),
		common.NewFolderParentTuple("grandchild", "child"),
	}
	srv, ds, _ := newPermissionTestServer(t, tuples)
	stream := &permissionResponseStream{ctx: newContextWithNamespace()}
	err := srv.GetUserPermissions(&authzv1.GetUserPermissionsRequest{Namespace: namespace, Subject: "user:alice"}, stream)
	require.NoError(t, err)
	got := map[[2]string]bool{}
	for _, p := range stream.permissions {
		got[[2]string{p.Action, p.Scope}] = true
	}
	require.Equal(t, map[[2]string]bool{
		{"folders:read", "folders:uid:parent"}:    true,
		{"dashboards:read", "folders:uid:parent"}: true,
		{"folders:read", "folders:uid:child"}:     true,
		{"folders:write", "folders:uid:child"}:    true,
	}, got)
	counts, _ := ds.counts()
	require.Zero(t, counts["reverse"], "permission enumeration must not read descendant folders")

	list, err := srv.list(newContextWithNamespace(), &authzv1.ListRequest{
		Namespace: namespace, Subject: "user:alice", Group: folderGroup, Resource: folderResource, Verb: "get",
	})
	require.NoError(t, err)
	require.ElementsMatch(t, []string{"parent", "child", "grandchild"}, list.Items, "resource List still expands inherited access")
}
