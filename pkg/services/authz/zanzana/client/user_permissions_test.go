package client

import (
	"context"
	"net"
	"testing"
	"time"

	"github.com/fullstorydev/grpchan/inprocgrpc"
	"github.com/go-jose/go-jose/v4/jwt"
	"github.com/grafana/authlib/authn"
	authzv1 "github.com/grafana/authlib/authz/proto/v1"
	"github.com/grafana/authlib/types"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/stretchr/testify/require"
	"google.golang.org/grpc"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/credentials/insecure"
	"google.golang.org/grpc/status"
	"google.golang.org/grpc/test/bufconn"
)

type userPermissionsServer struct {
	authzv1.UnimplementedAuthzServiceServer
	calls    int
	requests []*authzv1.GetUserPermissionsRequest
	fail     bool
}

func (s *userPermissionsServer) GetUserPermissions(req *authzv1.GetUserPermissionsRequest, stream authzv1.AuthzService_GetUserPermissionsServer) error {
	s.calls++
	s.requests = append(s.requests, req)
	scope := "dashboards:*"
	if s.calls > 1 {
		scope = "dashboards:uid:restricted"
	}
	if err := stream.Send(&authzv1.GetUserPermissionsResponse{Permissions: []*authzv1.UserPermission{{Action: "dashboards:read", Scope: scope}}}); err != nil {
		return err
	}
	if s.fail {
		return status.Error(codes.Unavailable, "datastore failure")
	}
	return stream.Send(&authzv1.GetUserPermissionsResponse{Permissions: []*authzv1.UserPermission{{Action: "folders:read", Scope: "folders:uid:one"}}})
}
func userPermissionsCaller(groups []string) *authn.AuthInfo {
	return authn.NewIDTokenAuthInfo(authn.Claims[authn.AccessTokenClaims]{Claims: jwt.Claims{Subject: "service"}, Rest: authn.AccessTokenClaims{Namespace: "default", DelegatedPermissions: []string{"authz.grafana.app/userpermissions:get"}}},
		&authn.Claims[authn.IDTokenClaims]{Claims: jwt.Claims{Subject: "user:alice"}, Rest: authn.IDTokenClaims{Identifier: "alice", Type: types.TypeUser, Namespace: "default", Groups: groups}})
}
func TestUserPermissionsUncachedAndComplete(t *testing.T) {
	server := &userPermissionsServer{}
	channel := &inprocgrpc.Channel{}
	authzv1.RegisterAuthzServiceServer(channel, server)
	client, err := New(channel, prometheus.NewRegistry())
	require.NoError(t, err)
	request := types.GetUserPermissionsRequest{Namespace: "default"}
	first, err := client.GetUserPermissions(t.Context(), userPermissionsCaller([]string{"team-a"}), request)
	require.NoError(t, err)
	require.Len(t, first.Permissions, 2)
	second, err := client.GetUserPermissions(t.Context(), userPermissionsCaller([]string{"team-a"}), request)
	require.NoError(t, err)
	require.Equal(t, 2, server.calls)
	require.NotEqual(t, first, second, "an unchanged caller must still observe revoked grants")
	require.Equal(t, []string{"team-a"}, server.requests[1].GetTeams())
	require.NoError(t, client.InvalidateUserPermissions(context.Background(), userPermissionsCaller(nil), request))
	server.fail = true
	result, err := client.GetUserPermissions(t.Context(), userPermissionsCaller([]string{"team-b"}), request)
	require.Equal(t, codes.Unavailable, status.Code(err))
	require.Empty(t, result.Permissions, "a stream error must discard already received permissions")
	require.Equal(t, []string{"team-b"}, server.requests[2].GetTeams())
}

type userPermissionsDeadlineServer struct {
	authzv1.UnimplementedAuthzServiceServer
	stall       bool
	firstSent   chan struct{}
	finishAfter time.Duration
}

func (s *userPermissionsDeadlineServer) GetUserPermissions(_ *authzv1.GetUserPermissionsRequest, stream authzv1.AuthzService_GetUserPermissionsServer) error {
	if err := stream.Send(&authzv1.GetUserPermissionsResponse{Permissions: []*authzv1.UserPermission{{Action: "dashboards:read", Scope: "dashboards:*"}}}); err != nil {
		return err
	}
	if s.firstSent != nil {
		close(s.firstSent)
	}
	if s.stall {
		<-stream.Context().Done()
		return stream.Context().Err()
	}
	if s.finishAfter > 0 {
		timer := time.NewTimer(s.finishAfter)
		defer timer.Stop()
		select {
		case <-timer.C:
		case <-stream.Context().Done():
			return stream.Context().Err()
		}
	}
	return nil
}

func newUserPermissionsDeadlineClient(t *testing.T, server *userPermissionsDeadlineServer, timeout time.Duration) *Client {
	t.Helper()
	listener := bufconn.Listen(1 << 20)
	grpcServer := grpc.NewServer()
	authzv1.RegisterAuthzServiceServer(grpcServer, server)
	go func() { _ = grpcServer.Serve(listener) }()
	t.Cleanup(func() {
		grpcServer.Stop()
		_ = listener.Close()
	})
	connection, err := grpc.NewClient("passthrough:///user-permissions", grpc.WithTransportCredentials(insecure.NewCredentials()),
		grpc.WithContextDialer(func(ctx context.Context, _ string) (net.Conn, error) { return listener.DialContext(ctx) }))
	require.NoError(t, err)
	t.Cleanup(func() { require.NoError(t, connection.Close()) })
	client, err := New(connection, prometheus.NewRegistry(), WithUserPermissionsTimeout(timeout))
	require.NoError(t, err)
	return client
}

func TestUserPermissionsDeadlineCoversStreamConsumption(t *testing.T) {
	server := &userPermissionsDeadlineServer{stall: true, firstSent: make(chan struct{})}
	client := newUserPermissionsDeadlineClient(t, server, 200*time.Millisecond)
	result, err := client.GetUserPermissions(context.Background(), userPermissionsCaller(nil), types.GetUserPermissionsRequest{Namespace: "default"})
	require.Equal(t, codes.DeadlineExceeded, status.Code(err))
	require.Empty(t, result.Permissions, "deadline must discard the received partial response")
	select {
	case <-server.firstSent:
	default:
		t.Fatal("the test must reach stream consumption after receiving the first chunk")
	}
}

func TestUserPermissionsPreservesCallerDeadline(t *testing.T) {
	server := &userPermissionsDeadlineServer{finishAfter: 200 * time.Millisecond}
	client := newUserPermissionsDeadlineClient(t, server, 50*time.Millisecond)
	ctx, cancel := context.WithTimeout(t.Context(), 5*time.Second)
	defer cancel()
	result, err := client.GetUserPermissions(ctx, userPermissionsCaller(nil), types.GetUserPermissionsRequest{Namespace: "default"})
	require.NoError(t, err)
	require.Len(t, result.Permissions, 1)
}
