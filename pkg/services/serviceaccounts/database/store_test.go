package database

import (
	"context"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/infra/kvstore"
	ac "github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/apikey/apikeyimpl"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/services/org/orgimpl"
	"github.com/grafana/grafana/pkg/services/quota/quotatest"
	"github.com/grafana/grafana/pkg/services/serviceaccounts"
	"github.com/grafana/grafana/pkg/services/serviceaccounts/tests"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/services/supportbundles/supportbundlestest"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/services/user/userimpl"
	"github.com/grafana/grafana/pkg/tests/testsuite"
)

func TestMain(m *testing.M) {
	testsuite.Run(m)
}

// Service Account should not create an org on its own
func TestStore_CreateServiceAccountOrgNonExistant(t *testing.T) {
	_, store := setupTestDatabase(t)
	serviceAccountName := "new Service Account"
	t.Run("create service account", func(t *testing.T) {
		serviceAccountOrgId := int64(1)
		serviceAccountRole := org.RoleAdmin
		isDisabled := true
		saForm := serviceaccounts.CreateServiceAccountForm{
			Name:       serviceAccountName,
			Role:       &serviceAccountRole,
			IsDisabled: &isDisabled,
		}

		_, err := store.CreateServiceAccount(context.Background(), serviceAccountOrgId, &saForm)
		require.Error(t, err)
	})
}

func TestStore_CreateServiceAccount(t *testing.T) {
	serviceAccountName := "new Service Account"
	t.Run("create service account", func(t *testing.T) {
		_, store := setupTestDatabase(t)
		orgQuery := &org.CreateOrgCommand{Name: orgimpl.MainOrgName}
		orgResult, err := store.orgService.CreateWithMember(context.Background(), orgQuery)
		require.NoError(t, err)
		serviceAccountOrgId := orgResult.ID
		serviceAccountRole := org.RoleAdmin
		isDisabled := true
		saForm := serviceaccounts.CreateServiceAccountForm{
			Name:       serviceAccountName,
			Role:       &serviceAccountRole,
			IsDisabled: &isDisabled,
		}

		saDTO, err := store.CreateServiceAccount(context.Background(), serviceAccountOrgId, &saForm)
		require.NoError(t, err)
		assert.Equal(t, serviceAccountName, saDTO.Name)
		assert.Equal(t, 0, int(saDTO.Tokens))

		retrieved, err := store.RetrieveServiceAccount(context.Background(), serviceAccountOrgId, saDTO.Id)
		require.NoError(t, err)
		assert.Equal(t, serviceAccountName, retrieved.Name)
		assert.Equal(t, serviceAccountOrgId, retrieved.OrgId)
		assert.Equal(t, string(serviceAccountRole), retrieved.Role)
		assert.True(t, retrieved.IsDisabled)

		retrievedId, err := store.RetrieveServiceAccountIdByName(context.Background(), serviceAccountOrgId, serviceAccountName)
		require.NoError(t, err)
		assert.Equal(t, saDTO.Id, retrievedId)
	})

	t.Run("create service account twice same org, error", func(t *testing.T) {
		_, store := setupTestDatabase(t)
		orgQuery := &org.CreateOrgCommand{Name: orgimpl.MainOrgName}
		orgResult, err := store.orgService.CreateWithMember(context.Background(), orgQuery)
		require.NoError(t, err)
		serviceAccountOrgId := orgResult.ID
		serviceAccountRole := org.RoleAdmin
		isDisabled := true
		saForm := serviceaccounts.CreateServiceAccountForm{
			Name:       serviceAccountName,
			Role:       &serviceAccountRole,
			IsDisabled: &isDisabled,
		}

		saDTO, err := store.CreateServiceAccount(context.Background(), serviceAccountOrgId, &saForm)
		require.NoError(t, err)
		assert.Equal(t, serviceAccountName, saDTO.Name)
		assert.Equal(t, 0, int(saDTO.Tokens))

		retrieved, err := store.RetrieveServiceAccount(context.Background(), serviceAccountOrgId, saDTO.Id)
		require.NoError(t, err)
		assert.Equal(t, serviceAccountName, retrieved.Name)
		assert.Equal(t, serviceAccountOrgId, retrieved.OrgId)
		assert.Equal(t, string(serviceAccountRole), retrieved.Role)
		assert.True(t, retrieved.IsDisabled)

		retrievedId, err := store.RetrieveServiceAccountIdByName(context.Background(), serviceAccountOrgId, serviceAccountName)
		require.NoError(t, err)
		assert.Equal(t, saDTO.Id, retrievedId)

		// should not b able to create the same service account twice in the same org
		_, err = store.CreateServiceAccount(context.Background(), serviceAccountOrgId, &saForm)
		require.Error(t, err)
	})

	t.Run("create service account twice different orgs should work", func(t *testing.T) {
		_, store := setupTestDatabase(t)
		orgQuery := &org.CreateOrgCommand{Name: orgimpl.MainOrgName}
		orgResult, err := store.orgService.CreateWithMember(context.Background(), orgQuery)
		require.NoError(t, err)
		serviceAccountOrgId := orgResult.ID
		serviceAccountRole := org.RoleAdmin
		isDisabled := true
		saForm := serviceaccounts.CreateServiceAccountForm{
			Name:       serviceAccountName,
			Role:       &serviceAccountRole,
			IsDisabled: &isDisabled,
		}

		saDTO, err := store.CreateServiceAccount(context.Background(), serviceAccountOrgId, &saForm)
		require.NoError(t, err)
		assert.Equal(t, serviceAccountName, saDTO.Name)
		assert.Equal(t, 0, int(saDTO.Tokens))

		retrieved, err := store.RetrieveServiceAccount(context.Background(), serviceAccountOrgId, saDTO.Id)
		require.NoError(t, err)
		assert.Equal(t, serviceAccountName, retrieved.Name)
		assert.Equal(t, serviceAccountOrgId, retrieved.OrgId)
		assert.Equal(t, string(serviceAccountRole), retrieved.Role)
		assert.True(t, retrieved.IsDisabled)

		retrievedId, err := store.RetrieveServiceAccountIdByName(context.Background(), serviceAccountOrgId, serviceAccountName)
		require.NoError(t, err)
		assert.Equal(t, saDTO.Id, retrievedId)

		orgQuerySecond := &org.CreateOrgCommand{Name: "Second Org name"}
		orgResultSecond, err := store.orgService.CreateWithMember(context.Background(), orgQuerySecond)
		require.NoError(t, err)
		serviceAccountOrgIdSecond := orgResultSecond.ID
		// should not b able to create the same service account twice in the same org
		saDTOSecond, err := store.CreateServiceAccount(context.Background(), serviceAccountOrgIdSecond, &saForm)
		require.NoError(t, err)
		assert.Equal(t, serviceAccountName, saDTOSecond.Name)
		assert.Equal(t, 0, int(saDTOSecond.Tokens))
	})
}

