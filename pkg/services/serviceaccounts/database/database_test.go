package database

import (
	"context"
	"math/rand"
	"testing"

	"github.com/grafana/grafana/pkg/infra/kvstore"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/apikey/apikeyimpl"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/services/serviceaccounts"
	"github.com/grafana/grafana/pkg/services/serviceaccounts/tests"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// Service Account should not create an org on its own
func TestStore_CreateServiceAccountOrgNonExistant(t *testing.T) {
	_, store := setupTestDatabase(t)
	t.Run("create service account", func(t *testing.T) {
		serviceAccountName := "new Service Account"
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
	_, store := setupTestDatabase(t)
	orgQuery := &models.CreateOrgCommand{Name: sqlstore.MainOrgName}
	err := store.sqlStore.CreateOrg(context.Background(), orgQuery)
	require.NoError(t, err)

	t.Run("create service account", func(t *testing.T) {
		serviceAccountName := "new Service Account"
		serviceAccountOrgId := orgQuery.Result.Id
		serviceAccountRole := org.RoleAdmin
		isDisabled := true
		saForm := serviceaccounts.CreateServiceAccountForm{
			Name:       serviceAccountName,
			Role:       &serviceAccountRole,
			IsDisabled: &isDisabled,
		}

		saDTO, err := store.CreateServiceAccount(context.Background(), serviceAccountOrgId, &saForm)
		require.NoError(t, err)
		assert.Equal(t, "sa-new-service-account", saDTO.Login)
		assert.Equal(t, serviceAccountName, saDTO.Name)
		assert.Equal(t, 0, int(saDTO.Tokens))

		retrieved, err := store.RetrieveServiceAccount(context.Background(), serviceAccountOrgId, saDTO.Id)
		require.NoError(t, err)
		assert.Equal(t, "sa-new-service-account", retrieved.Login)
		assert.Equal(t, serviceAccountName, retrieved.Name)
		assert.Equal(t, serviceAccountOrgId, retrieved.OrgId)
		assert.Equal(t, string(serviceAccountRole), retrieved.Role)
		assert.True(t, retrieved.IsDisabled)

		retrievedId, err := store.RetrieveServiceAccountIdByName(context.Background(), serviceAccountOrgId, serviceAccountName)
		require.NoError(t, err)
		assert.Equal(t, saDTO.Id, retrievedId)
	})
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
	db := sqlstore.InitTestDB(t)
	apiKeyService := apikeyimpl.ProvideService(db, db.Cfg)
	kvStore := kvstore.ProvideService(db)
	return db, ProvideServiceAccountsStore(db, apiKeyService, kvStore)
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
			store.sqlStore.Cfg.AutoAssignOrg = true
			store.sqlStore.Cfg.AutoAssignOrgId = 1
			store.sqlStore.Cfg.AutoAssignOrgRole = "Viewer"
			err := store.sqlStore.CreateOrg(context.Background(), &models.CreateOrgCommand{Name: "main"})
			require.NoError(t, err)
			key := tests.SetupApiKey(t, db, c.key)
			err = store.MigrateApiKey(context.Background(), key.OrgId, key.Id)
			if c.expectedErr != nil {
				require.ErrorIs(t, err, c.expectedErr)
			} else {
				require.NoError(t, err)

				serviceAccounts, err := store.SearchOrgServiceAccounts(context.Background(), key.OrgId, "", "all", 1, 50, &user.SignedInUser{UserID: 1, OrgID: 1, Permissions: map[int64]map[string][]string{
					key.OrgId: {
						"serviceaccounts:read": {"serviceaccounts:id:*"},
					},
				}})
				require.NoError(t, err)
				require.Equal(t, int64(1), serviceAccounts.TotalCount)
				saMigrated := serviceAccounts.ServiceAccounts[0]
				require.Equal(t, string(key.Role), saMigrated.Role)

				tokens, err := store.ListTokens(context.Background(), &serviceaccounts.GetSATokensQuery{
					OrgID:            &key.OrgId,
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
		desc                   string
		keys                   []tests.TestApiKey
		orgId                  int64
		expectedServiceAccouts int64
		expectedErr            error
	}{
		{
			desc: "api keys should be migrated to service account tokens within provided org",
			keys: []tests.TestApiKey{
				{Name: "test1", Role: org.RoleEditor, Key: "secret1", OrgId: 1},
				{Name: "test2", Role: org.RoleEditor, Key: "secret2", OrgId: 1},
				{Name: "test3", Role: org.RoleEditor, Key: "secret3", OrgId: 2},
			},
			orgId:                  1,
			expectedServiceAccouts: 2,
			expectedErr:            nil,
		},
		{
			desc: "api keys from another orgs shouldn't be migrated",
			keys: []tests.TestApiKey{
				{Name: "test1", Role: org.RoleEditor, Key: "secret1", OrgId: 2},
				{Name: "test2", Role: org.RoleEditor, Key: "secret2", OrgId: 2},
			},
			orgId:                  1,
			expectedServiceAccouts: 0,
			expectedErr:            nil,
		},
		{
			desc: "expired api keys should be migrated",
			keys: []tests.TestApiKey{
				{Name: "test1", Role: org.RoleEditor, Key: "secret1", OrgId: 1},
				{Name: "test2", Role: org.RoleEditor, Key: "secret2", OrgId: 1, IsExpired: true},
			},
			orgId:                  1,
			expectedServiceAccouts: 2,
			expectedErr:            nil,
		},
	}

	for _, c := range cases {
		t.Run(c.desc, func(t *testing.T) {
			db, store := setupTestDatabase(t)
			store.sqlStore.Cfg.AutoAssignOrg = true
			store.sqlStore.Cfg.AutoAssignOrgId = 1
			store.sqlStore.Cfg.AutoAssignOrgRole = "Viewer"
			err := store.sqlStore.CreateOrg(context.Background(), &models.CreateOrgCommand{Name: "main"})
			require.NoError(t, err)

			for _, key := range c.keys {
				tests.SetupApiKey(t, db, key)
			}

			err = store.MigrateApiKeysToServiceAccounts(context.Background(), c.orgId)
			if c.expectedErr != nil {
				require.ErrorIs(t, err, c.expectedErr)
			} else {
				require.NoError(t, err)

				serviceAccounts, err := store.SearchOrgServiceAccounts(context.Background(), c.orgId, "", "all", 1, 50, &user.SignedInUser{UserID: 101, OrgID: c.orgId, Permissions: map[int64]map[string][]string{
					c.orgId: {
						"serviceaccounts:read": {"serviceaccounts:id:*"},
					},
				}})
				require.NoError(t, err)
				require.Equal(t, c.expectedServiceAccouts, serviceAccounts.TotalCount)
				if c.expectedServiceAccouts > 0 {
					saMigrated := serviceAccounts.ServiceAccounts[0]
					require.Equal(t, string(c.keys[0].Role), saMigrated.Role)

					tokens, err := store.ListTokens(context.Background(), &serviceaccounts.GetSATokensQuery{
						OrgID:            &c.orgId,
						ServiceAccountID: &saMigrated.Id,
					})
					require.NoError(t, err)
					require.Len(t, tokens, 1)
				}
			}
		})
	}
}

func TestStore_RevertApiKey(t *testing.T) {
	cases := []struct {
		desc                        string
		key                         tests.TestApiKey
		forceMismatchServiceAccount bool
		expectedErr                 error
	}{
		{
			desc:        "service account token should be reverted to api key",
			key:         tests.TestApiKey{Name: "Test1", Role: org.RoleEditor, OrgId: 1},
			expectedErr: nil,
		},
		{
			desc:                        "should fail reverting to api key when the token is assigned to a different service account",
			key:                         tests.TestApiKey{Name: "Test1", Role: org.RoleEditor, OrgId: 1},
			forceMismatchServiceAccount: true,
			expectedErr:                 ErrServiceAccountAndTokenMismatch,
		},
	}

	for _, c := range cases {
		t.Run(c.desc, func(t *testing.T) {
			db, store := setupTestDatabase(t)
			store.sqlStore.Cfg.AutoAssignOrg = true
			store.sqlStore.Cfg.AutoAssignOrgId = 1
			store.sqlStore.Cfg.AutoAssignOrgRole = "Viewer"
			err := store.sqlStore.CreateOrg(context.Background(), &models.CreateOrgCommand{Name: "main"})
			require.NoError(t, err)

			key := tests.SetupApiKey(t, db, c.key)
			err = store.CreateServiceAccountFromApikey(context.Background(), key)
			require.NoError(t, err)

			var saId int64
			if c.forceMismatchServiceAccount {
				saId = rand.Int63()
			} else {
				serviceAccounts, err := store.SearchOrgServiceAccounts(context.Background(), key.OrgId, "", "all", 1, 50, &user.SignedInUser{UserID: 1, OrgID: 1, Permissions: map[int64]map[string][]string{
					key.OrgId: {
						"serviceaccounts:read": {"serviceaccounts:id:*"},
					},
				}})
				require.NoError(t, err)
				saId = serviceAccounts.ServiceAccounts[0].Id
			}

			err = store.RevertApiKey(context.Background(), saId, key.Id)

			if c.expectedErr != nil {
				require.ErrorIs(t, err, c.expectedErr)
			} else {
				require.NoError(t, err)

				serviceAccounts, err := store.SearchOrgServiceAccounts(context.Background(), key.OrgId, "", "all", 1, 50, &user.SignedInUser{UserID: 1, OrgID: 1, Permissions: map[int64]map[string][]string{
					key.OrgId: {
						"serviceaccounts:read": {"serviceaccounts:id:*"},
					},
				}})
				require.NoError(t, err)
				// Service account should be deleted
				require.Equal(t, int64(0), serviceAccounts.TotalCount)

				apiKeys, err := store.apiKeyService.GetAllAPIKeys(context.Background(), 1)
				require.NoError(t, err)
				require.Len(t, apiKeys, 1)
				apiKey := apiKeys[0]
				require.Equal(t, c.key.Name, apiKey.Name)
				require.Equal(t, c.key.OrgId, apiKey.OrgId)
				require.Equal(t, c.key.Role, apiKey.Role)
				require.Equal(t, key.Key, apiKey.Key)
				// Api key should not be linked to service account
				require.Nil(t, apiKey.ServiceAccountId)
			}
		})
	}
}
