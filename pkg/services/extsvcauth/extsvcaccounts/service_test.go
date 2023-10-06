package extsvcaccounts

import (
	"context"
	"testing"

	"github.com/grafana/grafana/pkg/infra/localcache"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/models/roletype"
	ac "github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/accesscontrol/acimpl"
	"github.com/grafana/grafana/pkg/services/accesscontrol/actest"
	"github.com/grafana/grafana/pkg/services/extsvcauth"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	sa "github.com/grafana/grafana/pkg/services/serviceaccounts"
	"github.com/grafana/grafana/pkg/services/serviceaccounts/tests"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"
)

// {
// 	name: "should create a service account",
// 	init: func(env *TestEnv) {
// 		// No client at the beginning
// 		env.OAuthStore.On("GetExternalServiceByName", mock.Anything, mock.Anything).Return(nil, oauthserver.ErrClientNotFound(serviceName))
// 		env.OAuthStore.On("SaveExternalService", mock.Anything, mock.Anything).Return(nil)
// 		// Service account and permission creation
// 		env.SAService.On("CreateServiceAccount", mock.Anything, mock.Anything, mock.Anything).Return(&sa1, nil)
// 		env.AcStore.On("SaveExternalServiceRole", mock.Anything, mock.Anything).Return(nil)
// 	},
// 	cmd: &extsvcauth.ExternalServiceRegistration{
// 		Name:             serviceName,
// 		OAuthProviderCfg: &extsvcauth.OAuthProviderCfg{Key: &extsvcauth.KeyOption{Generate: true}},
// 		Self: extsvcauth.SelfCfg{
// 			Enabled:     true,
// 			Permissions: []ac.Permission{{Action: "users:read", Scope: "users:*"}},
// 		},
// 	},
// 	mockChecks: func(t *testing.T, env *TestEnv) {
// 		// Check that the client has a service account and the correct grant type
// 		env.OAuthStore.AssertCalled(t, "SaveExternalService", mock.Anything, mock.MatchedBy(func(client *oauthserver.OAuthExternalService) bool {
// 			return client.Name == serviceName &&
// 				client.GrantTypes == "client_credentials" && client.ServiceAccountID == sa1.Id
// 		}))
// 		// Check that the service account is created in the correct org with the correct role
// 		env.SAService.AssertCalled(t, "CreateServiceAccount", mock.Anything,
// 			mock.MatchedBy(func(orgID int64) bool { return orgID == oauthserver.TmpOrgID }),
// 			mock.MatchedBy(func(cmd *sa.CreateServiceAccountForm) bool {
// 				return cmd.Name == serviceName && *cmd.Role == roletype.RoleNone
// 			}),
// 		)
// 	},
// },
// {
// 	name: "should delete the service account",
// 	init: func(env *TestEnv) {
// 		// Existing client (with a service account hence a role)
// 		env.OAuthStore.On("GetExternalServiceByName", mock.Anything, mock.Anything).Return(client1(), nil)
// 		env.OAuthStore.On("SaveExternalService", mock.Anything, mock.Anything).Return(nil)
// 		env.SAService.On("RetrieveServiceAccount", mock.Anything, mock.Anything, mock.Anything).Return(&sa1Profile, nil)
// 		// No permission anymore will trigger deletion of the service account and its role
// 		env.SAService.On("DeleteServiceAccount", mock.Anything, mock.Anything, mock.Anything).Return(nil)
// 		env.AcStore.On("DeleteExternalServiceRole", mock.Anything, mock.Anything).Return(nil)
// 	},
// 	cmd: &extsvcauth.ExternalServiceRegistration{
// 		Name:             serviceName,
// 		OAuthProviderCfg: &extsvcauth.OAuthProviderCfg{Key: &extsvcauth.KeyOption{Generate: true}},
// 		Self: extsvcauth.SelfCfg{
// 			Enabled: false,
// 		},
// 	},
// 	mockChecks: func(t *testing.T, env *TestEnv) {
// 		// Check that the service has no service account anymore
// 		env.OAuthStore.AssertCalled(t, "SaveExternalService", mock.Anything, mock.MatchedBy(func(client *oauthserver.OAuthExternalService) bool {
// 			return client.Name == serviceName && client.ServiceAccountID == oauthserver.NoServiceAccountID
// 		}))
// 		// Check that the service account is retrieved with the correct ID
// 		env.SAService.AssertCalled(t, "RetrieveServiceAccount", mock.Anything,
// 			mock.MatchedBy(func(orgID int64) bool { return orgID == oauthserver.TmpOrgID }),
// 			mock.MatchedBy(func(saID int64) bool { return saID == prevSaID }))
// 		// Check that the service account is deleted in the correct org
// 		env.SAService.AssertCalled(t, "DeleteServiceAccount", mock.Anything,
// 			mock.MatchedBy(func(orgID int64) bool { return orgID == oauthserver.TmpOrgID }),
// 			mock.MatchedBy(func(saID int64) bool { return saID == sa1.Id }))
// 		// Check that the associated role is deleted
// 		env.AcStore.AssertCalled(t, "DeleteExternalServiceRole", mock.Anything,
// 			mock.MatchedBy(func(extSvcName string) bool { return extSvcName == serviceName }))
// 	},
// },
// {
// 	name: "should update the service account",
// 	init: func(env *TestEnv) {
// 		// Existing client (with a service account hence a role)
// 		env.OAuthStore.On("GetExternalServiceByName", mock.Anything, mock.Anything).Return(client1(), nil)
// 		env.OAuthStore.On("SaveExternalService", mock.Anything, mock.Anything).Return(nil)
// 		env.SAService.On("RetrieveServiceAccount", mock.Anything, mock.Anything, mock.Anything).Return(&sa1Profile, nil)
// 		// Update the service account permissions
// 		env.AcStore.On("SaveExternalServiceRole", mock.Anything, mock.Anything).Return(nil)
// 	},
// 	cmd: &extsvcauth.ExternalServiceRegistration{
// 		Name:             serviceName,
// 		OAuthProviderCfg: &extsvcauth.OAuthProviderCfg{Key: &extsvcauth.KeyOption{Generate: true}},
// 		Self: extsvcauth.SelfCfg{
// 			Enabled:     true,
// 			Permissions: []ac.Permission{{Action: "dashboards:create", Scope: "folders:uid:general"}},
// 		},
// 	},
// 	mockChecks: func(t *testing.T, env *TestEnv) {
// 		// Ensure new permissions are in place
// 		env.AcStore.AssertCalled(t, "SaveExternalServiceRole", mock.Anything,
// 			mock.MatchedBy(func(cmd ac.SaveExternalServiceRoleCommand) bool {
// 				return cmd.ServiceAccountID == sa1.Id && cmd.ExternalServiceID == client1().Name &&
// 					cmd.OrgID == int64(ac.GlobalOrgID) && len(cmd.Permissions) == 1 &&
// 					cmd.Permissions[0] == ac.Permission{Action: "dashboards:create", Scope: "folders:uid:general"}
// 			}))
// 	},
// },

