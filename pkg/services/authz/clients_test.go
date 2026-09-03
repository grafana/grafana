package authz

import (
	"context"
	"testing"

	"github.com/stretchr/testify/require"

	authlib "github.com/grafana/authlib/types"
)

type testUserPermissionsClient struct{}

func (*testUserPermissionsClient) GetUserPermissions(context.Context, authlib.AuthInfo, authlib.GetUserPermissionsRequest) (authlib.GetUserPermissionsResponse, error) {
	return authlib.GetUserPermissionsResponse{}, nil
}

func (*testUserPermissionsClient) InvalidateUserPermissions(context.Context, authlib.AuthInfo, authlib.GetUserPermissionsRequest) error {
	return nil
}

func TestAuthZClientsExposeAccessAndRBACUserPermissionsSeparately(t *testing.T) {
	accessClient := authlib.FixedAccessClient(true)
	permissionsClient := &testUserPermissionsClient{}
	clients := newAuthZClients(accessClient, permissionsClient)

	require.Same(t, accessClient, ProvideAuthZAccessClient(clients))
	require.Same(t, permissionsClient, ProvideAuthZUserPermissionsClient(clients))
}
