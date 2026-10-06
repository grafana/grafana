package legacyclient

import (
	"context"
	"net"
	"testing"
	"time"

	authzlib "github.com/grafana/authlib/authz"
	modernv1 "github.com/grafana/authlib/authz/proto/v1"

	"github.com/stretchr/testify/require"
	"google.golang.org/grpc"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/credentials/insecure"
	"google.golang.org/grpc/status"
	"google.golang.org/grpc/test/bufconn"

	"github.com/grafana/authlib/types"
	authzv1 "github.com/grafana/grafana/pkg/services/authz/proto/v1"
)

func TestClient_LegacyGetUserPermissionsWireSnapshot(t *testing.T) {
	server := &legacyTransportServer{handle: func(req *authzv1.LegacyGetUserPermissionsRequest, stream authzv1.LegacyAuthzService_LegacyGetUserPermissionsServer) error {
		if req.Namespace != "stacks-12" || !req.GlobalOrg || req.Identity.Uid != "8" || req.Identity.GetInternalId() != 7 {
			return status.Error(codes.InvalidArgument, "request did not survive transport")
		}
		for range 3 {
			if err := stream.Send(&authzv1.LegacyGetUserPermissionsResponse{Permissions: []*authzv1.LegacyPermission{{Action: "users:create"}}}); err != nil {
				return err
			}
		}
		return nil
	}}
	client := newLegacyTransportClient(t, server)
	req := legacyRequest()
	req.GlobalOrg = true
	got, err := client.LegacyGetUserPermissions(t.Context(), legacyCaller("stacks-12", "authz.grafana.app/legacyuserpermissions:get"), req)
	require.NoError(t, err)
	require.Equal(t, []types.Permission{{Action: "users:create"}, {Action: "users:create"}, {Action: "users:create"}}, got.Permissions)
}

func TestClient_LegacyGetUserPermissionsWireFailureDiscardsChunks(t *testing.T) {
	server := &legacyTransportServer{handle: func(_ *authzv1.LegacyGetUserPermissionsRequest, stream authzv1.LegacyAuthzService_LegacyGetUserPermissionsServer) error {
		if err := stream.Send(&authzv1.LegacyGetUserPermissionsResponse{Permissions: []*authzv1.LegacyPermission{{Action: "users:create"}}}); err != nil {
			return err
		}
		return status.Error(codes.Internal, "failed after first chunk")
	}}
	got, err := newLegacyTransportClient(t, server).LegacyGetUserPermissions(t.Context(), legacyCaller("stacks-12", "authz.grafana.app/legacyuserpermissions:get"), legacyRequest())
	require.Equal(t, codes.Internal, status.Code(err))
	require.Empty(t, got.Permissions)
}

