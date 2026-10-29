package authz

import (
	"context"
	"testing"

	"github.com/stretchr/testify/require"

	authlib "github.com/grafana/authlib/types"
)

type testUserPermissionsClient struct{}

type testLegacyAccessClient struct{}

func (*testLegacyAccessClient) LegacyCheck(context.Context, LegacyCheckRequest) (bool, error) {
	return false, nil
}

func (*testUserPermissionsClient) GetUserPermissions(context.Context, authlib.AuthInfo, authlib.GetUserPermissionsRequest) (authlib.GetUserPermissionsResponse, error) {
	return authlib.GetUserPermissionsResponse{}, nil
}

func (*testUserPermissionsClient) InvalidateUserPermissions(context.Context, authlib.AuthInfo, authlib.GetUserPermissionsRequest) error {
	return nil
}

func TestAuthZClientsExposeCapabilitiesSeparately(t *testing.T) {
	accessClient := authlib.FixedAccessClient(true)
	legacyAccessClient := &testLegacyAccessClient{}
	permissionsClient := &testUserPermissionsClient{}
	clients := newAuthZClients(accessClient, legacyAccessClient, permissionsClient)

	require.Same(t, accessClient, ProvideAuthZAccessClient(clients))
	require.Same(t, legacyAccessClient, ProvideAuthZLegacyAccessClient(clients))
	require.Same(t, permissionsClient, ProvideAuthZUserPermissionsClient(clients))
}
