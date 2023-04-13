package oauthimpl

import (
	"crypto/rand"
	"crypto/rsa"
	"testing"
	"time"

	"github.com/ory/fosite"
	"github.com/ory/fosite/storage"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/infra/localcache"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/accesscontrol/acimpl"
	"github.com/grafana/grafana/pkg/services/accesscontrol/actest"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/oauthserver/oauthtest"
	satests "github.com/grafana/grafana/pkg/services/serviceaccounts/tests"
	"github.com/grafana/grafana/pkg/services/team/teamtest"
	"github.com/grafana/grafana/pkg/services/user/usertest"
	"github.com/grafana/grafana/pkg/setting"
)

type TestEnv struct {
	S           *OAuth2ServiceImpl
	Cfg         *setting.Cfg
	AcStore     *actest.FakeStore
	OAuthStore  *oauthtest.FakeStore
	UserService *usertest.FakeUserService
	TeamService *teamtest.FakeService
	SAService   *satests.MockServiceAccountService
}

func setupTestEnv(t *testing.T) *TestEnv {
	t.Helper()

	config := &fosite.Config{
		AccessTokenLifespan: time.Hour,
		TokenURL:            "test/oauth2/token",
		AccessTokenIssuer:   "test",
		IDTokenIssuer:       "test",
		ScopeStrategy:       fosite.WildcardScopeStrategy,
	}

	env := &TestEnv{
		Cfg:         setting.NewCfg(),
		AcStore:     &actest.FakeStore{},
		OAuthStore:  &oauthtest.FakeStore{},
		UserService: usertest.NewUserServiceFake(),
		TeamService: teamtest.NewFakeService(),
		SAService:   &satests.MockServiceAccountService{},
	}

	cfg := setting.NewCfg()

	// TODO: Replace this part with KeyService.GetServerPrivateKey()
	var errGenKey error
	privateKey, errGenKey := rsa.GenerateKey(rand.Reader, 2048)
	require.NoError(t, errGenKey)

	// TODO: add feature toggle
	fmgt := featuremgmt.WithFeatures()

	s := &OAuth2ServiceImpl{
		cache:         localcache.New(cacheExpirationTime, cacheCleanupInterval),
		cfg:           cfg,
		accessControl: acimpl.ProvideAccessControl(cfg),
		acService:     acimpl.ProvideOSSService(cfg, env.AcStore, localcache.New(0, 0), fmgt),
		memstore:      storage.NewMemoryStore(),
		sqlstore:      env.OAuthStore,
		logger:        log.New("oauthserver.test"),
		userService:   env.UserService,
		saService:     env.SAService,
		teamService:   env.TeamService,
		publicKey:     &privateKey.PublicKey,
	}

	s.oauthProvider = newProvider(config, s, privateKey)

	env.S = s

	return env
}

// func TestOAuth2ServiceImpl_SaveExternalService(t *testing.T) {
// 	s, fakes := SetupTest(t)

// 	tests := []struct {
// 		name    string
// 		init    func()
// 		runs    []oauthserver.ExternalServiceRegistration
// 		wantErr bool
// 	}{
// 		{
// 			name: "should not update anything",
// 			init: func() {
// 				fakes.Store.ExpectedClient = &oauthserver.Client{
// 					ExternalServiceName: "my-ext-service", ServiceAccountID: oauthserver.NoServiceAccountID,
// 				}
// 				fakes.SaService.ExpectedServiceAccountDTO = &serviceaccounts.ServiceAccountDTO{Id: 3}
// 			},
// 			runs: []oauthserver.ExternalServiceRegistration{
// 				{
// 					ExternalServiceName: "my-ext-service",
// 					Key:                 &oauthserver.KeyOption{PublicPEM: "PublicKey"},
// 				},
// 			},
// 			wantErr: false,
// 		},
// 		// {
// 		// 	name: "should create a service account",
// 		// 	init: func() {
// 		// 		fakes.Store.ExpectedClient = &oauthserver.Client{
// 		// 			ExternalServiceName: "test", ServiceAccountID: oauthserver.NoServiceAccountID,
// 		// 		}
// 		// 		fakes.SaService.ExpectedServiceAccountDTO = &serviceaccounts.ServiceAccountDTO{Id: 3}
// 		// 	},
// 		// 	cmd: &oauthserver.UpdateClientCommand{
// 		// 		ExternalServiceName: "test",
// 		// 		Permissions:         []ac.Permission{{Action: "users:read", Scope: "users:*"}},
// 		// 	},
// 		// 	wantErr: false,
// 		// },
// 		// {
// 		// 	name: "should delete the service account",
// 		// 	init: func() {
// 		// 		fakes.Store.ExpectedClient = &oauthserver.Client{
// 		// 			ExternalServiceName: "test", ServiceAccountID: 3,
// 		// 		}
// 		// 		fakes.SaService.ExpectedServiceAccountProfileDTO = &serviceaccounts.ServiceAccountProfileDTO{Id: 3}
// 		// 	},
// 		// 	cmd: &oauthserver.UpdateClientCommand{
// 		// 		ExternalServiceName: "test",
// 		// 		Permissions:         []ac.Permission{},
// 		// 	},
// 		// 	wantErr: false,
// 		// },
// 		// {
// 		// 	name: "should update the service account",
// 		// 	init: func() {
// 		// 		fakes.Store.ExpectedClient = &oauthserver.Client{
// 		// 			ExternalServiceName: "test", ServiceAccountID: 3,
// 		// 		}
// 		// 		fakes.SaService.ExpectedServiceAccountProfileDTO = &serviceaccounts.ServiceAccountProfileDTO{Id: 3}
// 		// 	},
// 		// 	cmd: &oauthserver.UpdateClientCommand{
// 		// 		ExternalServiceName: "test",
// 		// 		Permissions:         []ac.Permission{{Action: "users:read", Scope: "users:*"}},
// 		// 	},
// 		// 	wantErr: false,
// 		// },
// 		// {
// 		// 	name: "should allow jwt bearer grant",
// 		// 	init: func() {
// 		// 		fakes.Store.ExpectedClient = &oauthserver.Client{
// 		// 			ExternalServiceName: "test", ServiceAccountID: 3,
// 		// 		}
// 		// 	},
// 		// 	cmd: &oauthserver.UpdateClientCommand{
// 		// 		ExternalServiceName:    "test",
// 		// 		ImpersonatePermissions: []ac.Permission{{Action: "users:read", Scope: "users:*"}},
// 		// 	},
// 		// 	wantErr: false,
// 		// },
// 		// {
// 		// 	name: "should generate credentials",
// 		// 	init: func() { fakes.Store.ExpectedClient = &oauthserver.Client{ExternalServiceName: "test"} },
// 		// 	cmd: &oauthserver.UpdateClientCommand{
// 		// 		ExternalServiceName: "test",
// 		// 		GenCredentials:      true,
// 		// 	},
// 		// 	wantErr: false,
// 		// },
// 		// {
// 		// 	name: "should generate keys",
// 		// 	init: func() { fakes.Store.ExpectedClient = &oauthserver.Client{ExternalServiceName: "test"} },
// 		// 	cmd: &oauthserver.UpdateClientCommand{
// 		// 		ExternalServiceName: "test",
// 		// 		Key:                 &oauthserver.KeyOption{Generate: true},
// 		// 	},
// 		// 	wantErr: false,
// 		// },
// 	}
// 	for _, tt := range tests {
// 		t.Run(tt.name, func(t *testing.T) {
// 			tt.init()

