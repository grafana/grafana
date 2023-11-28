package oasimpl

import (
	"context"
	"crypto/rand"
	"crypto/rsa"
	"encoding/base64"
	"fmt"
	"slices"
	"testing"
	"time"

	"github.com/ory/fosite"
	"github.com/ory/fosite/storage"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/infra/localcache"
	"github.com/grafana/grafana/pkg/infra/log"
	ac "github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/accesscontrol/acimpl"
	"github.com/grafana/grafana/pkg/services/accesscontrol/actest"
	"github.com/grafana/grafana/pkg/services/extsvcauth"
	"github.com/grafana/grafana/pkg/services/extsvcauth/oauthserver"
	"github.com/grafana/grafana/pkg/services/extsvcauth/oauthserver/oastest"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/pluginsettings"
	sa "github.com/grafana/grafana/pkg/services/serviceaccounts"
	saTests "github.com/grafana/grafana/pkg/services/serviceaccounts/tests"
	"github.com/grafana/grafana/pkg/services/signingkeys/signingkeystest"
	"github.com/grafana/grafana/pkg/services/team/teamtest"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/services/user/usertest"
	"github.com/grafana/grafana/pkg/setting"
)

const (
	AppURL   = "https://oauth.test/"
	TokenURL = AppURL + "oauth2/token"
)

var (
	pk, _         = rsa.GenerateKey(rand.Reader, 4096)
	Client1Key, _ = rsa.GenerateKey(rand.Reader, 4096)
)

type TestEnv struct {
	S           *OAuth2ServiceImpl
	Cfg         *setting.Cfg
	AcStore     *actest.MockStore
	OAuthStore  *oastest.MockStore
	UserService *usertest.FakeUserService
	TeamService *teamtest.FakeService
	SAService   *saTests.MockExtSvcAccountsService
}

func setupTestEnv(t *testing.T) *TestEnv {
	t.Helper()

	cfg := setting.NewCfg()
	cfg.AppURL = AppURL

	config := &fosite.Config{
		AccessTokenLifespan: time.Hour,
		TokenURL:            TokenURL,
		AccessTokenIssuer:   AppURL,
		IDTokenIssuer:       AppURL,
		ScopeStrategy:       fosite.WildcardScopeStrategy,
	}

	fmgt := featuremgmt.WithFeatures(featuremgmt.FlagExternalServiceAuth)

	env := &TestEnv{
		Cfg:         cfg,
		AcStore:     &actest.MockStore{},
		OAuthStore:  &oastest.MockStore{},
		UserService: usertest.NewUserServiceFake(),
		TeamService: teamtest.NewFakeService(),
		SAService:   saTests.NewMockExtSvcAccountsService(t),
	}
	env.S = &OAuth2ServiceImpl{
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
		publicKey:     &pk.PublicKey,
	}

	env.S.oauthProvider = newProvider(config, env.S, &signingkeystest.FakeSigningKeysService{
		ExpectedSinger: pk,
		ExpectedKeyID:  "default",
		ExpectedError:  nil,
	})

	return env
}

