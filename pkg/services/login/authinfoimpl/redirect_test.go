package authinfoimpl

import (
	"context"
	"testing"

	"github.com/open-feature/go-sdk/openfeature"
	"github.com/open-feature/go-sdk/openfeature/memprovider"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/login"
	"github.com/grafana/grafana/pkg/services/login/authinfotest"
	"github.com/grafana/grafana/pkg/setting"
)

func TestRedirectStore(t *testing.T) {
	getAuthInfoQuery := &login.GetAuthInfoQuery{UserId: 1}
	getUserLabelsQuery := login.GetUserLabelsQuery{UserIDs: []int64{1}}
	setAuthInfoCmd := &login.SetAuthInfoCommand{UserId: 1, UserUID: "u1", AuthModule: "oauth_generic_oauth"}
	updateAuthInfoCmd := &login.UpdateAuthInfoCommand{UserId: 1, AuthModule: "oauth_generic_oauth"}
	deleteAuthInfoCmd := &login.DeleteAuthInfoCommand{UserAuth: &login.UserAuth{UserId: 1, AuthModule: "oauth_generic_oauth"}}

	cases := []struct {
		name string
		call func(s login.Store) error
		on   func(m *authinfotest.MockAuthInfoStore)
	}{
		{
			name: "GetAuthInfo",
			call: func(s login.Store) error { _, err := s.GetAuthInfo(context.Background(), getAuthInfoQuery); return err },
			on: func(m *authinfotest.MockAuthInfoStore) {
				m.On("GetAuthInfo", mock.Anything, getAuthInfoQuery).Return(&login.UserAuth{}, nil).Once()
			},
		},
		{
			name: "GetUsersRecentlyUsedLabel",
			call: func(s login.Store) error {
				_, err := s.GetUsersRecentlyUsedLabel(context.Background(), getUserLabelsQuery)
				return err
			},
			on: func(m *authinfotest.MockAuthInfoStore) {
				m.On("GetUsersRecentlyUsedLabel", mock.Anything, getUserLabelsQuery).Return(map[int64]string{}, nil).Once()
			},
		},
		{
			name: "GetUserAuthModules",
			call: func(s login.Store) error { _, err := s.GetUserAuthModules(context.Background(), 1); return err },
			on: func(m *authinfotest.MockAuthInfoStore) {
				m.On("GetUserAuthModules", mock.Anything, int64(1)).Return([]string{}, nil).Once()
			},
		},
		{
			name: "SetAuthInfo",
			call: func(s login.Store) error { return s.SetAuthInfo(context.Background(), setAuthInfoCmd) },
			on: func(m *authinfotest.MockAuthInfoStore) {
				m.On("SetAuthInfo", mock.Anything, setAuthInfoCmd).Return(nil).Once()
			},
		},
		{
			name: "UpdateAuthInfo",
			call: func(s login.Store) error { return s.UpdateAuthInfo(context.Background(), updateAuthInfoCmd) },
			on: func(m *authinfotest.MockAuthInfoStore) {
				m.On("UpdateAuthInfo", mock.Anything, updateAuthInfoCmd).Return(nil).Once()
			},
		},
		{
			name: "DeleteUserAuthInfo",
			call: func(s login.Store) error { return s.DeleteUserAuthInfo(context.Background(), 1) },
			on: func(m *authinfotest.MockAuthInfoStore) {
				m.On("DeleteUserAuthInfo", mock.Anything, int64(1)).Return(nil).Once()
			},
		},
		{
			name: "DeleteAuthInfo",
			call: func(s login.Store) error { return s.DeleteAuthInfo(context.Background(), deleteAuthInfoCmd) },
			on: func(m *authinfotest.MockAuthInfoStore) {
				m.On("DeleteAuthInfo", mock.Anything, deleteAuthInfoCmd).Return(nil).Once()
			},
		},
	}

	for _, tc := range cases {
		t.Run(tc.name+"/flag off routes to legacy store", func(t *testing.T) {
			legacyStore := authinfotest.NewMockAuthInfoStore(t)
			k8sStore := authinfotest.NewMockAuthInfoStore(t)
			tc.on(legacyStore)

			s := newRedirectStoreForTest(legacyStore, k8sStore)
			require.NoError(t, tc.call(s))
		})

		t.Run(tc.name+"/flag on routes to k8s store", func(t *testing.T) {
			enableK8sAuthInfoRedirect(t)

			legacyStore := authinfotest.NewMockAuthInfoStore(t)
			k8sStore := authinfotest.NewMockAuthInfoStore(t)
			tc.on(k8sStore)

			s := newRedirectStoreForTest(legacyStore, k8sStore)
			require.NoError(t, tc.call(s))
		})
	}
}

func TestRedirectStore_K8sCtx(t *testing.T) {
	newStore := func() *redirectStore {
		return newRedirectStoreForTest(authinfotest.NewMockAuthInfoStore(t), authinfotest.NewMockAuthInfoStore(t))
	}

	t.Run("bare context: injects a service identity using the default org", func(t *testing.T) {
		s := newStore()

		out := s.k8sCtx(context.Background())

		requester, err := identity.GetRequester(out)
		require.NoError(t, err)
		assert.True(t, identity.IsServiceIdentity(out))
		assert.Equal(t, s.cfg.DefaultOrgID(), requester.GetOrgID())
	})

	t.Run("org on ctx but no identity: the synthesized identity uses that org, not the default", func(t *testing.T) {
		s := newStore()
		const orgID int64 = 7
		ctx := identity.WithOrgID(context.Background(), orgID)

		out := s.k8sCtx(ctx)

		requester, err := identity.GetRequester(out)
		require.NoError(t, err)
		assert.Equal(t, orgID, requester.GetOrgID())
	})

	t.Run("identity already present: ctx passes through unchanged", func(t *testing.T) {
		s := newStore()
		ctx, want := identity.WithServiceIdentity(context.Background(), 3)

		out := s.k8sCtx(ctx)

		got, err := identity.GetRequester(out)
		require.NoError(t, err)
		assert.Same(t, want, got)
	})
}

func newRedirectStoreForTest(legacyStore, k8sStore login.Store) *redirectStore {
	return &redirectStore{
		legacyStore:       legacyStore,
		k8sStore:          k8sStore,
		openFeatureClient: openfeature.NewDefaultClient(),
		cfg:               setting.NewCfg(),
		logger:            log.New("test"),
	}
}

func enableK8sAuthInfoRedirect(t *testing.T) {
	t.Helper()
	flag, err := setting.ParseFlag(featuremgmt.FlagKubernetesAuthInfoRedirect, "true")
	require.NoError(t, err)
	provider, err := featuremgmt.CreateStaticProviderWithStandardFlags(map[string]memprovider.InMemoryFlag{
		featuremgmt.FlagKubernetesAuthInfoRedirect: flag,
	})
	require.NoError(t, err)
	require.NoError(t, openfeature.SetProviderAndWait(provider))
	t.Cleanup(func() {
		_ = openfeature.SetProviderAndWait(memprovider.NewInMemoryProvider(nil))
	})
}