// 			for i := range tt.runs {
// 				dto, err := s.SaveExternalService(context.Background(), &tt.runs[i])
// 				if tt.wantErr {
// 					require.Error(t, err)
// 					return
// 				}
// 				require.NoError(t, err)

// 				// Check that we computed grant types and created or updated the service account
// 				if len(tt.runs[i].Permissions) > 0 {
// 					require.NotNil(t, dto.GrantTypes)
// 					require.Contains(t, dto.GrantTypes, "client_credentials", "grant types should contain client_credentials")
// 				}
// 			}

// 			// 	// If we had no service account previously we should have created one
// 			// 	if fakes.Store.ExpectedClient.ServiceAccountID == oauthserver.NoServiceAccountID {
// 			// 		require.NotNil(t, cmd.ServiceAccountID)
// 			// 		require.Equal(t, *cmd.ServiceAccountID, fakes.SaService.ExpectedServiceAccountDTO.Id)
// 			// 	}
// 			// 	// If we had a service account previously we should not have created a new one
// 			// 	if fakes.Store.ExpectedClient.ServiceAccountID != oauthserver.NoServiceAccountID {
// 			// 		require.Nil(t, cmd.ServiceAccountID)
// 			// 	}
// 			// }
// 			// // Check that we updated grant types and deleted service account
// 			// if tt.cmd.Permissions != nil && len(tt.cmd.Permissions) == 0 {
// 			// 	require.NotNil(t, cmd.GrantTypes)
// 			// 	require.NotContains(t, *cmd.GrantTypes, "client_credentials", "grant types should contain client_credentials")

// 			// 	// We should have no service account id
// 			// 	require.NotNil(t, cmd.ServiceAccountID)
// 			// 	require.Equal(t, *cmd.ServiceAccountID, oauthserver.NoServiceAccountID)
// 			// }
// 			// // Check that we updated grant types
// 			// if tt.cmd.ImpersonatePermissions != nil && len(tt.cmd.ImpersonatePermissions) > 0 {
// 			// 	require.NotNil(t, cmd.GrantTypes)
// 			// 	require.Contains(t, *cmd.GrantTypes, fosite.GrantTypeJWTBearer, "grant types should contain JWT Bearer grant")
// 			// }
// 			// // Check that we have generated credentials
// 			// if tt.cmd.GenCredentials {
// 			// 	require.NotNil(t, cmd.Secret)
// 			// 	require.NotNil(t, cmd.ClientID)
// 			// }
// 			// // Check that we have generated keys and that we correctly return them
// 			// if tt.cmd.Key != nil && tt.cmd.Key.Generate {
// 			// 	require.NotEmpty(t, cmd.PublicPem)
// 			// 	require.NotNil(t, dto.KeyResult)
// 			// 	require.True(t, dto.KeyResult.Generated)
// 			// 	require.NotEmpty(t, dto.KeyResult.PrivatePem)
// 			// 	require.NotEmpty(t, dto.KeyResult.PublicPem)
// 			// }
// 		})
// 	}
// }
