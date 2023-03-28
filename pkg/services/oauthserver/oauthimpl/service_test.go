package oauthimpl

import (
	"context"
	"crypto/rsa"
	"testing"

	"github.com/grafana/grafana/pkg/infra/localcache"
	"github.com/grafana/grafana/pkg/infra/log"
	ac "github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/accesscontrol/actest"
	"github.com/grafana/grafana/pkg/services/oauthserver"
	"github.com/grafana/grafana/pkg/services/oauthserver/oauthtest"
	"github.com/grafana/grafana/pkg/services/serviceaccounts"
	satest "github.com/grafana/grafana/pkg/services/serviceaccounts/tests"
	"github.com/grafana/grafana/pkg/services/team/teamtest"
	"github.com/grafana/grafana/pkg/services/user/usertest"
	"github.com/ory/fosite"
	"github.com/ory/fosite/storage"
	"github.com/stretchr/testify/require"
)

type TestFakes struct {
	Store         *oauthtest.FakeStore
	AccessControl *actest.FakeAccessControl
	AcService     *actest.FakeService
	SaService     *satest.FakeServiceAccountService
	UserService   *usertest.FakeUserService
	TeamService   *teamtest.FakeService
}

func SetupTest(t *testing.T) (*OAuth2ServiceImpl, *TestFakes) {
	t.Helper()
	fakes := &TestFakes{
		Store:         &oauthtest.FakeStore{},
		AccessControl: &actest.FakeAccessControl{},
		AcService:     &actest.FakeService{},
		SaService:     &satest.FakeServiceAccountService{},
		UserService:   &usertest.FakeUserService{},
		TeamService:   &teamtest.FakeService{},
	}

	return &OAuth2ServiceImpl{
		cache:         &localcache.CacheService{},
		memstore:      &storage.MemoryStore{},
		sqlstore:      fakes.Store,
		oauthProvider: nil,
		logger:        log.New("oauthserver.test"),
		accessControl: fakes.AccessControl,
		acService:     fakes.AcService,
		saService:     fakes.SaService,
		userService:   fakes.UserService,
		teamService:   fakes.TeamService,
		publicKey:     &rsa.PublicKey{},
	}, fakes
}

