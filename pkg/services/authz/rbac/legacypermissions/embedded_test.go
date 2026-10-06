package legacypermissions

import (
	"context"
	"testing"

	"github.com/fullstorydev/grpchan/inprocgrpc"
	authzv1 "github.com/grafana/authlib/authz/proto/v1"
	"github.com/grafana/authlib/types"
	"github.com/stretchr/testify/require"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"

	ac "github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/setting"
)

func TestLegacyHandlerRejectsUntrustedTransport(t *testing.T) {
	channel := &inprocgrpc.Channel{}
	authzv1.RegisterLegacyAuthzServiceServer(channel, &embeddedServer{guard: new(int)})
	ctx := types.WithAuthInfo(context.Background(), ac.LegacyPermissionCaller("*"))
	stream, err := authzv1.NewLegacyAuthzServiceClient(channel).LegacyGetUserPermissions(ctx, &authzv1.LegacyGetUserPermissionsRequest{
		Namespace: "default", Identity: &authzv1.LegacyPermissionIdentity{Type: "user", Uid: "one"},
	})
	if err == nil {
		_, err = stream.Recv()
	}
	require.Equal(t, codes.PermissionDenied, status.Code(err))
}

func TestEmbeddedLegacyNamespaceValidation(t *testing.T) {
	for _, tc := range []struct{ name, stack, namespace string }{
		{"wrong stack", "12", "stacks-13"},
		{"org alias on cloud", "12", "default"},
		{"stack on self managed", "", "stacks-12"},
	} {
		t.Run(tc.name, func(t *testing.T) {
			cfg := setting.NewCfg()
			cfg.StackID = tc.stack
			client := NewEmbeddedClient(nil, cfg) // Rejection must happen before any load.
			for _, global := range []bool{false, true} {
				result, err := client.LegacyGetUserPermissions(context.Background(), ac.LegacyPermissionCaller("*"), types.LegacyGetUserPermissionsRequest{
					Namespace: tc.namespace, GlobalOrg: global, Identity: types.LegacyPermissionIdentity{Type: types.TypeUser, UID: "one"},
				})
				require.Equal(t, codes.PermissionDenied, status.Code(err))
				require.Empty(t, result.Permissions)
			}
		})
	}
}
