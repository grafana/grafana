package extsvcaccounts

import (
	"context"
	"testing"

	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/components/satokengen"
	"github.com/grafana/grafana/pkg/infra/localcache"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/tracing"
	ac "github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/accesscontrol/acimpl"
	"github.com/grafana/grafana/pkg/services/accesscontrol/actest"
	"github.com/grafana/grafana/pkg/services/accesscontrol/permreg"
	"github.com/grafana/grafana/pkg/services/accesscontrol/resourcepermissions"
	"github.com/grafana/grafana/pkg/services/apikey"
	"github.com/grafana/grafana/pkg/services/extsvcauth"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/secrets/kvstore"
	sa "github.com/grafana/grafana/pkg/services/serviceaccounts"
	"github.com/grafana/grafana/pkg/services/serviceaccounts/tests"
	"github.com/grafana/grafana/pkg/setting"
)

var (
	autoAssignOrgID = int64(2)
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
	cfg.ManagedServiceAccountsEnabled = true
	fmgt := featuremgmt.WithFeatures(featuremgmt.FlagExternalServiceAccounts)

	env := &TestEnv{
		AcStore:  &actest.MockStore{},
		SaSvc:    &tests.MockServiceAccountService{},
		SkvStore: kvstore.NewFakeSecretsKVStore(),
	}
	logger := log.New("extsvcaccounts.test")
	env.S = &ExtSvcAccountsService{
		enabled: true,
		acSvc: acimpl.ProvideOSSService(
			cfg, env.AcStore, &resourcepermissions.FakeActionSetSvc{},
			localcache.New(0, 0), fmgt, tracing.InitializeTracerForTest(), nil,
			permreg.ProvidePermissionRegistry(), nil),
		defaultOrgID: autoAssignOrgID,
		logger:       logger,
		metrics:      newMetrics(nil, autoAssignOrgID, env.SaSvc, logger),
		saSvc:        env.SaSvc,
		skvStore:     env.SkvStore,
		tracer:       tracing.InitializeTracerForTest(),
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
		Role:       string(identity.RoleNone),
	}

	tests := []struct {
		name    string
		init    func(env *TestEnv)
		cmd     sa.ManageExtSvcAccountCmd
		want    int64
		wantErr bool
	}{
		{
			name: "should disable service account",
			init: func(env *TestEnv) {
				// A previous service account was attached to this slug
				env.SaSvc.On("RetrieveServiceAccountIdByName", mock.Anything, extSvcOrgID, sa.ExtSvcPrefix+extSvcSlug).Return(extSvcAccID, nil)
				env.SaSvc.On("EnableServiceAccount", mock.Anything, extSvcOrgID, extSvcAccID, false).Return(nil)
				env.AcStore.On("SaveExternalServiceRole",
					mock.Anything,
					mock.MatchedBy(func(cmd ac.SaveExternalServiceRoleCommand) bool {
						return cmd.ServiceAccountID == extSvcAccID && cmd.ExternalServiceID == extSvcSlug &&
							cmd.AssignmentOrgID == extSvcOrgID && len(cmd.Permissions) == 1 &&
							cmd.Permissions[0] == extSvcPerms[0]
					})).
					Return(nil)
			},
			cmd: sa.ManageExtSvcAccountCmd{
				ExtSvcSlug:  extSvcSlug,
				Enabled:     false,
				OrgID:       extSvcOrgID,
				Permissions: extSvcPerms,
			},
			want:    extSvcAccID,
			wantErr: false,
		},
		{
			name: "should remove service account when no permission",
			init: func(env *TestEnv) {
				// A previous service account was attached to this slug
				env.SaSvc.On("RetrieveServiceAccountIdByName", mock.Anything, extSvcOrgID, sa.ExtSvcPrefix+extSvcSlug).Return(extSvcAccID, nil)
				env.SaSvc.On("DeleteServiceAccount", mock.Anything, extSvcOrgID, extSvcAccID).Return(nil)
				env.AcStore.On("DeleteExternalServiceRole", mock.Anything, extSvcSlug).Return(nil)
			},
			cmd: sa.ManageExtSvcAccountCmd{
				ExtSvcSlug:  extSvcSlug,
				Enabled:     true,
				OrgID:       extSvcOrgID,
				Permissions: []ac.Permission{},
			},
			want:    0,
			wantErr: false,
		},
		{
			name: "should create new service account",
			init: func(env *TestEnv) {
				// No previous service account was attached to this slug
				env.SaSvc.On("RetrieveServiceAccountIdByName", mock.Anything, extSvcOrgID, sa.ExtSvcPrefix+extSvcSlug).
					Return(int64(0), sa.ErrServiceAccountNotFound.Errorf("mock"))
				env.SaSvc.On("CreateServiceAccount",
					mock.Anything,
					extSvcOrgID,
					mock.MatchedBy(func(cmd *sa.CreateServiceAccountForm) bool {
						return cmd.Name == sa.ExtSvcPrefix+extSvcSlug && *cmd.Role == identity.RoleNone
					})).
					Return(extSvcAccount, nil)
				env.SaSvc.On("EnableServiceAccount", mock.Anything, extSvcOrgID, extSvcAccount.Id, true).Return(nil)
				env.AcStore.On("SaveExternalServiceRole",
					mock.Anything,
					mock.MatchedBy(func(cmd ac.SaveExternalServiceRoleCommand) bool {
						return cmd.ServiceAccountID == extSvcAccount.Id && cmd.ExternalServiceID == extSvcSlug &&
							cmd.AssignmentOrgID == extSvcOrgID && len(cmd.Permissions) == 1 &&
							cmd.Permissions[0] == extSvcPerms[0]
					})).
					Return(nil)
			},
			cmd: sa.ManageExtSvcAccountCmd{
				ExtSvcSlug:  extSvcSlug,
				Enabled:     true,
				OrgID:       extSvcOrgID,
				Permissions: extSvcPerms,
			},
			want:    extSvcAccID,
			wantErr: false,
		},
		{
			name: "should update service account",
			init: func(env *TestEnv) {
				// A previous service account was attached to this slug
				env.SaSvc.On("RetrieveServiceAccountIdByName", mock.Anything, extSvcOrgID, sa.ExtSvcPrefix+extSvcSlug).
					Return(int64(11), nil)
				env.SaSvc.On("EnableServiceAccount", mock.Anything, extSvcOrgID, int64(11), true).Return(nil)
				env.AcStore.On("SaveExternalServiceRole",
					mock.Anything,
					mock.MatchedBy(func(cmd ac.SaveExternalServiceRoleCommand) bool {
						return cmd.ServiceAccountID == int64(11) && cmd.ExternalServiceID == extSvcSlug &&
							cmd.AssignmentOrgID == extSvcOrgID && len(cmd.Permissions) == 1 &&
							cmd.Permissions[0] == extSvcPerms[0]
					})).
					Return(nil)
			},
			cmd: sa.ManageExtSvcAccountCmd{
				ExtSvcSlug:  extSvcSlug,
				Enabled:     true,
				OrgID:       extSvcOrgID,
				Permissions: extSvcPerms,
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
		})
	}
}