func TestOAuth2ServiceImpl_UpdateExternalService(t *testing.T) {
	s, fakes := SetupTest(t)

	tests := []struct {
		name    string
		init    func()
		cmd     *oauthserver.UpdateClientCommand
		wantErr bool
	}{
		{
			name: "should not update anything",
			init: func() {
				fakes.Store.ExpectedClient = &oauthserver.Client{
					ExternalServiceName: "test", ServiceAccountID: oauthserver.NoServiceAccountID,
				}
			},
			cmd: &oauthserver.UpdateClientCommand{
				ExternalServiceName: "test",
			},
			wantErr: false,
		},
		{
			name: "should create a service account",
			init: func() {
				fakes.Store.ExpectedClient = &oauthserver.Client{
					ExternalServiceName: "test", ServiceAccountID: oauthserver.NoServiceAccountID,
				}
				fakes.SaService.ExpectedServiceAccountDTO = &serviceaccounts.ServiceAccountDTO{Id: 3}
			},
			cmd: &oauthserver.UpdateClientCommand{
				ExternalServiceName: "test",
				Permissions:         []ac.Permission{{Action: "users:read", Scope: "users:*"}},
			},
			wantErr: false,
		},
		{
			name: "should delete the service account",
			init: func() {
				fakes.Store.ExpectedClient = &oauthserver.Client{
					ExternalServiceName: "test", ServiceAccountID: 3,
				}
				fakes.SaService.ExpectedServiceAccountProfileDTO = &serviceaccounts.ServiceAccountProfileDTO{Id: 3}
			},
			cmd: &oauthserver.UpdateClientCommand{
				ExternalServiceName: "test",
				Permissions:         []ac.Permission{},
			},
			wantErr: false,
		},
		{
			name: "should update the service account",
			init: func() {
				fakes.Store.ExpectedClient = &oauthserver.Client{
					ExternalServiceName: "test", ServiceAccountID: 3,
				}
				fakes.SaService.ExpectedServiceAccountProfileDTO = &serviceaccounts.ServiceAccountProfileDTO{Id: 3}
			},
			cmd: &oauthserver.UpdateClientCommand{
				ExternalServiceName: "test",
				Permissions:         []ac.Permission{{Action: "users:read", Scope: "users:*"}},
			},
			wantErr: false,
		},
		{
			name: "should allow jwt bearer grant",
			init: func() {
				fakes.Store.ExpectedClient = &oauthserver.Client{
					ExternalServiceName: "test", ServiceAccountID: 3,
				}
			},
			cmd: &oauthserver.UpdateClientCommand{
				ExternalServiceName:    "test",
				ImpersonatePermissions: []ac.Permission{{Action: "users:read", Scope: "users:*"}},
			},
			wantErr: false,
		},
		{
			name: "should generate credentials",
			init: func() { fakes.Store.ExpectedClient = &oauthserver.Client{ExternalServiceName: "test"} },
			cmd: &oauthserver.UpdateClientCommand{
				ExternalServiceName: "test",
				GenCredentials:      true,
			},
			wantErr: false,
		},
		{
			name: "should generate keys",
			init: func() { fakes.Store.ExpectedClient = &oauthserver.Client{ExternalServiceName: "test"} },
			cmd: &oauthserver.UpdateClientCommand{
				ExternalServiceName: "test",
				Key:                 &oauthserver.KeyOption{Generate: true},
			},
			wantErr: false,
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			tt.init()

			cmd := *tt.cmd
			dto, err := s.UpdateExternalService(context.Background(), &cmd)
			if tt.wantErr {
				require.Error(t, err)
				return
			}
			require.NoError(t, err)

			// Check that we updated grant types and created or updated the service account
			if tt.cmd.Permissions != nil && len(tt.cmd.Permissions) > 0 {
				require.NotNil(t, cmd.GrantTypes)
				require.Contains(t, *cmd.GrantTypes, "client_credentials", "grant types should contain client_credentials")

				// If we had no service account previously we should have created one
				if fakes.Store.ExpectedClient.ServiceAccountID == oauthserver.NoServiceAccountID {
					require.NotNil(t, cmd.ServiceAccountID)
					require.Equal(t, *cmd.ServiceAccountID, fakes.SaService.ExpectedServiceAccountDTO.Id)
				}
				// If we had a service account previously we should not have created a new one
				if fakes.Store.ExpectedClient.ServiceAccountID != oauthserver.NoServiceAccountID {
					require.Nil(t, cmd.ServiceAccountID)
				}
			}
			// Check that we updated grant types and deleted service account
			if tt.cmd.Permissions != nil && len(tt.cmd.Permissions) == 0 {
				require.NotNil(t, cmd.GrantTypes)
				require.NotContains(t, *cmd.GrantTypes, "client_credentials", "grant types should contain client_credentials")

				// We should have no service account id
				require.NotNil(t, cmd.ServiceAccountID)
				require.Equal(t, *cmd.ServiceAccountID, oauthserver.NoServiceAccountID)
			}
			// Check that we updated grant types
			if tt.cmd.ImpersonatePermissions != nil && len(tt.cmd.ImpersonatePermissions) > 0 {
				require.NotNil(t, cmd.GrantTypes)
				require.Contains(t, *cmd.GrantTypes, fosite.GrantTypeJWTBearer, "grant types should contain JWT Bearer grant")
			}
			// Check that we have generated credentials
			if tt.cmd.GenCredentials {
				require.NotNil(t, cmd.Secret)
				require.NotNil(t, cmd.ClientID)
			}
			// Check that we have generated keys and that we correctly return them
			if tt.cmd.Key != nil && tt.cmd.Key.Generate {
				require.NotEmpty(t, cmd.PublicPem)
				require.NotNil(t, dto.KeyResult)
				require.True(t, dto.KeyResult.Generated)
				require.NotEmpty(t, dto.KeyResult.PrivatePem)
				require.NotEmpty(t, dto.KeyResult.PublicPem)
			}
		})
	}
}