func TestOAuth2ServiceImpl_SaveExternalService(t *testing.T) {
	const serviceName = "my-ext-service"

	tests := []struct {
		name       string
		init       func(*TestEnv)
		cmd        *extsvcauth.ExternalServiceRegistration
		mockChecks func(*testing.T, *TestEnv)
		wantErr    bool
	}{
		{
			name: "should create a new client without permissions",
			init: func(env *TestEnv) {
				// No client at the beginning
				env.OAuthStore.On("GetExternalServiceByName", mock.Anything, mock.Anything).Return(nil, oauthserver.ErrClientNotFoundFn(serviceName))
				env.OAuthStore.On("SaveExternalService", mock.Anything, mock.Anything).Return(nil)

				// Return a service account ID
				env.SAService.On("ManageExtSvcAccount", mock.Anything, mock.Anything).Return(int64(0), nil)
			},
			cmd: &extsvcauth.ExternalServiceRegistration{
				Name:             serviceName,
				OAuthProviderCfg: &extsvcauth.OAuthProviderCfg{Key: &extsvcauth.KeyOption{Generate: true}},
			},
			mockChecks: func(t *testing.T, env *TestEnv) {
				env.OAuthStore.AssertCalled(t, "GetExternalServiceByName", mock.Anything, mock.MatchedBy(func(name string) bool {
					return name == serviceName
				}))
				env.OAuthStore.AssertCalled(t, "SaveExternalService", mock.Anything, mock.MatchedBy(func(client *oauthserver.OAuthExternalService) bool {
					return client.Name == serviceName && client.ClientID != "" && client.Secret != "" &&
						len(client.GrantTypes) == 0 && len(client.PublicPem) > 0 && client.ServiceAccountID == 0 &&
						len(client.ImpersonatePermissions) == 0
				}))
			},
		},
		{
			name: "should allow client credentials grant with correct permissions",
			init: func(env *TestEnv) {
				// No client at the beginning
				env.OAuthStore.On("GetExternalServiceByName", mock.Anything, mock.Anything).Return(nil, oauthserver.ErrClientNotFoundFn(serviceName))
				env.OAuthStore.On("SaveExternalService", mock.Anything, mock.Anything).Return(nil)

				// Return a service account ID
				env.SAService.On("ManageExtSvcAccount", mock.Anything, mock.Anything).Return(int64(10), nil)
			},
			cmd: &extsvcauth.ExternalServiceRegistration{
				Name: serviceName,
				Self: extsvcauth.SelfCfg{
					Enabled:     true,
					Permissions: []ac.Permission{{Action: ac.ActionUsersRead, Scope: ac.ScopeUsersAll}},
				},
				OAuthProviderCfg: &extsvcauth.OAuthProviderCfg{Key: &extsvcauth.KeyOption{Generate: true}},
			},
			mockChecks: func(t *testing.T, env *TestEnv) {
				env.OAuthStore.AssertCalled(t, "GetExternalServiceByName", mock.Anything, mock.MatchedBy(func(name string) bool {
					return name == serviceName
				}))
				env.OAuthStore.AssertCalled(t, "SaveExternalService", mock.Anything, mock.MatchedBy(func(client *oauthserver.OAuthExternalService) bool {
					return client.Name == serviceName && len(client.ClientID) > 0 && len(client.Secret) > 0 &&
						client.GrantTypes == string(fosite.GrantTypeClientCredentials) &&
						len(client.PublicPem) > 0 && client.ServiceAccountID == 10 &&
						len(client.ImpersonatePermissions) == 0 &&
						len(client.SelfPermissions) > 0
				}))
				// Check that despite no credential_grants the service account still has a permission to impersonate users
				env.SAService.AssertCalled(t, "ManageExtSvcAccount", mock.Anything,
					mock.MatchedBy(func(cmd *sa.ManageExtSvcAccountCmd) bool {
						return len(cmd.Permissions) == 1 && cmd.Permissions[0] == ac.Permission{Action: ac.ActionUsersRead, Scope: ac.ScopeUsersAll}
					}))
			},
		},
		{
			name: "should allow jwt bearer grant and set default permissions",
			init: func(env *TestEnv) {
				// No client at the beginning
				env.OAuthStore.On("GetExternalServiceByName", mock.Anything, mock.Anything).Return(nil, oauthserver.ErrClientNotFoundFn(serviceName))
				env.OAuthStore.On("SaveExternalService", mock.Anything, mock.Anything).Return(nil)
				// The service account needs to be created with a permission to impersonate users
				env.SAService.On("ManageExtSvcAccount", mock.Anything, mock.Anything).Return(int64(10), nil)
			},
			cmd: &extsvcauth.ExternalServiceRegistration{
				Name:             serviceName,
				OAuthProviderCfg: &extsvcauth.OAuthProviderCfg{Key: &extsvcauth.KeyOption{Generate: true}},
				Impersonation: extsvcauth.ImpersonationCfg{
					Enabled:     true,
					Groups:      true,
					Permissions: []ac.Permission{{Action: "dashboards:read", Scope: "dashboards:*"}},
				},
			},
			mockChecks: func(t *testing.T, env *TestEnv) {
				// Check that the external service impersonate permissions contains the default permissions required to populate the access token
				env.OAuthStore.AssertCalled(t, "SaveExternalService", mock.Anything, mock.MatchedBy(func(client *oauthserver.OAuthExternalService) bool {
					impPerm := client.ImpersonatePermissions
					return slices.Contains(impPerm, ac.Permission{Action: "dashboards:read", Scope: "dashboards:*"}) &&
						slices.Contains(impPerm, ac.Permission{Action: ac.ActionUsersRead, Scope: oauthserver.ScopeGlobalUsersSelf}) &&
						slices.Contains(impPerm, ac.Permission{Action: ac.ActionUsersPermissionsRead, Scope: oauthserver.ScopeUsersSelf}) &&
						slices.Contains(impPerm, ac.Permission{Action: ac.ActionTeamsRead, Scope: oauthserver.ScopeTeamsSelf})
				}))
				// Check that despite no credential_grants the service account still has a permission to impersonate users
				env.SAService.AssertCalled(t, "ManageExtSvcAccount", mock.Anything,
					mock.MatchedBy(func(cmd *sa.ManageExtSvcAccountCmd) bool {
						return len(cmd.Permissions) == 1 && cmd.Permissions[0] == ac.Permission{Action: ac.ActionUsersImpersonate, Scope: ac.ScopeUsersAll}
					}))
			},
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			env := setupTestEnv(t)
			if tt.init != nil {
				tt.init(env)
			}

			dto, err := env.S.SaveExternalService(context.Background(), tt.cmd)
			if tt.wantErr {
				require.Error(t, err)
				return
			}
			require.NoError(t, err)

			// Check that we generated client ID and secret
			require.NotEmpty(t, dto.ID)
			require.NotEmpty(t, dto.Secret)

			// Check that we have generated keys and that we correctly return them
			if tt.cmd.OAuthProviderCfg.Key != nil && tt.cmd.OAuthProviderCfg.Key.Generate {
				require.NotNil(t, dto.OAuthExtra.KeyResult)
				require.True(t, dto.OAuthExtra.KeyResult.Generated)
				require.NotEmpty(t, dto.OAuthExtra.KeyResult.PublicPem)
				require.NotEmpty(t, dto.OAuthExtra.KeyResult.PrivatePem)
			}

			// Check that we computed grant types and created or updated the service account
			if tt.cmd.Self.Enabled {
				require.NotNil(t, dto.OAuthExtra.GrantTypes)
				require.Contains(t, dto.OAuthExtra.GrantTypes, fosite.GrantTypeClientCredentials, "grant types should contain client_credentials")
			} else {
				require.NotContains(t, dto.OAuthExtra.GrantTypes, fosite.GrantTypeClientCredentials, "grant types should not contain client_credentials")
			}
			// Check that we updated grant types
			if tt.cmd.Impersonation.Enabled {
				require.NotNil(t, dto.OAuthExtra.GrantTypes)
				require.Contains(t, dto.OAuthExtra.GrantTypes, fosite.GrantTypeJWTBearer, "grant types should contain JWT Bearer grant")
			} else {
				require.NotContains(t, dto.OAuthExtra.GrantTypes, fosite.GrantTypeJWTBearer, "grant types should not contain JWT Bearer grant")
			}

			// Check that mocks were called as expected
			env.OAuthStore.AssertExpectations(t)
			env.SAService.AssertExpectations(t)
			env.AcStore.AssertExpectations(t)

			// Additional checks performed
			if tt.mockChecks != nil {
				tt.mockChecks(t, env)
			}
		})
	}
}

