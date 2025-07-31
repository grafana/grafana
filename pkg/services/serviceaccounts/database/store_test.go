package database

import (
	"context"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/infra/kvstore"
	"github.com/grafana/grafana/pkg/infra/tracing"
	ac "github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/apikey/apikeyimpl"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/services/org/orgimpl"
	"github.com/grafana/grafana/pkg/services/quota/quotatest"
	"github.com/grafana/grafana/pkg/services/serviceaccounts"
	"github.com/grafana/grafana/pkg/services/serviceaccounts/tests"
	"github.com/grafana/grafana/pkg/services/supportbundles/supportbundlestest"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/services/user/userimpl"
	"github.com/grafana/grafana/pkg/tests/testsuite"
)

func TestMain(m *testing.M) {
	testsuite.Run(m)
}

// Service Account should not create an org on its own
func TestIntegrationStore_CreateServiceAccountOrgNonExistant(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping test in short mode")
	}

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

func TestIntegration_Store_CreateServiceAccount(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test in short mode")
	}
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

		retrieved, err := store.RetrieveServiceAccount(context.Background(), &serviceaccounts.GetServiceAccountQuery{
			OrgID: serviceAccountOrgId,
			ID:    saDTO.Id,
		})
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

		retrieved, err := store.RetrieveServiceAccount(context.Background(), &serviceaccounts.GetServiceAccountQuery{
			OrgID: serviceAccountOrgId,
			ID:    saDTO.Id,
		})
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

		retrieved, err := store.RetrieveServiceAccount(context.Background(), &serviceaccounts.GetServiceAccountQuery{
			OrgID: serviceAccountOrgId,
			ID:    saDTO.Id,
		})
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

func TestIntegrationStore_CreateServiceAccountRoleNone(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping test in short mode")
	}

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

	retrieved, err := store.RetrieveServiceAccount(context.Background(), &serviceaccounts.GetServiceAccountQuery{
		OrgID: serviceAccountOrgId,
		ID:    saDTO.Id,
	})
	require.NoError(t, err)
	assert.Equal(t, serviceAccountName, retrieved.Name)
	assert.Equal(t, serviceAccountOrgId, retrieved.OrgId)
	assert.Equal(t, string(serviceAccountRole), retrieved.Role)

	retrievedId, err := store.RetrieveServiceAccountIdByName(context.Background(), serviceAccountOrgId, serviceAccountName)
	require.NoError(t, err)
	assert.Equal(t, saDTO.Id, retrievedId)
	assert.Equal(t, saDTO.Role, string(org.RoleNone))
}

func TestIntegrationStore_DeleteServiceAccount(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping test in short mode")
	}
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
			user := tests.SetupUserServiceAccount(t, db, store.settingsProvider, c.user)
			err := store.DeleteServiceAccount(context.Background(), user.OrgID, user.ID)
			if c.expectedErr != nil {
				require.ErrorIs(t, err, c.expectedErr)
			} else {
				require.NoError(t, err)
			}
		})
	}
}

func setupTestDatabase(t *testing.T) (db.DB, *ServiceAccountsStoreImpl) {
	t.Helper()
	db, settingsProvider := db.InitTestDBWithCfg(t)
	quotaService := quotatest.New(false, nil)
	apiKeyService, err := apikeyimpl.ProvideService(db, settingsProvider, quotaService)
	require.NoError(t, err)
	kvStore := kvstore.ProvideService(db)
	orgService, err := orgimpl.ProvideService(db, settingsProvider, quotaService)
	require.NoError(t, err)
	userSvc, err := userimpl.ProvideService(
		db, orgService, settingsProvider, nil, nil, tracing.InitializeTracerForTest(),
		quotaService, supportbundlestest.NewFakeBundleService(),
	)
	require.NoError(t, err)
	return db, ProvideServiceAccountsStore(settingsProvider, db, apiKeyService, kvStore, userSvc, orgService)
}