func TestStore_CreateServiceAccountRoleNone(t *testing.T) {
	_, store := setupTestDatabase(t)
	orgQuery := &org.CreateOrgCommand{Name: orgimpl.MainOrgName}
	orgResult, err := store.orgService.CreateWithMember(context.Background(), orgQuery)
	require.NoError(t, err)

	serviceAccountName := "new Service Account"
	serviceAccountOrgId := orgResult.ID
	serviceAccountRole := org.RoleNone
	saForm := serviceaccounts.CreateServiceAccountForm{
		Name:       serviceAccountName,
		Role:       &serviceAccountRole,
		IsDisabled: nil,
	}

	saDTO, err := store.CreateServiceAccount(context.Background(), serviceAccountOrgId, &saForm)
	require.NoError(t, err)
	assert.Equal(t, serviceAccountName, saDTO.Name)
	assert.Equal(t, 0, int(saDTO.Tokens))

	retrieved, err := store.RetrieveServiceAccount(context.Background(), serviceAccountOrgId, saDTO.Id)
	require.NoError(t, err)
	assert.Equal(t, serviceAccountName, retrieved.Name)
	assert.Equal(t, serviceAccountOrgId, retrieved.OrgId)
	assert.Equal(t, string(serviceAccountRole), retrieved.Role)

	retrievedId, err := store.RetrieveServiceAccountIdByName(context.Background(), serviceAccountOrgId, serviceAccountName)
	require.NoError(t, err)
	assert.Equal(t, saDTO.Id, retrievedId)
	assert.Equal(t, saDTO.Role, string(org.RoleNone))
}