func TestOAuth2ServiceImpl_GetExternalService(t *testing.T) {
	const serviceName = "my-ext-service"

	dummyClient := func() *oauthserver.OAuthExternalService {
		return &oauthserver.OAuthExternalService{
			Name:             serviceName,
			ClientID:         "RANDOMID",
			Secret:           "RANDOMSECRET",
			GrantTypes:       "client_credentials",
			PublicPem:        []byte("-----BEGIN PUBLIC KEY-----"),
			ServiceAccountID: 1,
		}
	}
	cachedClient := &oauthserver.OAuthExternalService{
		Name:             serviceName,
		ClientID:         "RANDOMID",
		Secret:           "RANDOMSECRET",
		GrantTypes:       "client_credentials",
		PublicPem:        []byte("-----BEGIN PUBLIC KEY-----"),
		ServiceAccountID: 1,
		SelfPermissions:  []ac.Permission{{Action: "users:impersonate", Scope: "users:*"}},
		SignedInUser: &user.SignedInUser{
			UserID: 1,
			Permissions: map[int64]map[string][]string{
				1: {
					"users:impersonate": {"users:*"},
				},
			},
		},
	}
	testCases := []struct {
		name       string
		init       func(*TestEnv)
		mockChecks func(*testing.T, *TestEnv)
		wantPerm   []ac.Permission
		wantErr    bool
	}{
		{
			name: "should hit the cache",
			init: func(env *TestEnv) {
				env.S.cache.Set(serviceName, *cachedClient, time.Minute)
			},
			mockChecks: func(t *testing.T, env *TestEnv) {
				env.OAuthStore.AssertNotCalled(t, "GetExternalService", mock.Anything, mock.Anything)
			},
			wantPerm: []ac.Permission{{Action: "users:impersonate", Scope: "users:*"}},
		},
		{
			name: "should return error when the client was not found",
			init: func(env *TestEnv) {
				env.OAuthStore.On("GetExternalService", mock.Anything, mock.Anything).Return(nil, oauthserver.ErrClientNotFoundFn(serviceName))
			},
			wantErr: true,
		},
		{
			name: "should return error when the service account was not found",
			init: func(env *TestEnv) {
				env.OAuthStore.On("GetExternalService", mock.Anything, mock.Anything).Return(dummyClient(), nil)
				env.SAService.On("RetrieveExtSvcAccount", mock.Anything, int64(1), int64(1)).Return(&sa.ExtSvcAccount{}, sa.ErrServiceAccountNotFound)
			},
			mockChecks: func(t *testing.T, env *TestEnv) {
				env.OAuthStore.AssertCalled(t, "GetExternalService", mock.Anything, mock.Anything)
				env.SAService.AssertCalled(t, "RetrieveExtSvcAccount", mock.Anything, 1, 1)
			},
			wantErr: true,
		},
		{
			name: "should return error when the service account has no permissions",
			init: func(env *TestEnv) {
				env.OAuthStore.On("GetExternalService", mock.Anything, mock.Anything).Return(dummyClient(), nil)
				env.SAService.On("RetrieveExtSvcAccount", mock.Anything, int64(1), int64(1)).Return(&sa.ExtSvcAccount{}, nil)
				env.AcStore.On("GetUserPermissions", mock.Anything, mock.Anything).Return(nil, fmt.Errorf("some error"))
			},
			mockChecks: func(t *testing.T, env *TestEnv) {
				env.OAuthStore.AssertCalled(t, "GetExternalService", mock.Anything, mock.Anything)
				env.SAService.AssertCalled(t, "RetrieveExtSvcAccount", mock.Anything, 1, 1)
			},
			wantErr: true,
		},
		{
			name: "should return correctly",
			init: func(env *TestEnv) {
				env.OAuthStore.On("GetExternalService", mock.Anything, mock.Anything).Return(dummyClient(), nil)
				env.SAService.On("RetrieveExtSvcAccount", mock.Anything, int64(1), int64(1)).Return(&sa.ExtSvcAccount{ID: 1}, nil)
				env.AcStore.On("GetUserPermissions", mock.Anything, mock.Anything).Return([]ac.Permission{{Action: ac.ActionUsersImpersonate, Scope: ac.ScopeUsersAll}}, nil)
			},
			mockChecks: func(t *testing.T, env *TestEnv) {
				env.OAuthStore.AssertCalled(t, "GetExternalService", mock.Anything, mock.Anything)
				env.SAService.AssertCalled(t, "RetrieveExtSvcAccount", mock.Anything, int64(1), int64(1))
			},
			wantPerm: []ac.Permission{{Action: "users:impersonate", Scope: "users:*"}},
		},
		{
			name: "should return correctly when the client has no service account",
			init: func(env *TestEnv) {
				client := &oauthserver.OAuthExternalService{
					Name:             serviceName,
					ClientID:         "RANDOMID",
					Secret:           "RANDOMSECRET",
					GrantTypes:       "client_credentials",
					PublicPem:        []byte("-----BEGIN PUBLIC KEY-----"),
					ServiceAccountID: oauthserver.NoServiceAccountID,
				}
				env.OAuthStore.On("GetExternalService", mock.Anything, mock.Anything).Return(client, nil)
			},
			mockChecks: func(t *testing.T, env *TestEnv) {
				env.OAuthStore.AssertCalled(t, "GetExternalService", mock.Anything, mock.Anything)
			},
			wantPerm: []ac.Permission{},
		},
	}
	for _, tt := range testCases {
		t.Run(tt.name, func(t *testing.T) {
			env := setupTestEnv(t)
			if tt.init != nil {
				tt.init(env)
			}

			client, err := env.S.GetExternalService(context.Background(), serviceName)
			if tt.wantErr {
				require.Error(t, err)
				return
			}
			require.NoError(t, err)

			if tt.mockChecks != nil {
				tt.mockChecks(t, env)
			}

			require.Equal(t, serviceName, client.Name)
			require.ElementsMatch(t, client.SelfPermissions, tt.wantPerm)
			assertArrayInMap(t, client.SignedInUser.Permissions[1], ac.GroupScopesByAction(tt.wantPerm))

			env.OAuthStore.AssertExpectations(t)
			env.SAService.AssertExpectations(t)
		})
	}
}