func TestIntegrationStore_RetrieveServiceAccount(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping test in short mode")
	}
	cases := []struct {
		desc          string
		user          tests.TestUser
		retrieveByUID bool
		expectedErr   error
	}{
		{
			desc:        "service accounts should exist and get retrieved",
			user:        tests.TestUser{Login: "servicetest1@admin", IsServiceAccount: true},
			expectedErr: nil,
		},
		{
			desc:          "service accounts should be able to be retrieved with uid",
			user:          tests.TestUser{Login: "test1@admin", IsServiceAccount: true},
			expectedErr:   nil,
			retrieveByUID: true,
		},
		{
			desc:        "service accounts is false should not retrieve user",
			user:        tests.TestUser{Login: "test1@admin", IsServiceAccount: false},
			expectedErr: serviceaccounts.ErrServiceAccountNotFound,
		},
	}

	for _, c := range cases {
		t.Run(c.desc, func(t *testing.T) {
			var dto *serviceaccounts.ServiceAccountProfileDTO
			var err error
			db, store := setupTestDatabase(t)
			user := tests.SetupUserServiceAccount(t, db, store.settingsProvider, c.user)
			if c.retrieveByUID {
				dto, err = store.RetrieveServiceAccount(context.Background(), &serviceaccounts.GetServiceAccountQuery{
					OrgID: user.OrgID,
					UID:   user.UID,
				})
			} else {
				dto, err = store.RetrieveServiceAccount(context.Background(), &serviceaccounts.GetServiceAccountQuery{
					OrgID: user.OrgID,
					ID:    user.ID,
				})
			}
			if c.expectedErr != nil {
				require.ErrorIs(t, err, c.expectedErr)
			} else {
				require.NoError(t, err)
				require.Equal(t, c.user.Login, dto.Login)
				require.Len(t, dto.Teams, 0)
				if c.retrieveByUID {
					require.Equal(t, user.UID, dto.UID)
				}
			}
		})
	}
}