func TestExtSvcAccountsService_SaveExternalService(t *testing.T) {
	extSvcSlug := "grafana-test-app"
	validToken, err := satokengen.New(extSvcSlug)
	require.NoError(t, err, "failed to generate a valid token for the tests")
	extSvcAccID := int64(10)
	extSvcPerms := []ac.Permission{{Action: ac.ActionUsersRead, Scope: ac.ScopeUsersAll}}
	extSvcAccount := &sa.ServiceAccountDTO{
		Id:         extSvcAccID,
		Name:       extSvcSlug,
		Login:      extSvcSlug,
		OrgId:      autoAssignOrgID,
		IsDisabled: false,
		Role:       string(identity.RoleNone),
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
			name: "should disable service account",
			init: func(env *TestEnv) {
				// A previous service account was attached to this slug
				env.SaSvc.On("RetrieveServiceAccountIdByName", mock.Anything, autoAssignOrgID, sa.ExtSvcPrefix+extSvcSlug).
					Return(extSvcAccID, nil)
				env.SaSvc.On("EnableServiceAccount", mock.Anything, autoAssignOrgID, extSvcAccID, false).Return(nil)
				env.AcStore.On("SaveExternalServiceRole",
					mock.Anything,
					mock.MatchedBy(func(cmd ac.SaveExternalServiceRoleCommand) bool {
						return cmd.ServiceAccountID == extSvcAccID && cmd.ExternalServiceID == extSvcSlug &&
							cmd.AssignmentOrgID == autoAssignOrgID && len(cmd.Permissions) == 1 &&
							cmd.Permissions[0] == extSvcPerms[0]
					})).
					Return(nil)
				// A token was previously stored in the secret store
				_ = env.SkvStore.Set(context.Background(), autoAssignOrgID, extSvcSlug, kvStoreType, validToken.ClientSecret)
			},
			cmd: extsvcauth.ExternalServiceRegistration{
				Name: extSvcSlug,
				Self: extsvcauth.SelfCfg{
					Enabled:     false,
					Permissions: extSvcPerms,
				},
			},
			checks: func(t *testing.T, env *TestEnv) {
				_, ok, _ := env.SkvStore.Get(context.Background(), autoAssignOrgID, extSvcSlug, kvStoreType)
				require.True(t, ok, "secret should have been kept in store")
			},
			want: &extsvcauth.ExternalService{
				Name:   extSvcSlug,
				ID:     extSvcSlug,
				Secret: "not empty",
			},
			wantErr: false,
		},
		{
			name: "should remove service account when no permission",
			init: func(env *TestEnv) {
				// A previous service account was attached to this slug
				env.SaSvc.On("RetrieveServiceAccountIdByName", mock.Anything, autoAssignOrgID, sa.ExtSvcPrefix+extSvcSlug).
					Return(extSvcAccID, nil)
				env.SaSvc.On("DeleteServiceAccount", mock.Anything, autoAssignOrgID, extSvcAccID).Return(nil)
				env.AcStore.On("DeleteExternalServiceRole", mock.Anything, extSvcSlug).Return(nil)
				// A token was previously stored in the secret store
				_ = env.SkvStore.Set(context.Background(), autoAssignOrgID, extSvcSlug, kvStoreType, validToken.ClientSecret)
			},
			cmd: extsvcauth.ExternalServiceRegistration{
				Name: extSvcSlug,
				Self: extsvcauth.SelfCfg{
					Enabled:     true,
					Permissions: []ac.Permission{},
				},
			},
			checks: func(t *testing.T, env *TestEnv) {
				_, ok, _ := env.SkvStore.Get(context.Background(), autoAssignOrgID, extSvcSlug, kvStoreType)
				require.False(t, ok, "secret should have been removed from store")
			},
			want:    nil,
			wantErr: false,
		},
		{
			name: "should create new service account",
			init: func(env *TestEnv) {
				// No previous service account was attached to this slug
				env.SaSvc.On("RetrieveServiceAccountIdByName", mock.Anything, autoAssignOrgID, sa.ExtSvcPrefix+extSvcSlug).
					Return(int64(0), sa.ErrServiceAccountNotFound.Errorf("mock"))
				env.SaSvc.On("CreateServiceAccount",
					mock.Anything,
					autoAssignOrgID,
					mock.MatchedBy(func(cmd *sa.CreateServiceAccountForm) bool {
						return cmd.Name == sa.ExtSvcPrefix+extSvcSlug && *cmd.Role == identity.RoleNone
					})).
					Return(extSvcAccount, nil)
				env.SaSvc.On("EnableServiceAccount", mock.Anything, autoAssignOrgID, extSvcAccID, true).Return(nil)
				// Api Key was added without problem
				env.SaSvc.On("AddServiceAccountToken", mock.Anything, mock.Anything, mock.Anything).Return(&apikey.APIKey{}, nil)
				env.AcStore.On("SaveExternalServiceRole",
					mock.Anything,
					mock.MatchedBy(func(cmd ac.SaveExternalServiceRoleCommand) bool {
						return cmd.ServiceAccountID == extSvcAccount.Id && cmd.ExternalServiceID == extSvcSlug &&
							cmd.AssignmentOrgID == autoAssignOrgID && len(cmd.Permissions) == 1 &&
							cmd.Permissions[0] == extSvcPerms[0]
					})).
					Return(nil)
			},
			cmd: extsvcauth.ExternalServiceRegistration{
				Name: extSvcSlug,
				Self: extsvcauth.SelfCfg{
					Enabled:     true,
					Permissions: extSvcPerms,
				},
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
				env.SaSvc.On("RetrieveServiceAccountIdByName", mock.Anything, autoAssignOrgID, sa.ExtSvcPrefix+extSvcSlug).
					Return(int64(11), nil)
				env.AcStore.On("SaveExternalServiceRole",
					mock.Anything,
					mock.MatchedBy(func(cmd ac.SaveExternalServiceRoleCommand) bool {
						return cmd.ServiceAccountID == int64(11) && cmd.ExternalServiceID == extSvcSlug &&
							cmd.AssignmentOrgID == autoAssignOrgID && len(cmd.Permissions) == 1 &&
							cmd.Permissions[0] == extSvcPerms[0]
					})).
					Return(nil)
				env.SaSvc.On("EnableServiceAccount", mock.Anything, autoAssignOrgID, int64(11), true).Return(nil)
				// This time we don't add a token but rely on the secret store
				_ = env.SkvStore.Set(context.Background(), autoAssignOrgID, extSvcSlug, kvStoreType, validToken.ClientSecret)
			},
			cmd: extsvcauth.ExternalServiceRegistration{
				Name: extSvcSlug,
				Self: extsvcauth.SelfCfg{
					Enabled:     true,
					Permissions: extSvcPerms,
				},
			},
			want: &extsvcauth.ExternalService{
				Name:   extSvcSlug,
				ID:     extSvcSlug,
				Secret: "not empty",
			},
			wantErr: false,
		},
		{
			name: "should recover from a failed token encryption",
			init: func(env *TestEnv) {
				// A previous service account was attached to this slug
				env.SaSvc.On("RetrieveServiceAccountIdByName", mock.Anything, autoAssignOrgID, sa.ExtSvcPrefix+extSvcSlug).
					Return(int64(11), nil)
				env.AcStore.On("SaveExternalServiceRole",
					mock.Anything,
					mock.MatchedBy(func(cmd ac.SaveExternalServiceRoleCommand) bool {
						return cmd.ServiceAccountID == int64(11) && cmd.ExternalServiceID == extSvcSlug &&
							cmd.AssignmentOrgID == autoAssignOrgID && len(cmd.Permissions) == 1 &&
							cmd.Permissions[0] == extSvcPerms[0]
					})).
					Return(nil)
				env.SaSvc.On("EnableServiceAccount", mock.Anything, autoAssignOrgID, int64(11), true).Return(nil)

				// This time the token in the secret store is invalid
				_ = env.SkvStore.Set(context.Background(), autoAssignOrgID, extSvcSlug, kvStoreType, "failedTokenEncryption")
				// Delete the API key and entry in the skv store
				env.SaSvc.On("ListTokens", mock.Anything, mock.Anything).
					Return([]apikey.APIKey{{ID: 3, Name: tokenNamePrefix + "-" + extSvcSlug}}, nil)
				env.SaSvc.On("DeleteServiceAccountToken", mock.Anything, mock.Anything, int64(11), int64(3)).Return(nil)
				// Recreate the API key
				env.SaSvc.On("AddServiceAccountToken", mock.Anything, mock.Anything, mock.Anything).Return(&apikey.APIKey{}, nil)
			},
			checks: func(t *testing.T, env *TestEnv) {
				// Make sure the secret was updated
				v, ok, _ := env.SkvStore.Get(context.Background(), autoAssignOrgID, extSvcSlug, kvStoreType)
				require.True(t, ok, "secret should have been removed from store")
				require.NotEqual(t, "failedTokenEncryption", v)
			},
			cmd: extsvcauth.ExternalServiceRegistration{
				Name: extSvcSlug,
				Self: extsvcauth.SelfCfg{
					Enabled:     true,
					Permissions: extSvcPerms,
				},
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

func TestExtSvcAccountsService_RemoveExtSvcAccount(t *testing.T) {
	extSvcSlug := "grafana-test-app"
	autoAssignOrgID := int64(1)
	extSvcAccID := int64(10)
	tests := []struct {
		name   string
		init   func(env *TestEnv)
		slug   string
		checks func(t *testing.T, env *TestEnv)
		want   *extsvcauth.ExternalService
	}{
		{
			name: "should not fail if the service account does not exist",
			init: func(env *TestEnv) {
				// No previous service account was attached to this slug
				env.SaSvc.On("RetrieveServiceAccountIdByName", mock.Anything, autoAssignOrgID, sa.ExtSvcPrefix+extSvcSlug).
					Return(int64(0), sa.ErrServiceAccountNotFound.Errorf("not found"))
			},
			slug: extSvcSlug,
			want: nil,
		},
		{
			name: "should remove service account",
			init: func(env *TestEnv) {
				// A previous service account was attached to this slug
				env.SaSvc.On("RetrieveServiceAccountIdByName", mock.Anything, autoAssignOrgID, sa.ExtSvcPrefix+extSvcSlug).
					Return(extSvcAccID, nil)
				env.SaSvc.On("DeleteServiceAccount", mock.Anything, autoAssignOrgID, extSvcAccID).Return(nil)
				env.AcStore.On("DeleteExternalServiceRole", mock.Anything, extSvcSlug).Return(nil)
				// A token was previously stored in the secret store
				_ = env.SkvStore.Set(context.Background(), autoAssignOrgID, extSvcSlug, kvStoreType, "ExtSvcSecretToken")
			},
			slug: extSvcSlug,
			checks: func(t *testing.T, env *TestEnv) {
				_, ok, _ := env.SkvStore.Get(context.Background(), autoAssignOrgID, extSvcSlug, kvStoreType)
				require.False(t, ok, "secret should have been removed from store")
			},
			want: nil,
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			ctx := context.Background()

			env := setupTestEnv(t)
			if tt.init != nil {
				tt.init(env)
			}

			err := env.S.RemoveExtSvcAccount(ctx, autoAssignOrgID, tt.slug)
			require.NoError(t, err)

			if tt.checks != nil {
				tt.checks(t, env)
			}
			env.SaSvc.AssertExpectations(t)
			env.AcStore.AssertExpectations(t)
		})
	}
}

func TestExtSvcAccountsService_GetExternalServiceNames(t *testing.T) {
	sa1 := sa.ServiceAccountDTO{
		Id:    1,
		Name:  sa.ExtSvcPrefix + "svc-1",
		Login: sa.ExtSvcLoginPrefix(autoAssignOrgID) + "svc-1",
		OrgId: autoAssignOrgID,
	}
	sa2 := sa.ServiceAccountDTO{
		Id:    2,
		Name:  sa.ExtSvcPrefix + "svc-2",
		Login: sa.ExtSvcLoginPrefix(autoAssignOrgID) + "svc-2",
		OrgId: autoAssignOrgID,
	}
	tests := []struct {
		name string
		init func(env *TestEnv)
		want []string
	}{
		{
			name: "should return names",
			init: func(env *TestEnv) {
				env.SaSvc.On("SearchOrgServiceAccounts", mock.Anything, mock.MatchedBy(func(cmd *sa.SearchOrgServiceAccountsQuery) bool {
					return cmd.OrgID == autoAssignOrgID &&
						cmd.Filter == sa.FilterOnlyExternal &&
						len(cmd.SignedInUser.GetPermissions()[sa.ActionRead]) > 0
				})).Return(&sa.SearchOrgServiceAccountsResult{
					TotalCount:      2,
					ServiceAccounts: []*sa.ServiceAccountDTO{&sa1, &sa2},
					Page:            1,
					PerPage:         2,
				}, nil)
			},
			want: []string{"svc-1", "svc-2"},
		},
		{
			name: "should handle nil search",
			init: func(env *TestEnv) {
				env.SaSvc.On("SearchOrgServiceAccounts", mock.Anything, mock.MatchedBy(func(cmd *sa.SearchOrgServiceAccountsQuery) bool {
					return cmd.OrgID == autoAssignOrgID &&
						cmd.Filter == sa.FilterOnlyExternal &&
						len(cmd.SignedInUser.GetPermissions()[sa.ActionRead]) > 0
				})).Return(nil, nil)
			},
			want: []string{},
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			ctx := context.Background()

			env := setupTestEnv(t)
			if tt.init != nil {
				tt.init(env)
			}

			got, err := env.S.GetExternalServiceNames(ctx)
			require.NoError(t, err)

			require.ElementsMatch(t, tt.want, got)
			env.SaSvc.AssertExpectations(t)
			env.AcStore.AssertExpectations(t)
		})
	}
}