func assertArrayInMap[K comparable, V string](t *testing.T, m1 map[K][]V, m2 map[K][]V) {
	for k, v := range m1 {
		require.Contains(t, m2, k)
		require.ElementsMatch(t, v, m2[k])
	}
}

func TestOAuth2ServiceImpl_RemoveExternalService(t *testing.T) {
	const serviceName = "my-ext-service"
	const clientID = "RANDOMID"

	dummyClient := &oauthserver.OAuthExternalService{
		Name:             serviceName,
		ClientID:         clientID,
		ServiceAccountID: 1,
	}

	testCases := []struct {
		name string
		init func(*TestEnv)
	}{
		{
			name: "should do nothing on not found",
			init: func(env *TestEnv) {
				env.OAuthStore.On("GetExternalServiceByName", mock.Anything, serviceName).Return(nil, oauthserver.ErrClientNotFoundFn(serviceName))
			},
		},
		{
			name: "should remove the external service and its associated service account",
			init: func(env *TestEnv) {
				env.OAuthStore.On("GetExternalServiceByName", mock.Anything, serviceName).Return(dummyClient, nil)
				env.OAuthStore.On("DeleteExternalService", mock.Anything, clientID).Return(nil)
				env.SAService.On("RemoveExtSvcAccount", mock.Anything, oauthserver.TmpOrgID, serviceName).Return(nil)
			},
		},
	}
	for _, tt := range testCases {
		t.Run(tt.name, func(t *testing.T) {
			env := setupTestEnv(t)
			if tt.init != nil {
				tt.init(env)
			}

			err := env.S.RemoveExternalService(context.Background(), serviceName)
			require.NoError(t, err)

			env.OAuthStore.AssertExpectations(t)
			env.SAService.AssertExpectations(t)
		})
	}
}