func TestStore_DeleteServiceAccount(t *testing.T) {
	cases := []struct {
		desc        string
		user        tests.TestUser
		expectedErr error
	}{
		{
			desc:        "service accounts should exist and get deleted",
			user:        tests.TestUser{Login: "servicetest1@admin", IsServiceAccount: true},
			expectedErr: nil,
		},
		{
			desc:        "service accounts is false should not delete the user",
			user:        tests.TestUser{Login: "test1@admin", IsServiceAccount: false},
			expectedErr: serviceaccounts.ErrServiceAccountNotFound,
		},
	}

	for _, c := range cases {
		t.Run(c.desc, func(t *testing.T) {
			db, store := setupTestDatabase(t)
			user := tests.SetupUserServiceAccount(t, db, c.user)
			err := store.DeleteServiceAccount(context.Background(), user.OrgID, user.ID)
			if c.expectedErr != nil {
				require.ErrorIs(t, err, c.expectedErr)
			} else {
				require.NoError(t, err)
			}
		})
	}
}

func setupTestDatabase(t *testing.T) (*sqlstore.SQLStore, *ServiceAccountsStoreImpl) {
	t.Helper()
	db := db.InitTestDB(t)
	quotaService := quotatest.New(false, nil)
	apiKeyService, err := apikeyimpl.ProvideService(db, db.Cfg, quotaService)
	require.NoError(t, err)
	kvStore := kvstore.ProvideService(db)
	orgService, err := orgimpl.ProvideService(db, db.Cfg, quotaService)
	require.NoError(t, err)
	userSvc, err := userimpl.ProvideService(db, orgService, db.Cfg, nil, nil, quotaService, supportbundlestest.NewFakeBundleService())
	require.NoError(t, err)
	return db, ProvideServiceAccountsStore(db.Cfg, db, apiKeyService, kvStore, userSvc, orgService)
}

func TestStore_RetrieveServiceAccount(t *testing.T) {
	cases := []struct {
		desc        string
		user        tests.TestUser
		expectedErr error
	}{
		{
			desc:        "service accounts should exist and get retrieved",
			user:        tests.TestUser{Login: "servicetest1@admin", IsServiceAccount: true},
			expectedErr: nil,
		},
		{
			desc:        "service accounts is false should not retrieve user",
			user:        tests.TestUser{Login: "test1@admin", IsServiceAccount: false},
			expectedErr: serviceaccounts.ErrServiceAccountNotFound,
		},
	}

	for _, c := range cases {
		t.Run(c.desc, func(t *testing.T) {
			db, store := setupTestDatabase(t)
			user := tests.SetupUserServiceAccount(t, db, c.user)
			dto, err := store.RetrieveServiceAccount(context.Background(), user.OrgID, user.ID)
			if c.expectedErr != nil {
				require.ErrorIs(t, err, c.expectedErr)
			} else {
				require.NoError(t, err)
				require.Equal(t, c.user.Login, dto.Login)
				require.Len(t, dto.Teams, 0)
			}
		})
	}
}

func TestStore_MigrateApiKeys(t *testing.T) {
	cases := []struct {
		desc        string
		key         tests.TestApiKey
		expectedErr error
	}{
		{
			desc:        "api key should be migrated to service account token",
			key:         tests.TestApiKey{Name: "Test1", Role: org.RoleEditor, OrgId: 1},
			expectedErr: nil,
		},
	}

	for _, c := range cases {
		t.Run(c.desc, func(t *testing.T) {
			db, store := setupTestDatabase(t)
			store.cfg.AutoAssignOrg = true
			store.cfg.AutoAssignOrgId = 1
			store.cfg.AutoAssignOrgRole = "Viewer"
			_, err := store.orgService.CreateWithMember(context.Background(), &org.CreateOrgCommand{Name: "main"})
			require.NoError(t, err)
			key := tests.SetupApiKey(t, db, c.key)
			err = store.MigrateApiKey(context.Background(), key.OrgID, key.ID)
			if c.expectedErr != nil {
				require.ErrorIs(t, err, c.expectedErr)
			} else {
				require.NoError(t, err)

				q := serviceaccounts.SearchOrgServiceAccountsQuery{
					OrgID: key.OrgID,
					Query: "",
					Page:  1,
					Limit: 50,
					SignedInUser: &user.SignedInUser{
						UserID: 1,
						OrgID:  1,
						Permissions: map[int64]map[string][]string{
							key.OrgID: {
								"serviceaccounts:read": {"serviceaccounts:id:*"},
							},
						},
					},
				}
				serviceAccounts, err := store.SearchOrgServiceAccounts(context.Background(), &q)
				require.NoError(t, err)
				require.Equal(t, int64(1), serviceAccounts.TotalCount)
				saMigrated := serviceAccounts.ServiceAccounts[0]
				require.Equal(t, string(key.Role), saMigrated.Role)

				tokens, err := store.ListTokens(context.Background(), &serviceaccounts.GetSATokensQuery{
					OrgID:            &key.OrgID,
					ServiceAccountID: &saMigrated.Id,
				})
				require.NoError(t, err)
				require.Len(t, tokens, 1)
			}
		})
	}
}