type TestEnv struct {
	S       *ExtSvcAccountsService
	AcStore *actest.MockStore
	SaSvc   *tests.MockServiceAccountService
}

func setupTestEnv(t *testing.T) *TestEnv {
	t.Helper()

	cfg := setting.NewCfg()
	fmgt := featuremgmt.WithFeatures(featuremgmt.FlagExternalServiceAuth)

	env := &TestEnv{
		AcStore: &actest.MockStore{},
		SaSvc:   &tests.MockServiceAccountService{},
	}
	env.S = &ExtSvcAccountsService{
		acSvc:  acimpl.ProvideOSSService(cfg, env.AcStore, localcache.New(0, 0), fmgt),
		logger: log.New("extsvcaccounts.test"),
		saSvc:  env.SaSvc,
	}
	return env
}

func TestExtSvcAccountsService_ManageExtSvcAccount(t *testing.T) {
	extSvcSlug := "grafana-test-app"
	extSvcOrgID := int64(20)
	extSvcAccID := int64(10)
	extSvcPerms := []ac.Permission{{Action: ac.ActionUsersRead, Scope: ac.ScopeUsersAll}}
	prevSa := &sa.ServiceAccountDTO{
		Id:         11,
		Name:       extSvcSlug,
		Login:      extSvcSlug,
		OrgId:      extSvcOrgID,
		IsDisabled: false,
		Role:       string(roletype.RoleNone),
	}

	tests := []struct {
		name    string
		init    func(env *TestEnv)
		cmd     extsvcauth.ManageExtSvcAccountCmd
		checks  func(t *testing.T, env *TestEnv)
		want    int64
		wantErr bool
	}{
		{
			name: "should remove service account when disabled",
			init: func(env *TestEnv) {
				// A previous service account was attached to this slug
				env.SaSvc.On("RetrieveServiceAccountIdByName", mock.Anything, mock.Anything, mock.Anything).Return(extSvcAccID, nil)
				env.SaSvc.On("DeleteServiceAccount", mock.Anything, mock.Anything, mock.Anything).Return(nil)
				env.AcStore.On("DeleteExternalServiceRole", mock.Anything, mock.Anything).Return(nil)
			},
			cmd: extsvcauth.ManageExtSvcAccountCmd{
				ExtSvcSlug:  extSvcSlug,
				Enabled:     false,
				OrgID:       extSvcOrgID,
				Permissions: extSvcPerms,
			},
			checks: func(t *testing.T, env *TestEnv) {
				env.SaSvc.AssertCalled(t, "RetrieveServiceAccountIdByName", mock.Anything,
					mock.MatchedBy(func(orgID int64) bool { return orgID == extSvcOrgID }),
					mock.MatchedBy(func(slug string) bool { return slug == extSvcSlug }))
				env.SaSvc.AssertCalled(t, "DeleteServiceAccount", mock.Anything,
					mock.MatchedBy(func(orgID int64) bool { return orgID == extSvcOrgID }),
					mock.MatchedBy(func(saID int64) bool { return saID == extSvcAccID }))
				env.AcStore.AssertCalled(t, "DeleteExternalServiceRole", mock.Anything,
					mock.MatchedBy(func(slug string) bool { return slug == extSvcSlug }))
			},
			want:    0,
			wantErr: false,
		},
		{
			name: "should remove service account when no permission",
			init: func(env *TestEnv) {
				// A previous service account was attached to this slug
				env.SaSvc.On("RetrieveServiceAccountIdByName", mock.Anything, mock.Anything, mock.Anything).Return(extSvcAccID, nil)
				env.SaSvc.On("DeleteServiceAccount", mock.Anything, mock.Anything, mock.Anything).Return(nil)
				env.AcStore.On("DeleteExternalServiceRole", mock.Anything, mock.Anything).Return(nil)
			},
			cmd: extsvcauth.ManageExtSvcAccountCmd{
				ExtSvcSlug:  extSvcSlug,
				Enabled:     true,
				OrgID:       extSvcOrgID,
				Permissions: []ac.Permission{},
			},
			checks: func(t *testing.T, env *TestEnv) {
				env.SaSvc.AssertCalled(t, "RetrieveServiceAccountIdByName", mock.Anything,
					mock.MatchedBy(func(orgID int64) bool { return orgID == extSvcOrgID }),
					mock.MatchedBy(func(slug string) bool { return slug == extSvcSlug }))
				env.SaSvc.AssertCalled(t, "DeleteServiceAccount", mock.Anything,
					mock.MatchedBy(func(orgID int64) bool { return orgID == extSvcOrgID }),
					mock.MatchedBy(func(saID int64) bool { return saID == extSvcAccID }))
				env.AcStore.AssertCalled(t, "DeleteExternalServiceRole", mock.Anything,
					mock.MatchedBy(func(slug string) bool { return slug == extSvcSlug }))
			},
			want:    0,
			wantErr: false,
		},
		{
			name: "should create new service account",
			init: func(env *TestEnv) {
				// No previous service account was attached to this slug
				env.SaSvc.On("RetrieveServiceAccountIdByName", mock.Anything, mock.Anything, mock.Anything).
					Return(int64(0), sa.ErrServiceAccountNotFound.Errorf("mock"))
				env.SaSvc.On("CreateServiceAccount", mock.Anything, mock.Anything, mock.Anything).
					Return(prevSa, nil)
				env.AcStore.On("SaveExternalServiceRole", mock.Anything, mock.Anything).Return(nil)
			},
			cmd: extsvcauth.ManageExtSvcAccountCmd{
				ExtSvcSlug:  extSvcSlug,
				Enabled:     true,
				OrgID:       extSvcOrgID,
				Permissions: extSvcPerms,
			},
			checks: func(t *testing.T, env *TestEnv) {
				env.SaSvc.AssertCalled(t, "RetrieveServiceAccountIdByName", mock.Anything,
					mock.MatchedBy(func(orgID int64) bool { return orgID == extSvcOrgID }),
					mock.MatchedBy(func(slug string) bool { return slug == extSvcSlug }))
				env.SaSvc.AssertCalled(t, "CreateServiceAccount", mock.Anything,
					mock.MatchedBy(func(orgID int64) bool { return orgID == extSvcOrgID }),
					mock.MatchedBy(func(cmd *sa.CreateServiceAccountForm) bool {
						return cmd.Name == extSvcSlug && *cmd.Role == roletype.RoleNone
					}),
				)
				env.AcStore.AssertCalled(t, "SaveExternalServiceRole", mock.Anything,
					mock.MatchedBy(func(cmd ac.SaveExternalServiceRoleCommand) bool {
						return cmd.ServiceAccountID == prevSa.Id && cmd.ExternalServiceID == extSvcSlug &&
							cmd.OrgID == int64(ac.GlobalOrgID) && len(cmd.Permissions) == 1 &&
							cmd.Permissions[0] == extSvcPerms[0]
					}))
			},
			want:    11,
			wantErr: false,
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			ctx := context.Background()

			env := setupTestEnv(t)
			if tt.init != nil {
				tt.init(env)
			}

			got, err := env.S.ManageExtSvcAccount(ctx, &tt.cmd)

			if tt.wantErr {
				require.Error(t, err)
				return
			}
			require.NoError(t, err)

			require.Equal(t, tt.want, got)

			if tt.checks != nil {
				tt.checks(t, env)
			}
		})
	}
}