func TestTestOAuth2ServiceImpl_handleKeyOptions(t *testing.T) {
	testCases := []struct {
		name           string
		keyOption      *extsvcauth.KeyOption
		expectedResult *extsvcauth.KeyResult
		wantErr        bool
	}{
		{
			name:    "should return error when the key option is nil",
			wantErr: true,
		},
		{
			name:      "should return error when the key option is empty",
			keyOption: &extsvcauth.KeyOption{},
			wantErr:   true,
		},
		{
			name: "should return successfully when PublicPEM is specified",
			keyOption: &extsvcauth.KeyOption{
				PublicPEM: base64.StdEncoding.EncodeToString([]byte(`-----BEGIN PUBLIC KEY-----
MFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAEbsGtoGJTopAIbhqy49/vyCJuDot+
mgGaC8vUIigFQVsVB+v/HZ4yG1Rcvysig+tyNk1dZQpozpFc2dGmzHlGhw==
-----END PUBLIC KEY-----`)),
			},
			wantErr: false,
			expectedResult: &extsvcauth.KeyResult{
				PublicPem: `-----BEGIN PUBLIC KEY-----
MFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAEbsGtoGJTopAIbhqy49/vyCJuDot+
mgGaC8vUIigFQVsVB+v/HZ4yG1Rcvysig+tyNk1dZQpozpFc2dGmzHlGhw==
-----END PUBLIC KEY-----`,
				Generated:  false,
				PrivatePem: "",
				URL:        "",
			},
		},
	}
	env := setupTestEnv(t)
	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			result, err := env.S.handleKeyOptions(context.Background(), tc.keyOption)
			if tc.wantErr {
				require.Error(t, err)
				return
			}
			require.NoError(t, err)
			require.Equal(t, tc.expectedResult, result)
		})
	}

	t.Run("should generate an ECDSA key pair (default) when generate key option is specified", func(t *testing.T) {
		result, err := env.S.handleKeyOptions(context.Background(), &extsvcauth.KeyOption{Generate: true})

		require.NoError(t, err)
		require.NotNil(t, result.PrivatePem)
		require.NotNil(t, result.PublicPem)
		require.True(t, result.Generated)
	})

	t.Run("should generate an RSA key pair when generate key option is specified", func(t *testing.T) {
		env.S.cfg.OAuth2ServerGeneratedKeyTypeForClient = "RSA"
		result, err := env.S.handleKeyOptions(context.Background(), &extsvcauth.KeyOption{Generate: true})

		require.NoError(t, err)
		require.NotNil(t, result.PrivatePem)
		require.NotNil(t, result.PublicPem)
		require.True(t, result.Generated)
	})
}

