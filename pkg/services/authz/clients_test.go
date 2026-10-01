package authz

import (
	"context"
	"testing"

	"github.com/stretchr/testify/require"

	authlib "github.com/grafana/authlib/types"
	authzextv1 "github.com/grafana/grafana/pkg/services/authz/proto/v1"
)

type testUserPermissionsClient struct{}
type testLegacyAuthzClient struct {
	authzextv1.LegacyAuthzServiceClient
}

func (*testUserPermissionsClient) GetUserPermissions(context.Context, authlib.AuthInfo, authlib.GetUserPermissionsRequest) (authlib.GetUserPermissionsResponse, error) {
	return authlib.GetUserPermissionsResponse{}, nil
}

func (*testUserPermissionsClient) InvalidateUserPermissions(context.Context, authlib.AuthInfo, authlib.GetUserPermissionsRequest) error {
	return nil
}

func TestAuthZClientsExposeAccessAndRBACUserPermissionsSeparately(t *testing.T) {
	accessClient := authlib.FixedAccessClient(true)
	permissionsClient := &testUserPermissionsClient{}
	legacyAuthzClient := &testLegacyAuthzClient{}
	clients := newAuthZClients(accessClient, permissionsClient, legacyAuthzClient)

	require.Same(t, accessClient, ProvideAuthZAccessClient(clients))
	require.Same(t, permissionsClient, ProvideAuthZUserPermissionsClient(clients))
	require.Same(t, legacyAuthzClient, ProvideLegacyAuthzClient(clients))
}