func TestStore_MigrateAllApiKeys(t *testing.T) {
	cases := []struct {
		desc                    string
		keys                    []tests.TestApiKey
		orgId                   int64
		expectedServiceAccounts int64
		expectedErr             error
		expectedMigratedResults *serviceaccounts.MigrationResult
		ctxWithFastCancel       bool
	}{
		{
			desc: "api keys should be migrated to service account tokens within provided org",
			keys: []tests.TestApiKey{
				{Name: "test1", Role: org.RoleEditor, Key: "secret1", OrgId: 1},
				{Name: "test2", Role: org.RoleEditor, Key: "secret2", OrgId: 1},
				{Name: "test3", Role: org.RoleEditor, Key: "secret3", OrgId: 2},
			},
			orgId:                   1,
			expectedServiceAccounts: 2,
			expectedErr:             nil,
			expectedMigratedResults: &serviceaccounts.MigrationResult{
				Total:           2,
				Migrated:        2,
				Failed:          0,
				FailedApikeyIDs: []int64{},
				FailedDetails:   []string{},
			},
		},
		{
			desc: "api keys from another orgs shouldn't be migrated",
			keys: []tests.TestApiKey{
				{Name: "test1", Role: org.RoleEditor, Key: "secret1", OrgId: 2},
				{Name: "test2", Role: org.RoleEditor, Key: "secret2", OrgId: 2},
			},
			orgId:                   1,
			expectedServiceAccounts: 0,
			expectedErr:             nil,
			expectedMigratedResults: &serviceaccounts.MigrationResult{
				Total:           0,
				Migrated:        0,
				Failed:          0,
				FailedApikeyIDs: []int64{},
				FailedDetails:   []string{},
			},
		},
		{
			desc: "expired api keys should be migrated",
			keys: []tests.TestApiKey{
				{Name: "test1", Role: org.RoleEditor, Key: "secret1", OrgId: 1},
				{Name: "test2", Role: org.RoleEditor, Key: "secret2", OrgId: 1, IsExpired: true},
			},
			orgId:                   1,
			expectedServiceAccounts: 2,
			expectedErr:             nil,
			expectedMigratedResults: &serviceaccounts.MigrationResult{
				Total:           2,
				Migrated:        2,
				Failed:          0,
				FailedApikeyIDs: []int64{},
				FailedDetails:   []string{},
			},
		},
	}

	for _, c := range cases {
		t.Run(c.desc, func(t *testing.T) {
			db, store := setupTestDatabase(t)
			store.cfg.AutoAssignOrg = true
			store.cfg.AutoAssignOrgId = 1
			store.cfg.AutoAssignOrgRole = "Viewer"
			_, err := store.orgService.CreateWithMember(context.Background(), &org.CreateOrgCommand{Name: "main"})
			require.NoError(t, err)

			for _, key := range c.keys {
				tests.SetupApiKey(t, db, key)
			}

			results, err := store.MigrateApiKeysToServiceAccounts(context.Background(), c.orgId)
			if c.expectedErr != nil {
				require.ErrorIs(t, err, c.expectedErr)
			} else {
				require.NoError(t, err)

				q := serviceaccounts.SearchOrgServiceAccountsQuery{
					OrgID: c.orgId,
					Query: "",
					Page:  1,
					Limit: 50,
					SignedInUser: &user.SignedInUser{
						UserID: 1,
						OrgID:  1,
						Permissions: map[int64]map[string][]string{
							c.orgId: {
								"serviceaccounts:read": {"serviceaccounts:id:*"},
							},
						},
					},
				}
				serviceAccounts, err := store.SearchOrgServiceAccounts(context.Background(), &q)
				require.NoError(t, err)
				require.Equal(t, c.expectedServiceAccounts, serviceAccounts.TotalCount)
				if c.expectedServiceAccounts > 0 {
					saMigrated := serviceAccounts.ServiceAccounts[0]
					require.Equal(t, string(c.keys[0].Role), saMigrated.Role)

					tokens, err := store.ListTokens(context.Background(), &serviceaccounts.GetSATokensQuery{
						OrgID:            &c.orgId,
						ServiceAccountID: &saMigrated.Id,
					})
					require.NoError(t, err)
					require.Len(t, tokens, 1)
				}
				require.Equal(t, c.expectedMigratedResults, results)
			}
		})
	}
}
func TestServiceAccountsStoreImpl_SearchOrgServiceAccounts(t *testing.T) {
	initUsers := []tests.TestUser{
		{Name: "satest-1", Role: string(org.RoleViewer), Login: "sa-1-satest-1", IsServiceAccount: true},
		{Name: "usertest-2", Role: string(org.RoleEditor), Login: "usertest-2", IsServiceAccount: false},
		{Name: "satest-3", Role: string(org.RoleEditor), Login: "sa-1-satest-3", IsServiceAccount: true},
		{Name: "satest-4", Role: string(org.RoleAdmin), Login: "sa-1-satest-4", IsServiceAccount: true},
		{Name: "extsvc-test-5", Role: string(org.RoleNone), Login: "sa-1-extsvc-test-5", IsServiceAccount: true},
		{Name: "extsvc-test-6", Role: string(org.RoleNone), Login: "sa-1-extsvc-test-6", IsServiceAccount: true},
		{Name: "extsvc-test-7", Role: string(org.RoleNone), Login: "sa-1-extsvc-test-7", IsServiceAccount: true},
		{Name: "extsvc-test-8", Role: string(org.RoleNone), Login: "sa-1-extsvc-test-8", IsServiceAccount: true},
	}

	db, store := setupTestDatabase(t)
	orgID := tests.SetupUsersServiceAccounts(t, db, initUsers)

	userWithPerm := &user.SignedInUser{
		OrgID:       orgID,
		Permissions: map[int64]map[string][]string{orgID: {serviceaccounts.ActionRead: {serviceaccounts.ScopeAll}}},
	}

	tt := []struct {
		desc          string
		query         *serviceaccounts.SearchOrgServiceAccountsQuery
		expectedTotal int64 // Value of the result.TotalCount
		expectedCount int   // Length of the result.ServiceAccounts slice
		expectedErr   error
	}{
		{
			desc: "should list all service accounts",
			query: &serviceaccounts.SearchOrgServiceAccountsQuery{
				OrgID:        orgID,
				SignedInUser: userWithPerm,
				Filter:       serviceaccounts.FilterIncludeAll,
			},
			expectedTotal: 7,
			expectedCount: 7,
		},
		{
			desc: "should list no service accounts without permissions",
			query: &serviceaccounts.SearchOrgServiceAccountsQuery{
				OrgID: orgID,
				SignedInUser: &user.SignedInUser{
					OrgID:       orgID,
					Permissions: map[int64]map[string][]string{orgID: {}},
				},
				Filter: serviceaccounts.FilterIncludeAll,
			},
			expectedTotal: 0,
			expectedCount: 0,
		},
		{
			desc: "should list one service accounts with restricted permissions",
			query: &serviceaccounts.SearchOrgServiceAccountsQuery{
				OrgID: orgID,
				SignedInUser: &user.SignedInUser{
					OrgID: orgID,
					Permissions: map[int64]map[string][]string{orgID: {serviceaccounts.ActionRead: {
						ac.Scope("serviceaccounts", "id", "1"),
						ac.Scope("serviceaccounts", "id", "7"),
					}}},
				},
				Filter: serviceaccounts.FilterIncludeAll,
			},
			expectedTotal: 2,
			expectedCount: 2,
		},
		{
			desc: "should list only external service accounts",
			query: &serviceaccounts.SearchOrgServiceAccountsQuery{
				OrgID:        orgID,
				SignedInUser: userWithPerm,
				Filter:       serviceaccounts.FilterOnlyExternal,
			},
			expectedTotal: 4,
			expectedCount: 4,
		},
		{
			desc: "should return service accounts with sa-1-satest login",
			query: &serviceaccounts.SearchOrgServiceAccountsQuery{
				OrgID:        orgID,
				Query:        "sa-1-satest",
				SignedInUser: userWithPerm,
				Filter:       serviceaccounts.FilterIncludeAll,
			},
			expectedTotal: 3,
			expectedCount: 3,
		},
		{
			desc: "should only count service accounts",
			query: &serviceaccounts.SearchOrgServiceAccountsQuery{
				OrgID:        orgID,
				SignedInUser: userWithPerm,
				Filter:       serviceaccounts.FilterIncludeAll,
				CountOnly:    true,
			},
			expectedTotal: 7,
			expectedCount: 0,
		},
		{
			desc: "should paginate result",
			query: &serviceaccounts.SearchOrgServiceAccountsQuery{
				OrgID:        orgID,
				Page:         4,
				Limit:        2,
				SignedInUser: userWithPerm,
				Filter:       serviceaccounts.FilterIncludeAll,
			},
			expectedTotal: 7,
			expectedCount: 1,
		},
	}
	for _, tc := range tt {
		t.Run(tc.desc, func(t *testing.T) {
			ctx := context.Background()

			got, err := store.SearchOrgServiceAccounts(ctx, tc.query)
			if tc.expectedErr != nil {
				require.ErrorIs(t, err, tc.expectedErr)
				return
			}

			require.Equal(t, tc.expectedTotal, got.TotalCount)
			require.Len(t, got.ServiceAccounts, tc.expectedCount)
		})
	}
}