func TestOAuth2ServiceImpl_handlePluginStateChanged(t *testing.T) {
	pluginID := "my-app"
	clientID := "RANDOMID"
	impersonatePermission := []ac.Permission{{Action: ac.ActionUsersImpersonate, Scope: ac.ScopeUsersAll}}
	selfPermission := append(impersonatePermission, ac.Permission{Action: ac.ActionUsersRead, Scope: ac.ScopeUsersAll})
	saID := int64(101)
	client := &oauthserver.OAuthExternalService{
		ID:               11,
		Name:             pluginID,
		ClientID:         clientID,
		Secret:           "SECRET",
		ServiceAccountID: saID,
	}
	clientWithImpersonate := &oauthserver.OAuthExternalService{
		ID:       11,
		Name:     pluginID,
		ClientID: clientID,
		Secret:   "SECRET",
		ImpersonatePermissions: []ac.Permission{
			{Action: ac.ActionUsersRead, Scope: ac.ScopeUsersAll},
		},
		ServiceAccountID: saID,
	}
	extSvcAcc := &sa.ExtSvcAccount{
		ID:         saID,
		Login:      "sa-my-app",
		Name:       pluginID,
		OrgID:      extsvcauth.TmpOrgID,
		IsDisabled: false,
		Role:       org.RoleNone,
	}

	tests := []struct {
		name string
		init func(*TestEnv)
		cmd  *pluginsettings.PluginStateChangedEvent
	}{
		{
			name: "should do nothing with not found",
			init: func(te *TestEnv) {
				te.OAuthStore.On("GetExternalServiceByName", mock.Anything, "unknown").Return(nil, oauthserver.ErrClientNotFoundFn("unknown"))
			},
			cmd: &pluginsettings.PluginStateChangedEvent{PluginId: "unknown", OrgId: 1, Enabled: false},
		},
		{
			name: "should remove grants",
			init: func(te *TestEnv) {
				te.OAuthStore.On("GetExternalServiceByName", mock.Anything, pluginID).Return(clientWithImpersonate, nil)
				te.OAuthStore.On("UpdateExternalServiceGrantTypes", mock.Anything, clientID, "").Return(nil)
			},
			cmd: &pluginsettings.PluginStateChangedEvent{PluginId: pluginID, OrgId: 1, Enabled: false},
		},
		{
			name: "should set both grants",
			init: func(te *TestEnv) {
				te.OAuthStore.On("GetExternalServiceByName", mock.Anything, mock.Anything).Return(clientWithImpersonate, nil)
				te.SAService.On("RetrieveExtSvcAccount", mock.Anything, extsvcauth.TmpOrgID, saID).Return(extSvcAcc, nil)
				te.AcStore.On("GetUserPermissions", mock.Anything, mock.Anything, mock.Anything).Return(selfPermission, nil)
				te.OAuthStore.On("UpdateExternalServiceGrantTypes", mock.Anything, clientID,
					string(fosite.GrantTypeClientCredentials)+","+string(fosite.GrantTypeJWTBearer)).Return(nil)
			},
			cmd: &pluginsettings.PluginStateChangedEvent{PluginId: pluginID, OrgId: 1, Enabled: true},
		},
		{
			name: "should set impersonate grant",
			init: func(te *TestEnv) {
				te.OAuthStore.On("GetExternalServiceByName", mock.Anything, mock.Anything).Return(clientWithImpersonate, nil)
				te.SAService.On("RetrieveExtSvcAccount", mock.Anything, extsvcauth.TmpOrgID, saID).Return(extSvcAcc, nil)
				te.AcStore.On("GetUserPermissions", mock.Anything, mock.Anything, mock.Anything).Return(impersonatePermission, nil)
				te.OAuthStore.On("UpdateExternalServiceGrantTypes", mock.Anything, clientID, string(fosite.GrantTypeJWTBearer)).Return(nil)
			},
			cmd: &pluginsettings.PluginStateChangedEvent{PluginId: pluginID, OrgId: 1, Enabled: true},
		},
		{
			name: "should set client_credentials grant",
			init: func(te *TestEnv) {
				te.OAuthStore.On("GetExternalServiceByName", mock.Anything, mock.Anything).Return(client, nil)
				te.SAService.On("RetrieveExtSvcAccount", mock.Anything, extsvcauth.TmpOrgID, saID).Return(extSvcAcc, nil)
				te.AcStore.On("GetUserPermissions", mock.Anything, mock.Anything, mock.Anything).Return(selfPermission, nil)
				te.OAuthStore.On("UpdateExternalServiceGrantTypes", mock.Anything, clientID, string(fosite.GrantTypeClientCredentials)).Return(nil)
			},
			cmd: &pluginsettings.PluginStateChangedEvent{PluginId: pluginID, OrgId: 1, Enabled: true},
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			env := setupTestEnv(t)
			if tt.init != nil {
				tt.init(env)
			}

			err := env.S.handlePluginStateChanged(context.Background(), tt.cmd)
			require.NoError(t, err)

			// Check that mocks were called as expected
			env.OAuthStore.AssertExpectations(t)
			env.SAService.AssertExpectations(t)
			env.AcStore.AssertExpectations(t)
		})
	}
}
