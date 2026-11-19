package authinfoimpl

import (
	"context"
	"testing"

	"github.com/grafana/grafana/pkg/services/login"
	"github.com/grafana/grafana/pkg/services/login/authinfotest"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"
)

func TestAuthInfoService_GetUserAuthModuleLabels(t *testing.T) {
	store := authinfotest.NewMockAuthInfoStore(t)

	userID := int64(42)
	// Input modules from store (order matters, uniqueness assumed)
	modules := []string{login.OktaAuthModule, login.LDAPAuthModule, login.SAMLAuthModule}

	store.On("GetUserAuthModules", mock.Anything, userID).Return(modules, nil)

	svc := ProvideService(store, nil, nil)

	actual, err := svc.GetUserAuthModuleLabels(context.Background(), userID)
	require.NoError(t, err)

	expected := []string{login.GetAuthProviderLabel(login.OktaAuthModule), login.GetAuthProviderLabel(login.LDAPAuthModule), login.GetAuthProviderLabel(login.SAMLAuthModule)}

	// Verify labels mapped and order preserved
	require.Equal(t, expected, actual)
}

func TestAuthInfoService_GetUsersAuthModules(t *testing.T) {
	t.Run("delegates to the store", func(t *testing.T) {
		store := authinfotest.NewMockAuthInfoStore(t)
		expected := map[string][]string{"u1": {login.LDAPAuthModule, login.SAMLAuthModule}}
		store.On("GetUsersAuthModules", mock.Anything, []string{"u1", "u2"}).Return(expected, nil).Once()

		svc := ProvideService(store, nil, nil)

		actual, err := svc.GetUsersAuthModules(context.Background(), []string{"u1", "u2"})
		require.NoError(t, err)
		require.Equal(t, expected, actual)
	})

	t.Run("skips the store when there are no user IDs", func(t *testing.T) {
		store := authinfotest.NewMockAuthInfoStore(t)
		svc := ProvideService(store, nil, nil)

		actual, err := svc.GetUsersAuthModules(context.Background(), nil)
		require.NoError(t, err)
		require.Empty(t, actual)
	})
}
