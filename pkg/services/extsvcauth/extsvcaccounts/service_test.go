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
	"github.com/grafana/grafana/pkg/services/apikey"
	"github.com/grafana/grafana/pkg/services/extsvcauth"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/secrets/kvstore"
	sa "github.com/grafana/grafana/pkg/services/serviceaccounts"
	"github.com/grafana/grafana/pkg/services/serviceaccounts/tests"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"
)

type TestEnv struct {
	S        *ExtSvcAccountsService
	AcStore  *actest.MockStore
	SaSvc    *tests.MockServiceAccountService
	SkvStore *kvstore.FakeSecretsKVStore
}

func setupTestEnv(t *testing.T) *TestEnv {
	t.Helper()

	cfg := setting.NewCfg()
	fmgt := featuremgmt.WithFeatures(featuremgmt.FlagExternalServiceAuth)

	env := &TestEnv{
		AcStore:  &actest.MockStore{},
		SaSvc:    &tests.MockServiceAccountService{},
		SkvStore: kvstore.NewFakeSecretsKVStore(),
	}
	env.S = &ExtSvcAccountsService{
		acSvc:    acimpl.ProvideOSSService(cfg, env.AcStore, localcache.New(0, 0), fmgt),
		logger:   log.New("extsvcaccounts.test"),
		saSvc:    env.SaSvc,
		skvStore: env.SkvStore,
	}
	return env
}