func TestServiceAccountsStoreImpl_EnableServiceAccounts(t *testing.T) {
	ctx := context.Background()

	initUsers := []tests.TestUser{
		{Name: "satest-1", Role: string(org.RoleViewer), Login: "sa-satest-1", IsServiceAccount: true},
		{Name: "satest-2", Role: string(org.RoleEditor), Login: "sa-satest-2", IsServiceAccount: true},
		{Name: "usertest-3", Role: string(org.RoleEditor), Login: "usertest-3", IsServiceAccount: false},
	}

	db, store := setupTestDatabase(t)
	orgID := tests.SetupUsersServiceAccounts(t, db, initUsers)

	fetchStates := func() map[int64]bool {
		sa1, err := store.RetrieveServiceAccount(ctx, orgID, 1)
		require.NoError(t, err)
		sa2, err := store.RetrieveServiceAccount(ctx, orgID, 2)
		require.NoError(t, err)
		user, err := store.userService.GetByID(ctx, &user.GetUserByIDQuery{ID: 3})
		require.NoError(t, err)
		return map[int64]bool{1: !sa1.IsDisabled, 2: !sa2.IsDisabled, 3: !user.IsDisabled}
	}

	tt := []struct {
		desc       string
		id         int64
		enable     bool
		wantStates map[int64]bool
	}{
		{
			desc:       "should disable service account",
			id:         1,
			enable:     false,
			wantStates: map[int64]bool{1: false, 2: true, 3: true},
		},
		{
			desc:       "should disable service account again",
			id:         1,
			enable:     false,
			wantStates: map[int64]bool{1: false, 2: true, 3: true},
		},
		{
			desc:       "should enable service account",
			id:         1,
			enable:     true,
			wantStates: map[int64]bool{1: true, 2: true, 3: true},
		},
		{
			desc:       "should not disable user",
			id:         3,
			enable:     false,
			wantStates: map[int64]bool{1: true, 2: true, 3: true},
		},
	}
	for _, tc := range tt {
		t.Run(tc.desc, func(t *testing.T) {
			err := store.EnableServiceAccount(ctx, orgID, tc.id, tc.enable)
			require.NoError(t, err)

			require.Equal(t, tc.wantStates, fetchStates())
		})
	}
}
