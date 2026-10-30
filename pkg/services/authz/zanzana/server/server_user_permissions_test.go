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
	clientrest "k8s.io/client-go/rest"

	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/services/authz/zanzana"
	"github.com/grafana/grafana/pkg/services/authz/zanzana/common"
	"github.com/grafana/grafana/pkg/services/authz/zanzana/legacyscopes"
	"github.com/grafana/grafana/pkg/setting"
)

type snapshotResponseStream struct {
	grpc.ServerStream
	ctx         context.Context
	permissions []*authzv1.UserPermission
}

func (s *snapshotResponseStream) Context() context.Context { return s.ctx }
func (s *snapshotResponseStream) Send(response *authzv1.GetUserPermissionsResponse) error {
	s.permissions = append(s.permissions, response.Permissions...)
	return nil
}

func TestUserPermissionsAuthorization(t *testing.T) {
	authorized := newContextWithNamespaceAndPermissions(zanzana.TokenPermissionUserPermissions)
	otherNamespace := types.WithAuthInfo(context.Background(), authnlib.NewAccessTokenAuthInfo(authnlib.Claims[authnlib.AccessTokenClaims]{Rest: authnlib.AccessTokenClaims{Namespace: "stacks-99", Permissions: []string{zanzana.TokenPermissionUserPermissions}}}))
	for _, tc := range []struct {
		name string
		ctx  context.Context
		req  *authzv1.GetUserPermissionsRequest
		code codes.Code
	}{
		{"unauthenticated", context.Background(), &authzv1.GetUserPermissionsRequest{Namespace: "default", Subject: "user:alice"}, codes.Unauthenticated},
		{"missing service grant", newContextWithNamespace(), &authzv1.GetUserPermissionsRequest{Namespace: "default", Subject: "user:alice"}, codes.PermissionDenied},
		{"namespace boundary", otherNamespace, &authzv1.GetUserPermissionsRequest{Namespace: "default", Subject: "user:alice"}, codes.PermissionDenied},
		{"missing namespace", authorized, &authzv1.GetUserPermissionsRequest{Subject: "user:alice"}, codes.InvalidArgument},
		{"missing subject", authorized, &authzv1.GetUserPermissionsRequest{Namespace: "default"}, codes.InvalidArgument},
		{"unsupported subject", authorized, &authzv1.GetUserPermissionsRequest{Namespace: "default", Subject: "api-key:7"}, codes.PermissionDenied},
	} {
		t.Run(tc.name, func(t *testing.T) {
			s := &Server{tracer: tracing.NewNoopTracerService(), metrics: newZanzanaServerMetrics(prometheus.NewRegistry())}
			stream := &snapshotResponseStream{ctx: tc.ctx}
			require.Equal(t, tc.code, status.Code(s.GetUserPermissions(tc.req, stream)))
			require.Empty(t, stream.permissions)
		})
	}

}

func TestUserPermissionsStandaloneScopeConfiguration(t *testing.T) {
	for _, missing := range []string{"IAM URL", "token", "exchange URL"} {
		t.Run(missing, func(t *testing.T) {
			cfg := setting.NewCfg()
			cfg.ZanzanaReconciler.IAMAPIServerURL = "https://iam.example.test"
			cfg.Raw.Section("grpc_client_authentication").Key("token").SetValue("test-token")
			cfg.Raw.Section("grpc_client_authentication").Key("token_exchange_url").SetValue("https://exchange.example.test")
			switch missing {
			case "IAM URL":
				cfg.ZanzanaReconciler.IAMAPIServerURL = ""
			case "token":
				cfg.Raw.Section("grpc_client_authentication").Key("token").SetValue("")
			case "exchange URL":
				cfg.Raw.Section("grpc_client_authentication").Key("token_exchange_url").SetValue("")
			}
			resolver := newPermissionScopeResolver(cfg, nil)
			require.Nil(t, resolver)
			server := &Server{cfg: cfg.ZanzanaServer, permissionScopeResolver: resolver, tracer: tracing.NewNoopTracerService(), metrics: newZanzanaServerMetrics(prometheus.NewRegistry())}
			stream := &snapshotResponseStream{ctx: newContextWithNamespaceAndPermissions(zanzana.TokenPermissionUserPermissions)}
			err := server.GetUserPermissions(&authzv1.GetUserPermissionsRequest{Namespace: namespace, Subject: "user:alice"}, stream)
			require.Equal(t, codes.FailedPrecondition, status.Code(err), "reject missing scope configuration before accessing the datastore")
			require.Empty(t, stream.permissions)
		})
	}
	t.Run("embedded provider needs no standalone configuration", func(t *testing.T) {
		provider := permissionRestConfigProvider(func(context.Context) (*clientrest.Config, error) {
			t.Fatal("the IAM client must remain lazy")
			return nil, nil
		})
		require.NotNil(t, newPermissionScopeResolver(setting.NewCfg(), provider))
	})
	t.Run("complete standalone configuration remains lazy", func(t *testing.T) {
		cfg := setting.NewCfg()
		cfg.ZanzanaReconciler.IAMAPIServerURL = "https://iam.example.test"
		cfg.Raw.Section("grpc_client_authentication").Key("token").SetValue("test-token")
		cfg.Raw.Section("grpc_client_authentication").Key("token_exchange_url").SetValue("https://exchange.example.test")
		require.NotNil(t, newPermissionScopeResolver(cfg, nil))
	})
}