func TestIntegrationStore_MigrateAllApiKeys(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping test in short mode")
	}
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
			cfg := store.settingsProvider.Get()
			cfg.AutoAssignOrg = true
			cfg.AutoAssignOrgId = 1
			cfg.AutoAssignOrgRole = "Viewer"
			_, err := store.orgService.CreateWithMember(context.Background(), &org.CreateOrgCommand{Name: "main"})
			require.NoError(t, err)

			for _, key := range c.keys {
				tests.SetupApiKey(t, db, store.settingsProvider, key)
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

func TestIntegrationServiceAccountsStoreImpl_SearchOrgServiceAccounts(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping test in short mode")
	}

	db, store := setupTestDatabase(t)

	initUsers := []tests.TestUser{
		{Name: "extsvc-test-1", Role: string(org.RoleNone), Login: "sa-1-extsvc-test-1", IsServiceAccount: true},
		{Name: "usertest-2", Role: string(org.RoleEditor), Login: "usertest-2", IsServiceAccount: false},
		{Name: "extsvc-test-3", Role: string(org.RoleNone), Login: "sa-1-extsvc-test-3", IsServiceAccount: true},
		{Name: "extsvc-test-4", Role: string(org.RoleNone), Login: "sa-1-extsvc-test-4", IsServiceAccount: true},
		{Name: "extsvc-test-5", Role: string(org.RoleNone), Login: "sa-1-extsvc-test-5", IsServiceAccount: true},
		{Name: "satest-6", Role: string(org.RoleViewer), Login: "sa-1-satest-6", IsServiceAccount: true},
		{Name: "satest-7", Role: string(org.RoleEditor), Login: "sa-1-satest-7", IsServiceAccount: true},
		{Name: "satest-8", Role: string(org.RoleAdmin), Login: "sa-1-satest-8", IsServiceAccount: true},
	}

	users, orgID := tests.SetupUsersServiceAccounts(t, db, store.settingsProvider, initUsers)

	apiKeys := []tests.TestApiKey{
		{Name: "sa-01-apikey-01", OrgId: orgID, Key: "key01", IsExpired: false, ServiceAccountID: &users[0].ID},
		{Name: "sa-01-apikey-02", OrgId: orgID, Key: "key02", IsExpired: false, ServiceAccountID: &users[0].ID},
		{Name: "sa-01-apikey-03", OrgId: orgID, Key: "key03", IsExpired: false, ServiceAccountID: &users[0].ID},
		{Name: "sa-02-apikey-01", OrgId: orgID, Key: "key04", IsExpired: false, ServiceAccountID: &users[2].ID},
		{Name: "sa-02-apikey-02", OrgId: orgID, Key: "key05", IsExpired: false, ServiceAccountID: &users[2].ID},
		{Name: "sa-03-apikey-01", OrgId: orgID, Key: "key06", IsExpired: false, ServiceAccountID: &users[3].ID},
	}

	tests.SetupApiKeys(t, db, store.settingsProvider, apiKeys)

	userWithPerm := &user.SignedInUser{
		OrgID:       orgID,
		Permissions: map[int64]map[string][]string{orgID: {serviceaccounts.ActionRead: {serviceaccounts.ScopeAll}}},
	}

	expectedServiceAccount := func(i int, tokens int64) *serviceaccounts.ServiceAccountDTO {
		return &serviceaccounts.ServiceAccountDTO{
			Id: users[i].ID, UID: users[i].UID, Name: users[i].Name, Login: users[i].Login, OrgId: orgID, Role: "None", Tokens: tokens,
		}
	}

	tt := []struct {
		desc                    string
		query                   *serviceaccounts.SearchOrgServiceAccountsQuery
		expectedTotal           int64 // Value of the result.TotalCount
		expectedServiceAccounts []*serviceaccounts.ServiceAccountDTO
		expectedErr             error
	}{
		{
			desc: "should list all service accounts with tokens count",
			query: &serviceaccounts.SearchOrgServiceAccountsQuery{
				OrgID:        orgID,
				SignedInUser: userWithPerm,
				Filter:       serviceaccounts.FilterIncludeAll,
				CountTokens:  true,
			},
			expectedTotal: 7,
			expectedServiceAccounts: []*serviceaccounts.ServiceAccountDTO{
				expectedServiceAccount(0, 3),
				expectedServiceAccount(2, 2),
				expectedServiceAccount(3, 1),
				expectedServiceAccount(4, 0),
				expectedServiceAccount(5, 0),
				expectedServiceAccount(6, 0),
				expectedServiceAccount(7, 0),
			},
		},
		{
			desc: "should list all service accounts with no tokens count",
			query: &serviceaccounts.SearchOrgServiceAccountsQuery{
				OrgID:        orgID,
				SignedInUser: userWithPerm,
				Filter:       serviceaccounts.FilterIncludeAll,
			},
			expectedTotal: 7,
			expectedServiceAccounts: []*serviceaccounts.ServiceAccountDTO{
				expectedServiceAccount(0, 0),
				expectedServiceAccount(2, 0),
				expectedServiceAccount(3, 0),
				expectedServiceAccount(4, 0),
				expectedServiceAccount(5, 0),
				expectedServiceAccount(6, 0),
				expectedServiceAccount(7, 0),
			},
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
			expectedTotal:           0,
			expectedServiceAccounts: []*serviceaccounts.ServiceAccountDTO{},
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
			expectedServiceAccounts: []*serviceaccounts.ServiceAccountDTO{
				expectedServiceAccount(0, 0),
				expectedServiceAccount(6, 0),
			},
		},
		{
			desc: "should list only external service accounts",
			query: &serviceaccounts.SearchOrgServiceAccountsQuery{
				OrgID:        orgID,
				SignedInUser: userWithPerm,
				Filter:       serviceaccounts.FilterOnlyExternal,
				CountTokens:  true,
			},
			expectedTotal: 4,
			expectedServiceAccounts: []*serviceaccounts.ServiceAccountDTO{
				expectedServiceAccount(0, 3),
				expectedServiceAccount(2, 2),
				expectedServiceAccount(3, 1),
				expectedServiceAccount(4, 0),
			},
		},
		{
			desc: "should return service accounts with sa-1-satest login",
			query: &serviceaccounts.SearchOrgServiceAccountsQuery{
				OrgID:        orgID,
				Query:        "SA-1-SaTeSt", // Using mixed-case to test case-insensitive search
				SignedInUser: userWithPerm,
				Filter:       serviceaccounts.FilterIncludeAll,
				CountTokens:  true,
			},
			expectedTotal: 3,
			expectedServiceAccounts: []*serviceaccounts.ServiceAccountDTO{
				expectedServiceAccount(5, 0),
				expectedServiceAccount(6, 0),
				expectedServiceAccount(7, 0),
			},
		},
		{
			desc: "should only count service accounts",
			query: &serviceaccounts.SearchOrgServiceAccountsQuery{
				OrgID:        orgID,
				SignedInUser: userWithPerm,
				Filter:       serviceaccounts.FilterIncludeAll,
				CountOnly:    true,
			},
			expectedTotal:           7,
			expectedServiceAccounts: []*serviceaccounts.ServiceAccountDTO{},
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
			expectedServiceAccounts: []*serviceaccounts.ServiceAccountDTO{
				expectedServiceAccount(7, 0),
			},
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
			require.Len(t, got.ServiceAccounts, len(tc.expectedServiceAccounts))
			for i, sa := range got.ServiceAccounts {
				require.EqualValues(t, tc.expectedServiceAccounts[i], sa)
			}
		})
	}
}

func TestIntegrationServiceAccountsStoreImpl_EnableServiceAccounts(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping test in short mode")
	}

	ctx := context.Background()

	initUsers := []tests.TestUser{
		{Name: "satest-1", Role: string(org.RoleViewer), Login: "sa-satest-1", IsServiceAccount: true},
		{Name: "satest-2", Role: string(org.RoleEditor), Login: "sa-satest-2", IsServiceAccount: true},
		{Name: "usertest-3", Role: string(org.RoleEditor), Login: "usertest-3", IsServiceAccount: false},
	}

	db, store := setupTestDatabase(t)
	_, orgID := tests.SetupUsersServiceAccounts(t, db, store.settingsProvider, initUsers)

	fetchStates := func() map[int64]bool {
		sa1, err := store.RetrieveServiceAccount(ctx, &serviceaccounts.GetServiceAccountQuery{OrgID: orgID, ID: 1})
		require.NoError(t, err)
		sa2, err := store.RetrieveServiceAccount(ctx, &serviceaccounts.GetServiceAccountQuery{OrgID: orgID, ID: 2})
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
