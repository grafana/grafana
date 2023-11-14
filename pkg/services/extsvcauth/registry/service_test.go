package registry

import (
	"context"
	"sync"
	"testing"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/extsvcauth"
	"github.com/grafana/grafana/pkg/services/extsvcauth/tests"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"
)

type TestEnv struct {
	r        *Registry
	oauthReg *tests.ExternalServiceRegistryMock
	saReg    *tests.ExternalServiceRegistryMock
}

func setupTestEnv(t *testing.T) *TestEnv {
	env := TestEnv{}
	env.oauthReg = tests.NewExternalServiceRegistryMock(t)
	env.saReg = tests.NewExternalServiceRegistryMock(t)
	env.r = &Registry{
		features:        featuremgmt.WithFeatures(featuremgmt.FlagExternalServiceAuth, featuremgmt.FlagExternalServiceAccounts),
		logger:          log.New("extsvcauth.registry.test"),
		oauthReg:        env.oauthReg,
		saReg:           env.saReg,
		extSvcProviders: map[string]extsvcauth.AuthProvider{},
		lock:            sync.Mutex{},
	}
	return &env
}

func TestRegistry_CleanUpOrphanedExternalServices(t *testing.T) {
	tests := []struct {
		name string
		init func(*TestEnv)
	}{
		{
			name: "should not clean up when every service registered",
			init: func(te *TestEnv) {
				// Have registered two services one requested a service account, the other requested to be an oauth client
				te.r.extSvcProviders = map[string]extsvcauth.AuthProvider{"sa-svc": extsvcauth.ServiceAccounts, "oauth-svc": extsvcauth.OAuth2Server}

				te.oauthReg.On("GetExternalServiceNames", mock.Anything).Return([]string{"OAuth-Svc"}, nil)
				// Also return the external service account attached to the OAuth Server
				te.saReg.On("GetExternalServiceNames", mock.Anything).Return([]string{"Sa-Svc", "OAuth-Svc"}, nil)
			},
		},
		{
			name: "should clean up an orphaned service account",
			init: func(te *TestEnv) {
				// Have registered two services one requested a service account, the other requested to be an oauth client
				te.r.extSvcProviders = map[string]extsvcauth.AuthProvider{"sa-svc": extsvcauth.ServiceAccounts, "oauth-svc": extsvcauth.OAuth2Server}

				te.oauthReg.On("GetExternalServiceNames", mock.Anything).Return([]string{"OAuth-Svc"}, nil)
				// Also return the external service account attached to the OAuth Server
				te.saReg.On("GetExternalServiceNames", mock.Anything).Return([]string{"Sa-Svc", "Orphaned-Sa-Svc", "OAuth-Svc"}, nil)

				te.saReg.On("RemoveExternalService", mock.Anything, "Orphaned-Sa-Svc").Return(nil)
			},
		},
		{
			name: "should clean up an orphaned OAuth Client",
			init: func(te *TestEnv) {
				// Have registered two services one requested a service account, the other requested to be an oauth client
				te.r.extSvcProviders = map[string]extsvcauth.AuthProvider{"sa-svc": extsvcauth.ServiceAccounts, "oauth-svc": extsvcauth.OAuth2Server}

				te.oauthReg.On("GetExternalServiceNames", mock.Anything).Return([]string{"OAuth-Svc", "Orphaned-OAuth-Svc"}, nil)
				// Also return the external service account attached to the OAuth Server
				te.saReg.On("GetExternalServiceNames", mock.Anything).Return([]string{"Sa-Svc", "Orphaned-OAuth-Svc", "OAuth-Svc"}, nil)

				te.oauthReg.On("RemoveExternalService", mock.Anything, "Orphaned-OAuth-Svc").Return(nil)
			},
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			env := setupTestEnv(t)
			tt.init(env)

			err := env.r.CleanUpOrphanedExternalServices(context.Background())
			require.NoError(t, err)

			env.oauthReg.AssertExpectations(t)
			env.saReg.AssertExpectations(t)
		})
	}
}

func TestRegistry_GetExternalServiceNames(t *testing.T) {
	tests := []struct {
		name string
		init func(*TestEnv)
		want []string
	}{
		{
			name: "should de-dup names",
			init: func(te *TestEnv) {
				te.saReg.On("GetExternalServiceNames", mock.Anything).Return([]string{"Sa-Svc", "OAuth-Svc"}, nil)
				te.oauthReg.On("GetExternalServiceNames", mock.Anything).Return([]string{"OAuth-Svc"}, nil)
			},
			want: []string{"Sa-Svc", "OAuth-Svc"},
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			env := setupTestEnv(t)
			tt.init(env)

			names, err := env.r.GetExternalServiceNames(context.Background())
			require.NoError(t, err)
			require.EqualValues(t, tt.want, names)

			env.oauthReg.AssertExpectations(t)
			env.saReg.AssertExpectations(t)
		})
	}
}