type snapshotIDs struct{}

func (snapshotIDs) GetTeamIDByUID(context.Context, types.NamespaceInfo, string) (int64, error) {
	return 42, nil
}
func (snapshotIDs) GetUserIDByUID(context.Context, types.NamespaceInfo, string) (int64, error) {
	return 7, nil
}

type snapshotAuthenticatedStream struct {
	grpc.ServerStream
	ctx context.Context
}

func (s snapshotAuthenticatedStream) Context() context.Context { return s.ctx }

func snapshotRPC(t *testing.T, s *Server) authzv1.AuthzServiceClient {
	t.Helper()
	channel := (&inprocgrpc.Channel{}).WithServerStreamInterceptor(func(srv any, stream grpc.ServerStream, _ *grpc.StreamServerInfo, handler grpc.StreamHandler) error {
		info, _ := types.AuthInfoFrom(newContextWithNamespaceAndPermissions(zanzana.TokenPermissionUserPermissions))
		return handler(srv, snapshotAuthenticatedStream{ServerStream: stream, ctx: types.WithAuthInfo(stream.Context(), info)})
	})
	authzv1.RegisterAuthzServiceServer(channel, s)
	return authzv1.NewAuthzServiceClient(channel)
}

func TestUserPermissionsRPCParity(t *testing.T) {
	server, _, _ := newSnapshotTestServer(t, snapshotParityTuples())
	server.permissionScopeResolver = snapshotIDs{}
	client := snapshotRPC(t, server)
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
			formatter := legacyscopes.Formatter{IDs: snapshotIDs{}}
			for _, result := range baseline {
				for _, p := range formatter.Permissions(t.Context(), namespace, result.Entry.Resource, result.Entry.Action, "", result.List) {
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
				require.True(t, got[[2]string{"users:read", "global.users:id:7"}])
				require.True(t, got[[2]string{"org.users:read", "users:id:7"}])
			}
			if tc.subject == "user:admin" {
				require.True(t, got[[2]string{"teams:read", "teams:id:42"}])
			}
		})
	}
}

func TestUserPermissionsRPCChunksAndFailure(t *testing.T) {
	tuples := make([]*openfgav1.TupleKey, 1005)
	for i := range tuples {
		tuples[i] = common.NewResourceTuple("user:many", common.RelationGet, dashboardGroup, dashboardResource, "", fmt.Sprintf("dashboard-%04d", i))
	}
	server, ds, _ := newSnapshotTestServer(t, tuples)
	server.permissionScopeResolver = snapshotIDs{}
	client := snapshotRPC(t, server)
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
	server, _, _ := newSnapshotTestServer(t, snapshotParityTuples())
	server.permissionScopeResolver = snapshotIDs{}
	stream, err := snapshotRPC(t, server).GetUserPermissions(t.Context(), &authzv1.GetUserPermissionsRequest{
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
	srv, ds, _ := newSnapshotTestServer(t, tuples)
	srv.permissionScopeResolver = snapshotIDs{}
	stream := &snapshotResponseStream{ctx: newContextWithNamespaceAndPermissions(zanzana.TokenPermissionUserPermissions)}
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
