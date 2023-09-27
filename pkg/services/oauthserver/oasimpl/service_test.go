package oasimpl

import (
	"context"
	"crypto/rand"
	"crypto/rsa"
	"encoding/base64"
	"fmt"
	"testing"
	"time"

	"github.com/ory/fosite"
	"github.com/ory/fosite/storage"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"
	"golang.org/x/exp/slices"

	"github.com/grafana/grafana/pkg/infra/localcache"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/models/roletype"
	ac "github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/accesscontrol/acimpl"
	"github.com/grafana/grafana/pkg/services/accesscontrol/actest"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/oauthserver"
	"github.com/grafana/grafana/pkg/services/oauthserver/oastest"
	sa "github.com/grafana/grafana/pkg/services/serviceaccounts"
	satests "github.com/grafana/grafana/pkg/services/serviceaccounts/tests"
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
	SAService   *satests.MockServiceAccountService
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
		SAService:   &satests.MockServiceAccountService{},
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
	env.S.oauthProvider = newProvider(config, env.S, pk)

	return env
}

func TestOAuth2ServiceImpl_SaveExternalService(t *testing.T) {
	const serviceName = "my-ext-service"

	sa1 := sa.ServiceAccountDTO{Id: 1, Name: serviceName, Login: serviceName, OrgId: oauthserver.TmpOrgID, IsDisabled: false, Role: "Viewer"}
	sa1Profile := sa.ServiceAccountProfileDTO{Id: 1, Name: serviceName, Login: serviceName, OrgId: oauthserver.TmpOrgID, IsDisabled: false, Role: "Viewer"}
	prevSaID := int64(3)
	// Using a function to prevent modifying the same object in the tests
	client1 := func() *oauthserver.ExternalService {
		return &oauthserver.ExternalService{
			Name:             serviceName,
			ClientID:         "RANDOMID",
			Secret:           "RANDOMSECRET",
			GrantTypes:       "client_credentials",
			PublicPem:        []byte("-----BEGIN PUBLIC KEY-----"),
			ServiceAccountID: prevSaID,
			SelfPermissions:  []ac.Permission{{Action: "users:impersonate", Scope: "users:*"}},
		}
	}

	tests := []struct {
		name       string
		init       func(*TestEnv)
		cmd        *oauthserver.ExternalServiceRegistration
		mockChecks func(*testing.T, *TestEnv)
		wantErr    bool
	}{
		{
			name: "should create a new client without permissions",
			init: func(env *TestEnv) {
				// No client at the beginning
				env.OAuthStore.On("GetExternalServiceByName", mock.Anything, mock.Anything).Return(nil, oauthserver.ErrClientNotFound(serviceName))
				env.OAuthStore.On("SaveExternalService", mock.Anything, mock.Anything).Return(nil)
			},
			cmd: &oauthserver.ExternalServiceRegistration{
				Name: serviceName,
				Key:  &oauthserver.KeyOption{Generate: true},
			},
			mockChecks: func(t *testing.T, env *TestEnv) {
				env.OAuthStore.AssertCalled(t, "GetExternalServiceByName", mock.Anything, mock.MatchedBy(func(name string) bool {
					return name == serviceName
				}))
				env.OAuthStore.AssertCalled(t, "SaveExternalService", mock.Anything, mock.MatchedBy(func(client *oauthserver.ExternalService) bool {
					return client.Name == serviceName && client.ClientID != "" && client.Secret != "" &&
						len(client.GrantTypes) == 0 && len(client.PublicPem) > 0 && client.ServiceAccountID == 0 &&
						len(client.ImpersonatePermissions) == 0
				}))
			},
		},
		{
			name: "should create a service account",
			init: func(env *TestEnv) {
				// No client at the beginning
				env.OAuthStore.On("GetExternalServiceByName", mock.Anything, mock.Anything).Return(nil, oauthserver.ErrClientNotFound(serviceName))
				env.OAuthStore.On("SaveExternalService", mock.Anything, mock.Anything).Return(nil)
				// Service account and permission creation
				env.SAService.On("CreateServiceAccount", mock.Anything, mock.Anything, mock.Anything).Return(&sa1, nil)
				env.AcStore.On("SaveExternalServiceRole", mock.Anything, mock.Anything).Return(nil)
			},
			cmd: &oauthserver.ExternalServiceRegistration{
				Name: serviceName,
				Key:  &oauthserver.KeyOption{Generate: true},
				Self: oauthserver.SelfCfg{
					Enabled:     true,
					Permissions: []ac.Permission{{Action: "users:read", Scope: "users:*"}},
				},
			},
			mockChecks: func(t *testing.T, env *TestEnv) {
				// Check that the client has a service account and the correct grant type
				env.OAuthStore.AssertCalled(t, "SaveExternalService", mock.Anything, mock.MatchedBy(func(client *oauthserver.ExternalService) bool {
					return client.Name == serviceName &&
						client.GrantTypes == "client_credentials" && client.ServiceAccountID == sa1.Id
				}))
				// Check that the service account is created in the correct org with the correct role
				env.SAService.AssertCalled(t, "CreateServiceAccount", mock.Anything,
					mock.MatchedBy(func(orgID int64) bool { return orgID == oauthserver.TmpOrgID }),
					mock.MatchedBy(func(cmd *sa.CreateServiceAccountForm) bool {
						return cmd.Name == serviceName && *cmd.Role == roletype.RoleViewer
					}),
				)
			},
		},
		{
			name: "should delete the service account",
			init: func(env *TestEnv) {
				// Existing client (with a service account hence a role)
				env.OAuthStore.On("GetExternalServiceByName", mock.Anything, mock.Anything).Return(client1(), nil)
				env.OAuthStore.On("SaveExternalService", mock.Anything, mock.Anything).Return(nil)
				env.SAService.On("RetrieveServiceAccount", mock.Anything, mock.Anything, mock.Anything).Return(&sa1Profile, nil)
				// No permission anymore will trigger deletion of the service account and its role
				env.SAService.On("DeleteServiceAccount", mock.Anything, mock.Anything, mock.Anything).Return(nil)
				env.AcStore.On("DeleteExternalServiceRole", mock.Anything, mock.Anything).Return(nil)
			},
			cmd: &oauthserver.ExternalServiceRegistration{
				Name: serviceName,
				Key:  &oauthserver.KeyOption{Generate: true},
				Self: oauthserver.SelfCfg{
					Enabled: false,
				},
			},
			mockChecks: func(t *testing.T, env *TestEnv) {
				// Check that the service has no service account anymore
				env.OAuthStore.AssertCalled(t, "SaveExternalService", mock.Anything, mock.MatchedBy(func(client *oauthserver.ExternalService) bool {
					return client.Name == serviceName && client.ServiceAccountID == oauthserver.NoServiceAccountID
				}))
				// Check that the service account is retrieved with the correct ID
				env.SAService.AssertCalled(t, "RetrieveServiceAccount", mock.Anything,
					mock.MatchedBy(func(orgID int64) bool { return orgID == oauthserver.TmpOrgID }),
					mock.MatchedBy(func(saID int64) bool { return saID == prevSaID }))
				// Check that the service account is deleted in the correct org
				env.SAService.AssertCalled(t, "DeleteServiceAccount", mock.Anything,
					mock.MatchedBy(func(orgID int64) bool { return orgID == oauthserver.TmpOrgID }),
					mock.MatchedBy(func(saID int64) bool { return saID == sa1.Id }))
				// Check that the associated role is deleted
				env.AcStore.AssertCalled(t, "DeleteExternalServiceRole", mock.Anything,
					mock.MatchedBy(func(extSvcName string) bool { return extSvcName == serviceName }))
			},
		},
		{
			name: "should update the service account",
			init: func(env *TestEnv) {
				// Existing client (with a service account hence a role)
				env.OAuthStore.On("GetExternalServiceByName", mock.Anything, mock.Anything).Return(client1(), nil)
				env.OAuthStore.On("SaveExternalService", mock.Anything, mock.Anything).Return(nil)
				env.SAService.On("RetrieveServiceAccount", mock.Anything, mock.Anything, mock.Anything).Return(&sa1Profile, nil)
				// Update the service account permissions
				env.AcStore.On("SaveExternalServiceRole", mock.Anything, mock.Anything).Return(nil)
			},
			cmd: &oauthserver.ExternalServiceRegistration{
				Name: serviceName,
				Key:  &oauthserver.KeyOption{Generate: true},
				Self: oauthserver.SelfCfg{
					Enabled:     true,
					Permissions: []ac.Permission{{Action: "dashboards:create", Scope: "folders:uid:general"}},
				},
			},
			mockChecks: func(t *testing.T, env *TestEnv) {
				// Ensure new permissions are in place
				env.AcStore.AssertCalled(t, "SaveExternalServiceRole", mock.Anything,
					mock.MatchedBy(func(cmd ac.SaveExternalServiceRoleCommand) bool {
						return cmd.ServiceAccountID == sa1.Id && cmd.ExternalServiceID == client1().Name &&
							cmd.OrgID == int64(ac.GlobalOrgID) && len(cmd.Permissions) == 1 &&
							cmd.Permissions[0] == ac.Permission{Action: "dashboards:create", Scope: "folders:uid:general"}
					}))
			},
		},
		{
			name: "should allow jwt bearer grant and set default permissions",
			init: func(env *TestEnv) {
				// No client at the beginning
				env.OAuthStore.On("GetExternalServiceByName", mock.Anything, mock.Anything).Return(nil, oauthserver.ErrClientNotFound(serviceName))
				env.OAuthStore.On("SaveExternalService", mock.Anything, mock.Anything).Return(nil)
				// The service account needs to be created with a permission to impersonate users
				env.SAService.On("CreateServiceAccount", mock.Anything, mock.Anything, mock.Anything).Return(&sa1, nil)
				env.AcStore.On("SaveExternalServiceRole", mock.Anything, mock.Anything).Return(nil)
			},
			cmd: &oauthserver.ExternalServiceRegistration{
				Name: serviceName,
				Key:  &oauthserver.KeyOption{Generate: true},
				Impersonation: oauthserver.ImpersonationCfg{
					Enabled:     true,
					Groups:      true,
					Permissions: []ac.Permission{{Action: "dashboards:read", Scope: "dashboards:*"}},
				},
			},
			mockChecks: func(t *testing.T, env *TestEnv) {
				// Check that the external service impersonate permissions contains the default permissions required to populate the access token
				env.OAuthStore.AssertCalled(t, "SaveExternalService", mock.Anything, mock.MatchedBy(func(client *oauthserver.ExternalService) bool {
					impPerm := client.ImpersonatePermissions
					return slices.Contains(impPerm, ac.Permission{Action: "dashboards:read", Scope: "dashboards:*"}) &&
						slices.Contains(impPerm, ac.Permission{Action: ac.ActionUsersRead, Scope: oauthserver.ScopeGlobalUsersSelf}) &&
						slices.Contains(impPerm, ac.Permission{Action: ac.ActionUsersPermissionsRead, Scope: oauthserver.ScopeUsersSelf}) &&
						slices.Contains(impPerm, ac.Permission{Action: ac.ActionTeamsRead, Scope: oauthserver.ScopeTeamsSelf})
				}))
				// Check that despite no credential_grants the service account still has a permission to impersonate users
				env.AcStore.AssertCalled(t, "SaveExternalServiceRole", mock.Anything,
					mock.MatchedBy(func(cmd ac.SaveExternalServiceRoleCommand) bool {
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
			if tt.cmd.Key != nil && tt.cmd.Key.Generate {
				require.NotNil(t, dto.KeyResult)
				require.True(t, dto.KeyResult.Generated)
				require.NotEmpty(t, dto.KeyResult.PublicPem)
				require.NotEmpty(t, dto.KeyResult.PrivatePem)
			}

			// Check that we computed grant types and created or updated the service account
			if tt.cmd.Self.Enabled {
				require.NotNil(t, dto.GrantTypes)
				require.Contains(t, dto.GrantTypes, fosite.GrantTypeClientCredentials, "grant types should contain client_credentials")
			} else {
				require.NotContains(t, dto.GrantTypes, fosite.GrantTypeClientCredentials, "grant types should not contain client_credentials")
			}
			// Check that we updated grant types
			if tt.cmd.Impersonation.Enabled {
				require.NotNil(t, dto.GrantTypes)
				require.Contains(t, dto.GrantTypes, fosite.GrantTypeJWTBearer, "grant types should contain JWT Bearer grant")
			} else {
				require.NotContains(t, dto.GrantTypes, fosite.GrantTypeJWTBearer, "grant types should not contain JWT Bearer grant")
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

	dummyClient := func() *oauthserver.ExternalService {
		return &oauthserver.ExternalService{
			Name:             serviceName,
			ClientID:         "RANDOMID",
			Secret:           "RANDOMSECRET",
			GrantTypes:       "client_credentials",
			PublicPem:        []byte("-----BEGIN PUBLIC KEY-----"),
			ServiceAccountID: 1,
		}
	}
	cachedClient := &oauthserver.ExternalService{
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
				env.OAuthStore.On("GetExternalService", mock.Anything, mock.Anything).Return(nil, oauthserver.ErrClientNotFound(serviceName))
			},
			wantErr: true,
		},
		{
			name: "should return error when the service account was not found",
			init: func(env *TestEnv) {
				env.OAuthStore.On("GetExternalService", mock.Anything, mock.Anything).Return(dummyClient(), nil)
				env.SAService.On("RetrieveServiceAccount", mock.Anything, int64(1), int64(1)).Return(&sa.ServiceAccountProfileDTO{}, sa.ErrServiceAccountNotFound)
			},
			mockChecks: func(t *testing.T, env *TestEnv) {
				env.OAuthStore.AssertCalled(t, "GetExternalService", mock.Anything, mock.Anything)
				env.SAService.AssertCalled(t, "RetrieveServiceAccount", mock.Anything, 1, 1)
			},
			wantErr: true,
		},
		{
			name: "should return error when the service account has no permissions",
			init: func(env *TestEnv) {
				env.OAuthStore.On("GetExternalService", mock.Anything, mock.Anything).Return(dummyClient(), nil)
				env.SAService.On("RetrieveServiceAccount", mock.Anything, int64(1), int64(1)).Return(&sa.ServiceAccountProfileDTO{}, nil)
				env.AcStore.On("GetUserPermissions", mock.Anything, mock.Anything).Return(nil, fmt.Errorf("some error"))
			},
			mockChecks: func(t *testing.T, env *TestEnv) {
				env.OAuthStore.AssertCalled(t, "GetExternalService", mock.Anything, mock.Anything)
				env.SAService.AssertCalled(t, "RetrieveServiceAccount", mock.Anything, 1, 1)
			},
			wantErr: true,
		},
		{
			name: "should return correctly",
			init: func(env *TestEnv) {
				env.OAuthStore.On("GetExternalService", mock.Anything, mock.Anything).Return(dummyClient(), nil)
				env.SAService.On("RetrieveServiceAccount", mock.Anything, int64(1), int64(1)).Return(&sa.ServiceAccountProfileDTO{Id: 1}, nil)
				env.AcStore.On("GetUserPermissions", mock.Anything, mock.Anything).Return([]ac.Permission{{Action: ac.ActionUsersImpersonate, Scope: ac.ScopeUsersAll}}, nil)
			},
			mockChecks: func(t *testing.T, env *TestEnv) {
				env.OAuthStore.AssertCalled(t, "GetExternalService", mock.Anything, mock.Anything)
				env.SAService.AssertCalled(t, "RetrieveServiceAccount", mock.Anything, int64(1), int64(1))
			},
			wantPerm: []ac.Permission{{Action: "users:impersonate", Scope: "users:*"}},
		},
		{
			name: "should return correctly when the client has no service account",
			init: func(env *TestEnv) {
				client := &oauthserver.ExternalService{
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

func TestTestOAuth2ServiceImpl_handleKeyOptions(t *testing.T) {
	testCases := []struct {
		name           string
		keyOption      *oauthserver.KeyOption
		expectedResult *oauthserver.KeyResult
		wantErr        bool
	}{
		{
			name:    "should return error when the key option is nil",
			wantErr: true,
		},
		{
			name:      "should return error when the key option is empty",
			keyOption: &oauthserver.KeyOption{},
			wantErr:   true,
		},
		{
			name: "should return successfully when PublicPEM is specified",
			keyOption: &oauthserver.KeyOption{
				PublicPEM: base64.StdEncoding.EncodeToString([]byte(`-----BEGIN PUBLIC KEY-----
MFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAEbsGtoGJTopAIbhqy49/vyCJuDot+
mgGaC8vUIigFQVsVB+v/HZ4yG1Rcvysig+tyNk1dZQpozpFc2dGmzHlGhw==
-----END PUBLIC KEY-----`)),
			},
			wantErr: false,
			expectedResult: &oauthserver.KeyResult{
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
		result, err := env.S.handleKeyOptions(context.Background(), &oauthserver.KeyOption{Generate: true})

		require.NoError(t, err)
		require.NotNil(t, result.PrivatePem)
		require.NotNil(t, result.PublicPem)
		require.True(t, result.Generated)
	})

	t.Run("should generate an RSA key pair when generate key option is specified", func(t *testing.T) {
		env.S.cfg.OAuth2ServerGeneratedKeyTypeForClient = "RSA"
		result, err := env.S.handleKeyOptions(context.Background(), &oauthserver.KeyOption{Generate: true})

		require.NoError(t, err)
		require.NotNil(t, result.PrivatePem)
		require.NotNil(t, result.PublicPem)
		require.True(t, result.Generated)
	})
}
