package oauthimpl

import (
	"context"
	"crypto/rand"
	"crypto/rsa"
	"testing"
	"time"

	"github.com/ory/fosite"
	"github.com/ory/fosite/storage"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/infra/localcache"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/models/roletype"
	ac "github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/accesscontrol/acimpl"
	"github.com/grafana/grafana/pkg/services/accesscontrol/actest"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/oauthserver"
	"github.com/grafana/grafana/pkg/services/oauthserver/oauthtest"
	sa "github.com/grafana/grafana/pkg/services/serviceaccounts"
	satests "github.com/grafana/grafana/pkg/services/serviceaccounts/tests"
	"github.com/grafana/grafana/pkg/services/team/teamtest"
	"github.com/grafana/grafana/pkg/services/user/usertest"
	"github.com/grafana/grafana/pkg/setting"
)

type TestEnv struct {
	S           *OAuth2ServiceImpl
	Cfg         *setting.Cfg
	AcStore     *actest.FakeStore
	OAuthStore  *oauthtest.MockStore
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
		OAuthStore:  &oauthtest.MockStore{},
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

func TestOAuth2ServiceImpl_SaveExternalService(t *testing.T) {
	sa1 := sa.ServiceAccountDTO{Id: 1, Name: "my-ext-service", Login: "my-ext-service", OrgId: oauthserver.TmpOrgID, IsDisabled: false, Role: "Viewer"}
	sa1Profile := sa.ServiceAccountProfileDTO{Id: 1, Name: "my-ext-service", Login: "my-ext-service", OrgId: oauthserver.TmpOrgID, IsDisabled: false, Role: "Viewer"}
	prevSaID := int64(3)
	// Using a function to prevent modifying the same object in the tests
	client1 := func() *oauthserver.Client {
		return &oauthserver.Client{
			ExternalServiceName: "my-ext-service",
			ClientID:            "RANDOMID",
			Secret:              "RANDOMSECRET",
			GrantTypes:          "client_credentials",
			PublicPem:           []byte("-----BEGIN PUBLIC KEY-----"),
			ServiceAccountID:    prevSaID,
			SelfPermissions:     []ac.Permission{{Action: "users:impersonate", Scope: "users:*"}},
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
				env.OAuthStore.On("GetExternalServiceByName", mock.Anything, mock.Anything).Return(nil, oauthserver.ErrClientNotFound("my-ext-service"))
				env.OAuthStore.On("SaveExternalService", mock.Anything, mock.Anything).Return(nil)
			},
			cmd: &oauthserver.ExternalServiceRegistration{
				ExternalServiceName: "my-ext-service",
				Key:                 &oauthserver.KeyOption{Generate: true},
			},
			mockChecks: func(t *testing.T, env *TestEnv) {
				env.OAuthStore.AssertCalled(t, "GetExternalServiceByName", mock.Anything, mock.MatchedBy(func(name string) bool {
					return name == "my-ext-service"
				}))
				env.OAuthStore.AssertCalled(t, "SaveExternalService", mock.Anything, mock.MatchedBy(func(client *oauthserver.Client) bool {
					ok := client.ExternalServiceName == "my-ext-service"
					ok = ok && client.ClientID != ""
					ok = ok && client.Secret != ""
					ok = ok && len(client.GrantTypes) == 0
					ok = ok && len(client.PublicPem) > 0
					ok = ok && client.ServiceAccountID == 0
					ok = ok && len(client.ImpersonatePermissions) == 0
					return ok
				}))
			},
		},
		{
			name: "should create a service account",
			init: func(env *TestEnv) {
				env.OAuthStore.On("GetExternalServiceByName", mock.Anything, mock.Anything).Return(nil, oauthserver.ErrClientNotFound("my-ext-service"))
				env.OAuthStore.On("SaveExternalService", mock.Anything, mock.Anything).Return(nil)
				env.SAService.On("CreateServiceAccount", mock.Anything, mock.Anything, mock.Anything).Return(&sa1, nil)
			},
			cmd: &oauthserver.ExternalServiceRegistration{
				ExternalServiceName: "my-ext-service",
				Key:                 &oauthserver.KeyOption{Generate: true},
				Permissions:         []ac.Permission{{Action: "users:read", Scope: "users:*"}},
			},
			mockChecks: func(t *testing.T, env *TestEnv) {
				// Check that the client has a service account and the correct grant type
				env.OAuthStore.AssertCalled(t, "SaveExternalService", mock.Anything, mock.MatchedBy(func(client *oauthserver.Client) bool {
					return client.ExternalServiceName == "my-ext-service" &&
						client.GrantTypes == "client_credentials" && client.ServiceAccountID == sa1.Id
				}))
				// Check that the service account is created in the correct org with the correct role
				env.SAService.AssertCalled(t, "CreateServiceAccount", mock.Anything,
					mock.MatchedBy(func(orgID int64) bool { return orgID == oauthserver.TmpOrgID }),
					mock.MatchedBy(func(cmd *sa.CreateServiceAccountForm) bool {
						return cmd.Name == "my-ext-service" && *cmd.Role == roletype.RoleViewer
					}),
				)
			},
		},
		{
			name: "should delete the service account",
			init: func(env *TestEnv) {
				env.OAuthStore.On("GetExternalServiceByName", mock.Anything, mock.Anything).Return(client1(), nil)
				env.OAuthStore.On("SaveExternalService", mock.Anything, mock.Anything).Return(nil)
				env.SAService.On("RetrieveServiceAccount", mock.Anything, mock.Anything, mock.Anything).Return(&sa1Profile, nil)
				env.SAService.On("DeleteServiceAccount", mock.Anything, mock.Anything, mock.Anything).Return(nil)
				// TODO also need to test the role has been deleted
			},
			cmd: &oauthserver.ExternalServiceRegistration{
				ExternalServiceName: "my-ext-service",
				Key:                 &oauthserver.KeyOption{Generate: true},
				Permissions:         []ac.Permission{},
			},
			mockChecks: func(t *testing.T, env *TestEnv) {
				// Check that the service has no service account anymore
				env.OAuthStore.AssertCalled(t, "SaveExternalService", mock.Anything, mock.MatchedBy(func(client *oauthserver.Client) bool {
					return client.ExternalServiceName == "my-ext-service" && client.ServiceAccountID == oauthserver.NoServiceAccountID
				}))
				// Check that the service account is retrieved with the correct ID
				env.SAService.AssertCalled(t, "RetrieveServiceAccount", mock.Anything,
					mock.MatchedBy(func(orgID int64) bool { return orgID == oauthserver.TmpOrgID }),
					mock.MatchedBy(func(saID int64) bool { return saID == prevSaID }))
				// Check that the service account is deleted in the correct org
				env.SAService.AssertCalled(t, "DeleteServiceAccount", mock.Anything,
					mock.MatchedBy(func(orgID int64) bool { return orgID == oauthserver.TmpOrgID }),
					mock.MatchedBy(func(saID int64) bool { return saID == sa1.Id }))
			},
		},
		{
			name: "should update the service account",
			init: func(env *TestEnv) {
				env.OAuthStore.On("GetExternalServiceByName", mock.Anything, mock.Anything).Return(client1(), nil)
				env.OAuthStore.On("SaveExternalService", mock.Anything, mock.Anything).Return(nil)
				env.SAService.On("RetrieveServiceAccount", mock.Anything, mock.Anything, mock.Anything).Return(&sa1Profile, nil)
				// TODO should we also mock the acStore to check the role has been updated?
			},
			cmd: &oauthserver.ExternalServiceRegistration{
				ExternalServiceName: "my-ext-service",
				Key:                 &oauthserver.KeyOption{Generate: true},
				Permissions:         []ac.Permission{{Action: "dashboards:create", Scope: "folders:uid:general"}},
			},
		},
		{
			name: "should allow jwt bearer grant",
			init: func(env *TestEnv) {
				env.OAuthStore.On("GetExternalServiceByName", mock.Anything, mock.Anything).Return(nil, oauthserver.ErrClientNotFound("my-ext-service"))
				env.OAuthStore.On("SaveExternalService", mock.Anything, mock.Anything).Return(nil)
			},
			cmd: &oauthserver.ExternalServiceRegistration{
				ExternalServiceName:    "my-ext-service",
				Key:                    &oauthserver.KeyOption{Generate: true},
				ImpersonatePermissions: []ac.Permission{{Action: "users:read", Scope: "global.users:self"}},
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
			if len(tt.cmd.Permissions) > 0 {
				require.NotNil(t, dto.GrantTypes)
				require.Contains(t, dto.GrantTypes, fosite.GrantTypeClientCredentials, "grant types should contain client_credentials")
			} else {
				require.NotContains(t, dto.GrantTypes, fosite.GrantTypeClientCredentials, "grant types should not contain client_credentials")
			}
			// Check that we updated grant types
			if tt.cmd.ImpersonatePermissions != nil && len(tt.cmd.ImpersonatePermissions) > 0 {
				require.NotNil(t, dto.GrantTypes)
				require.Contains(t, dto.GrantTypes, fosite.GrantTypeJWTBearer, "grant types should contain JWT Bearer grant")
			} else {
				require.NotContains(t, dto.GrantTypes, fosite.GrantTypeJWTBearer, "grant types should not contain JWT Bearer grant")
			}

			// Check that mocks were called as expected
			env.OAuthStore.AssertExpectations(t)
			env.SAService.AssertExpectations(t)

			// Additional checks performed
			if tt.mockChecks != nil {
				tt.mockChecks(t, env)
			}
		})
	}
}
