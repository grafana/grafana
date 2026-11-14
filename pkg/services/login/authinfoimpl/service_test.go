package authinfoimpl

import (
	"context"
	"errors"
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
	t.Run("returns store modules", func(t *testing.T) {
		store := authinfotest.NewMockAuthInfoStore(t)
		ctx := t.Context()
		userIDs := []int64{42, 43}
		modules := map[int64][]string{42: {login.OktaAuthModule, login.LDAPAuthModule}}
		store.On("GetUsersAuthModules", ctx, userIDs).Return(modules, nil).Once()
		svc := ProvideService(store, nil, nil)

		actual, err := svc.GetUsersAuthModules(ctx, userIDs)
		require.NoError(t, err)
		require.Equal(t, modules, actual)
	})

	t.Run("returns store error", func(t *testing.T) {
		store := authinfotest.NewMockAuthInfoStore(t)
		ctx := t.Context()
		wantErr := errors.New("auth modules unavailable")
		store.On("GetUsersAuthModules", ctx, []int64{42}).Return(nil, wantErr).Once()
		svc := ProvideService(store, nil, nil)

		_, err := svc.GetUsersAuthModules(ctx, []int64{42})
		require.ErrorIs(t, err, wantErr)
	})
}
