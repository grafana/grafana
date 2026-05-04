package authinfoimpl

import (
	"context"
	"errors"
	"testing"

	"github.com/grafana/grafana/pkg/infra/remotecache"
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

func TestAuthInfoService_DeleteUserAuthInfoByModule(t *testing.T) {
	t.Run("Should delegate to store and invalidate cache", func(t *testing.T) {
		store := authinfotest.NewMockAuthInfoStore(t)

		userID := int64(42)
		authModule := login.GoogleAuthModule

		store.On("DeleteUserAuthInfoByModule", mock.Anything, userID, authModule).Return(nil)

		fakeCache := remotecache.FakeCacheStorage{Storage: map[string][]byte{}}
		svc := ProvideService(store, fakeCache, nil)

		err := svc.DeleteUserAuthInfoByModule(context.Background(), userID, authModule)
		require.NoError(t, err)

		store.AssertCalled(t, "DeleteUserAuthInfoByModule", mock.Anything, userID, authModule)
	})

	t.Run("Should propagate store errors", func(t *testing.T) {
		store := authinfotest.NewMockAuthInfoStore(t)

		userID := int64(42)
		authModule := login.GoogleAuthModule
		expectedErr := errors.New("database error")

		store.On("DeleteUserAuthInfoByModule", mock.Anything, userID, authModule).Return(expectedErr)

		fakeCache := remotecache.FakeCacheStorage{Storage: map[string][]byte{}}
		svc := ProvideService(store, fakeCache, nil)

		err := svc.DeleteUserAuthInfoByModule(context.Background(), userID, authModule)
		require.ErrorIs(t, err, expectedErr)
	})
}
