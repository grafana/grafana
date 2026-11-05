package rbac

import (
	"testing"

	"github.com/fullstorydev/grpchan/inprocgrpc"
	"github.com/stretchr/testify/require"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"

	authzv1 "github.com/grafana/grafana/pkg/services/authz/proto/v1"
)

func TestLegacyCheckServiceDoesNotEnumeratePermissions(t *testing.T) {
	channel := &inprocgrpc.Channel{}
	// Register the actual Check implementation: sharing a service descriptor must
	// not expose the private trusted-assertion enumeration handler on this server.
	authzv1.RegisterLegacyAuthzServiceServer(channel, &Service{})
	//nolint:staticcheck // Verify that the deprecated enumeration RPC remains unimplemented here.
	stream, err := authzv1.NewLegacyAuthzServiceClient(channel).LegacyGetUserPermissions(t.Context(), &authzv1.LegacyGetUserPermissionsRequest{
		Namespace: "default",
		Identity:  &authzv1.LegacyPermissionIdentity{Type: "user", Uid: "1", IsGrafanaAdmin: true},
	})
	if err == nil {
		_, err = stream.Recv()
	}
	require.Equal(t, codes.Unimplemented, status.Code(err))
}

func TestLegacyCheckServiceDoesNotSearchPermissions(t *testing.T) {
	channel := &inprocgrpc.Channel{}
	authzv1.RegisterLegacyAuthzServiceServer(channel, &Service{})
	stream, err := authzv1.NewLegacyAuthzServiceClient(channel).LegacySearchUsersPermissions(t.Context(), &authzv1.LegacySearchUsersPermissionsRequest{
		Namespace: "default",
		Caller:    &authzv1.LegacyPermissionIdentity{Type: "user", Uid: "1", IsGrafanaAdmin: true},
		Action:    "users:read",
	})
	if err == nil {
		_, err = stream.Recv()
	}
	require.Equal(t, codes.Unimplemented, status.Code(err))
}