func TestClient_LegacyGetUserPermissionsWireCancellation(t *testing.T) {
	entered := make(chan struct{})
	server := &legacyTransportServer{handle: func(_ *authzv1.LegacyGetUserPermissionsRequest, stream authzv1.LegacyAuthzService_LegacyGetUserPermissionsServer) error {
		if err := stream.Send(&authzv1.LegacyGetUserPermissionsResponse{Permissions: []*authzv1.LegacyPermission{{Action: "users:create"}}}); err != nil {
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
		response LegacyGetUserPermissionsResponse
		err      error
	}
	done := make(chan result, 1)
	go func() {
		response, err := client.LegacyGetUserPermissions(ctx, legacyCaller("stacks-12", "authz.grafana.app/legacyuserpermissions:get"), legacyRequest())
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
		require.Empty(t, got.response.Permissions)
	case <-time.After(10 * time.Second):
		t.Fatal("client did not observe cancellation")
	}
}

func TestClient_LegacyGetUserPermissionsForwardsDeadline(t *testing.T) {
	observed := make(chan time.Time, 1)
	server := &legacyTransportServer{handle: func(_ *authzv1.LegacyGetUserPermissionsRequest, stream authzv1.LegacyAuthzService_LegacyGetUserPermissionsServer) error {
		deadline, ok := stream.Context().Deadline()
		if !ok {
			return status.Error(codes.InvalidArgument, "deadline was lost")
		}
		observed <- deadline
		return nil
	}}
	client := newLegacyTransportClient(t, server)
	deadline := time.Now().Add(10 * time.Second)
	ctx, cancel := context.WithDeadline(t.Context(), deadline)
	defer cancel()
	_, err := client.LegacyGetUserPermissions(ctx, legacyCaller("stacks-12", "authz.grafana.app/legacyuserpermissions:get"), legacyRequest())
	require.NoError(t, err)
	select {
	case got := <-observed:
		require.WithinDuration(t, deadline, got, time.Second)
	default:
		t.Fatal("server did not observe deadline")
	}
}

func TestClient_LegacyGetUserPermissionsWireDeadline(t *testing.T) {
	client := newLegacyTransportClient(t, &authzv1.UnimplementedLegacyAuthzServiceServer{})
	ctx, cancel := context.WithDeadline(t.Context(), time.Now().Add(-time.Second))
	defer cancel()
	got, err := client.LegacyGetUserPermissions(ctx, legacyCaller("stacks-12", "authz.grafana.app/legacyuserpermissions:get"), legacyRequest())
	require.Equal(t, codes.DeadlineExceeded, status.Code(err))
	require.Empty(t, got.Permissions)
}

func TestClient_LegacyGetUserPermissionsCompatibility(t *testing.T) {
	for _, tc := range []struct {
		name    string
		handler authzv1.LegacyAuthzServiceServer
	}{
		{"legacy service absent", nil},
		{"legacy method unimplemented", &authzv1.UnimplementedLegacyAuthzServiceServer{}},
	} {
		t.Run(tc.name, func(t *testing.T) {
			conn := newLegacyTransportConn(t, tc.handler)
			caller := legacyCaller("stacks-12", "authz.grafana.app/legacyuserpermissions:get", "authz.grafana.app/userpermissions:get")
			got, err := NewLegacyClient(conn).LegacyGetUserPermissions(t.Context(), caller, legacyRequest())
			require.Equal(t, codes.Unimplemented, status.Code(err))
			require.Empty(t, got.Permissions)
			old, err := authzlib.NewClient(conn).GetUserPermissions(t.Context(), caller, types.GetUserPermissionsRequest{Namespace: "stacks-12"})
			require.NoError(t, err)
			require.Equal(t, []types.Permission{{Action: "users:read", Scope: "users:*"}}, old.Permissions)
		})
	}
}

func TestLegacyAuthzServiceIsSeparate(t *testing.T) {
	server := grpc.NewServer()
	t.Cleanup(server.Stop)
	authzv1.RegisterLegacyAuthzServiceServer(server, &authzv1.UnimplementedLegacyAuthzServiceServer{})
	require.Len(t, server.GetServiceInfo(), 1)
	require.Contains(t, server.GetServiceInfo(), authzv1.LegacyAuthzService_ServiceDesc.ServiceName)
	require.NotContains(t, server.GetServiceInfo(), "authz.v1.AuthzService")
	require.NotContains(t, server.GetServiceInfo(), authzv1.AuthzExtentionService_ServiceDesc.ServiceName)
	for _, method := range authzv1.AuthzExtentionService_ServiceDesc.Methods {
		require.NotEqual(t, "LegacyGetUserPermissions", method.MethodName)
	}
	for _, stream := range authzv1.AuthzExtentionService_ServiceDesc.Streams {
		require.NotEqual(t, "LegacyGetUserPermissions", stream.StreamName)
	}

	_, modernImplementsLegacy := any((*authzlib.ClientImpl)(nil)).(Service)
	require.False(t, modernImplementsLegacy)
	_, legacyImplementsAccess := any((*LegacyClient)(nil)).(types.AccessClient)
	require.False(t, legacyImplementsAccess)
	modern := modernv1.File_proto_v1_authz_proto.Services().ByName("AuthzService")
	require.Nil(t, modern.Methods().ByName("LegacyGetUserPermissions"))
	legacy := authzv1.File_legacy_permissions_proto.Services().ByName("LegacyAuthzService")
	require.Equal(t, 1, legacy.Methods().Len())
	require.Equal(t, "LegacyGetUserPermissions", string(legacy.Methods().Get(0).Name()))
}

type oldPermissionsServer struct {
	modernv1.UnimplementedAuthzServiceServer
}

func (*oldPermissionsServer) GetUserPermissions(_ *modernv1.GetUserPermissionsRequest, stream modernv1.AuthzService_GetUserPermissionsServer) error {
	return stream.Send(&modernv1.GetUserPermissionsResponse{Permissions: []*modernv1.UserPermission{{Action: "users:read", Scope: "users:*"}}})
}

type legacyTransportServer struct {
	authzv1.UnimplementedLegacyAuthzServiceServer
	handle func(*authzv1.LegacyGetUserPermissionsRequest, authzv1.LegacyAuthzService_LegacyGetUserPermissionsServer) error
}

func (s *legacyTransportServer) LegacyGetUserPermissions(req *authzv1.LegacyGetUserPermissionsRequest, stream authzv1.LegacyAuthzService_LegacyGetUserPermissionsServer) error {
	return s.handle(req, stream)
}

func newLegacyTransportClient(t *testing.T, handler authzv1.LegacyAuthzServiceServer) *LegacyClient {
	t.Helper()
	return NewLegacyClient(newLegacyTransportConn(t, handler))
}

func newLegacyTransportConn(t *testing.T, handler authzv1.LegacyAuthzServiceServer) *grpc.ClientConn {
	t.Helper()
	listener := bufconn.Listen(1024 * 1024)
	server := grpc.NewServer()
	modernv1.RegisterAuthzServiceServer(server, &oldPermissionsServer{})
	if handler != nil {
		authzv1.RegisterLegacyAuthzServiceServer(server, handler)
	}
	go func() { _ = server.Serve(listener) }()
	t.Cleanup(func() { server.Stop(); _ = listener.Close() })
	conn, err := grpc.NewClient("passthrough:///bufnet", grpc.WithTransportCredentials(insecure.NewCredentials()), grpc.WithContextDialer(func(ctx context.Context, _ string) (net.Conn, error) { return listener.DialContext(ctx) }))
	require.NoError(t, err)
	t.Cleanup(func() { require.NoError(t, conn.Close()) })
	return conn
}