func TestExtSvcAccountsService_ManageExtSvcAccount(t *testing.T) {
	extSvcSlug := "grafana-test-app"
	extSvcOrgID := int64(20)
	extSvcAccID := int64(10)
	extSvcPerms := []ac.Permission{{Action: ac.ActionUsersRead, Scope: ac.ScopeUsersAll}}
	extSvcAccount := &sa.ServiceAccountDTO{
		Id:         extSvcAccID,
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
					Return(extSvcAccount, nil)
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
						return cmd.ServiceAccountID == extSvcAccount.Id && cmd.ExternalServiceID == extSvcSlug &&
							cmd.OrgID == int64(ac.GlobalOrgID) && len(cmd.Permissions) == 1 &&
							cmd.Permissions[0] == extSvcPerms[0]
					}))
			},
			want:    extSvcAccID,
			wantErr: false,
		},
		{
			name: "should update service account",
			init: func(env *TestEnv) {
				// A previous service account was attached to this slug
				env.SaSvc.On("RetrieveServiceAccountIdByName", mock.Anything, mock.Anything, mock.Anything).
					Return(int64(11), nil)
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
				env.AcStore.AssertCalled(t, "SaveExternalServiceRole", mock.Anything,
					mock.MatchedBy(func(cmd ac.SaveExternalServiceRoleCommand) bool {
						return cmd.ServiceAccountID == int64(11) && cmd.ExternalServiceID == extSvcSlug &&
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

			if tt.checks != nil {
				tt.checks(t, env)
			}

			require.Equal(t, tt.want, got)
		})
	}
}

func TestExtSvcAccountsService_SaveExternalService(t *testing.T) {
	extSvcSlug := "grafana-test-app"
	tmpOrgID := int64(1)
	extSvcAccID := int64(10)
	extSvcPerms := []ac.Permission{{Action: ac.ActionUsersRead, Scope: ac.ScopeUsersAll}}
	extSvcAccount := &sa.ServiceAccountDTO{
		Id:         extSvcAccID,
		Name:       extSvcSlug,
		Login:      extSvcSlug,
		OrgId:      tmpOrgID,
		IsDisabled: false,
		Role:       string(roletype.RoleNone),
	}

	tests := []struct {
		name    string
		init    func(env *TestEnv)
		cmd     extsvcauth.ExternalServiceRegistration
		checks  func(t *testing.T, env *TestEnv)
		want    *extsvcauth.ExternalService
		wantErr bool
	}{
		{
			name: "should remove service account when disabled",
			init: func(env *TestEnv) {
				// A previous service account was attached to this slug
				env.SaSvc.On("RetrieveServiceAccountIdByName", mock.Anything, mock.Anything, mock.Anything).Return(extSvcAccID, nil)
				env.SaSvc.On("DeleteServiceAccount", mock.Anything, mock.Anything, mock.Anything).Return(nil)
				env.AcStore.On("DeleteExternalServiceRole", mock.Anything, mock.Anything).Return(nil)
				// A token was previously stored in the secret store
				_ = env.SkvStore.Set(context.Background(), tmpOrgID, extSvcSlug, kvStoreType, "ExtSvcSecretToken")
			},
			cmd: extsvcauth.ExternalServiceRegistration{
				Name: extSvcSlug,
				Self: extsvcauth.SelfCfg{
					Enabled:     false,
					Permissions: extSvcPerms,
				},
			},
			checks: func(t *testing.T, env *TestEnv) {
				env.SaSvc.AssertCalled(t, "RetrieveServiceAccountIdByName", mock.Anything,
					mock.MatchedBy(func(orgID int64) bool { return orgID == tmpOrgID }),
					mock.MatchedBy(func(slug string) bool { return slug == extSvcSlug }))
				env.SaSvc.AssertCalled(t, "DeleteServiceAccount", mock.Anything,
					mock.MatchedBy(func(orgID int64) bool { return orgID == tmpOrgID }),
					mock.MatchedBy(func(saID int64) bool { return saID == extSvcAccID }))
				env.AcStore.AssertCalled(t, "DeleteExternalServiceRole", mock.Anything,
					mock.MatchedBy(func(slug string) bool { return slug == extSvcSlug }))
				_, ok, _ := env.SkvStore.Get(context.Background(), tmpOrgID, extSvcSlug, kvStoreType)
				require.False(t, ok, "secret should have been removed from store")
			},
			want:    nil,
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
			cmd: extsvcauth.ExternalServiceRegistration{
				Name: extSvcSlug,
				Self: extsvcauth.SelfCfg{
					Enabled:     true,
					Permissions: []ac.Permission{},
				},
			},
			checks: func(t *testing.T, env *TestEnv) {
				env.SaSvc.AssertCalled(t, "RetrieveServiceAccountIdByName", mock.Anything,
					mock.MatchedBy(func(orgID int64) bool { return orgID == tmpOrgID }),
					mock.MatchedBy(func(slug string) bool { return slug == extSvcSlug }))
				env.SaSvc.AssertCalled(t, "DeleteServiceAccount", mock.Anything,
					mock.MatchedBy(func(orgID int64) bool { return orgID == tmpOrgID }),
					mock.MatchedBy(func(saID int64) bool { return saID == extSvcAccID }))
				env.AcStore.AssertCalled(t, "DeleteExternalServiceRole", mock.Anything,
					mock.MatchedBy(func(slug string) bool { return slug == extSvcSlug }))
			},
			want:    nil,
			wantErr: false,
		},
		{
			name: "should create new service account",
			init: func(env *TestEnv) {
				// No previous service account was attached to this slug
				env.SaSvc.On("RetrieveServiceAccountIdByName", mock.Anything, mock.Anything, mock.Anything).
					Return(int64(0), sa.ErrServiceAccountNotFound.Errorf("mock"))
				env.SaSvc.On("CreateServiceAccount", mock.Anything, mock.Anything, mock.Anything).
					Return(extSvcAccount, nil)
				// Api Key was added without problem
				env.SaSvc.On("AddServiceAccountToken", mock.Anything, mock.Anything, mock.Anything).Return(&apikey.APIKey{}, nil)
				env.AcStore.On("SaveExternalServiceRole", mock.Anything, mock.Anything).Return(nil)
			},
			cmd: extsvcauth.ExternalServiceRegistration{
				Name: extSvcSlug,
				Self: extsvcauth.SelfCfg{
					Enabled:     true,
					Permissions: extSvcPerms,
				},
			},
			checks: func(t *testing.T, env *TestEnv) {
				env.SaSvc.AssertCalled(t, "RetrieveServiceAccountIdByName", mock.Anything,
					mock.MatchedBy(func(orgID int64) bool { return orgID == tmpOrgID }),
					mock.MatchedBy(func(slug string) bool { return slug == extSvcSlug }))
				env.SaSvc.AssertCalled(t, "CreateServiceAccount", mock.Anything,
					mock.MatchedBy(func(orgID int64) bool { return orgID == tmpOrgID }),
					mock.MatchedBy(func(cmd *sa.CreateServiceAccountForm) bool {
						return cmd.Name == extSvcSlug && *cmd.Role == roletype.RoleNone
					}),
				)
				env.AcStore.AssertCalled(t, "SaveExternalServiceRole", mock.Anything,
					mock.MatchedBy(func(cmd ac.SaveExternalServiceRoleCommand) bool {
						return cmd.ServiceAccountID == extSvcAccount.Id && cmd.ExternalServiceID == extSvcSlug &&
							cmd.OrgID == int64(ac.GlobalOrgID) && len(cmd.Permissions) == 1 &&
							cmd.Permissions[0] == extSvcPerms[0]
					}))
			},
			want: &extsvcauth.ExternalService{
				Name:   extSvcSlug,
				ID:     extSvcSlug,
				Secret: "not empty",
			},
			wantErr: false,
		},
		{
			name: "should update service account",
			init: func(env *TestEnv) {
				// A previous service account was attached to this slug
				env.SaSvc.On("RetrieveServiceAccountIdByName", mock.Anything, mock.Anything, mock.Anything).
					Return(int64(11), nil)
				env.AcStore.On("SaveExternalServiceRole", mock.Anything, mock.Anything).Return(nil)
				// This time we don't add a token but rely on the secret store
				_ = env.SkvStore.Set(context.Background(), tmpOrgID, extSvcSlug, kvStoreType, "ExtSvcSecretToken")
			},
			cmd: extsvcauth.ExternalServiceRegistration{
				Name: extSvcSlug,
				Self: extsvcauth.SelfCfg{
					Enabled:     true,
					Permissions: extSvcPerms,
				},
			},
			checks: func(t *testing.T, env *TestEnv) {
				env.SaSvc.AssertCalled(t, "RetrieveServiceAccountIdByName", mock.Anything,
					mock.MatchedBy(func(orgID int64) bool { return orgID == tmpOrgID }),
					mock.MatchedBy(func(slug string) bool { return slug == extSvcSlug }))
				env.AcStore.AssertCalled(t, "SaveExternalServiceRole", mock.Anything,
					mock.MatchedBy(func(cmd ac.SaveExternalServiceRoleCommand) bool {
						return cmd.ServiceAccountID == int64(11) && cmd.ExternalServiceID == extSvcSlug &&
							cmd.OrgID == int64(ac.GlobalOrgID) && len(cmd.Permissions) == 1 &&
							cmd.Permissions[0] == extSvcPerms[0]
					}))
			},
			want: &extsvcauth.ExternalService{
				Name:   extSvcSlug,
				ID:     extSvcSlug,
				Secret: "not empty",
			},
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

			got, err := env.S.SaveExternalService(ctx, &tt.cmd)

			if tt.wantErr {
				require.Error(t, err)
				return
			}
			require.NoError(t, err)

			if tt.checks != nil {
				tt.checks(t, env)
			}

			// Only check that there is a secret, not it's actual value
			if tt.want != nil && len(tt.want.Secret) > 0 {
				require.NotEmpty(t, got.Secret)
				tt.want.Secret = got.Secret
			}

			require.Equal(t, tt.want, got)
		})
	}
}
