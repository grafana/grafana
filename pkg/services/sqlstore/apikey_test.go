//go:build integration
// +build integration

package sqlstore

import (
	"context"
	"fmt"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
)

func TestIntegrationApiKeyDataAccess(t *testing.T) {
	mockTimeNow()
	defer resetTimeNow()

	t.Run("Testing API Key data access", func(t *testing.T) {
		ss := InitTestDB(t)

		t.Run("Given saved api key", func(t *testing.T) {
			cmd := models.AddApiKeyCommand{OrgId: 1, Name: "hello", Key: "asd"}
			err := ss.AddAPIKey(context.Background(), &cmd)
			assert.Nil(t, err)

			t.Run("Should be able to get key by name", func(t *testing.T) {
				query := models.GetApiKeyByNameQuery{KeyName: "hello", OrgId: 1}
				err = ss.GetApiKeyByName(context.Background(), &query)

				assert.Nil(t, err)
				assert.NotNil(t, query.Result)
			})

			t.Run("Should be able to get key by hash", func(t *testing.T) {
				key, err := ss.GetAPIKeyByHash(context.Background(), cmd.Key)

				assert.Nil(t, err)
				assert.NotNil(t, key)
			})
		})

		t.Run("Add non expiring key", func(t *testing.T) {
			cmd := models.AddApiKeyCommand{OrgId: 1, Name: "non-expiring", Key: "asd1", SecondsToLive: 0}
			err := ss.AddAPIKey(context.Background(), &cmd)
			assert.Nil(t, err)

			query := models.GetApiKeyByNameQuery{KeyName: "non-expiring", OrgId: 1}
			err = ss.GetApiKeyByName(context.Background(), &query)
			assert.Nil(t, err)

			assert.Nil(t, query.Result.Expires)
		})

		t.Run("Add an expiring key", func(t *testing.T) {
			// expires in one hour
			cmd := models.AddApiKeyCommand{OrgId: 1, Name: "expiring-in-an-hour", Key: "asd2", SecondsToLive: 3600}
			err := ss.AddAPIKey(context.Background(), &cmd)
			assert.Nil(t, err)

			query := models.GetApiKeyByNameQuery{KeyName: "expiring-in-an-hour", OrgId: 1}
			err = ss.GetApiKeyByName(context.Background(), &query)
			assert.Nil(t, err)

			assert.True(t, *query.Result.Expires >= timeNow().Unix())

			// timeNow() has been called twice since creation; once by AddAPIKey and once by GetApiKeyByName
			// therefore two seconds should be subtracted by next value returned by timeNow()
			// that equals the number by which timeSeed has been advanced
			then := timeNow().Add(-2 * time.Second)
			expected := then.Add(1 * time.Hour).UTC().Unix()
			assert.Equal(t, *query.Result.Expires, expected)
		})

		t.Run("Add a key with negative lifespan", func(t *testing.T) {
			// expires in one day
			cmd := models.AddApiKeyCommand{OrgId: 1, Name: "key-with-negative-lifespan", Key: "asd3", SecondsToLive: -3600}
			err := ss.AddAPIKey(context.Background(), &cmd)
			assert.EqualError(t, err, models.ErrInvalidApiKeyExpiration.Error())

			query := models.GetApiKeyByNameQuery{KeyName: "key-with-negative-lifespan", OrgId: 1}
			err = ss.GetApiKeyByName(context.Background(), &query)
			assert.EqualError(t, err, "invalid API key")
		})

		t.Run("Add keys", func(t *testing.T) {
			// never expires
			cmd := models.AddApiKeyCommand{OrgId: 1, Name: "key1", Key: "key1", SecondsToLive: 0}
			err := ss.AddAPIKey(context.Background(), &cmd)
			assert.Nil(t, err)

			// expires in 1s
			cmd = models.AddApiKeyCommand{OrgId: 1, Name: "key2", Key: "key2", SecondsToLive: 1}
			err = ss.AddAPIKey(context.Background(), &cmd)
			assert.Nil(t, err)

			// expires in one hour
			cmd = models.AddApiKeyCommand{OrgId: 1, Name: "key3", Key: "key3", SecondsToLive: 3600}
			err = ss.AddAPIKey(context.Background(), &cmd)
			assert.Nil(t, err)

			// advance mocked getTime by 1s
			timeNow()

			testUser := &models.SignedInUser{
				OrgId: 1,
				Permissions: map[int64]map[string][]string{
					1: {accesscontrol.ActionAPIKeyRead: []string{accesscontrol.ScopeAPIKeysAll}},
				},
			}
			query := models.GetApiKeysQuery{OrgId: 1, IncludeExpired: false, User: testUser}
			err = ss.GetAPIKeys(context.Background(), &query)
			assert.Nil(t, err)

			for _, k := range query.Result {
				if k.Name == "key2" {
					t.Fatalf("key2 should not be there")
				}
			}

			query = models.GetApiKeysQuery{OrgId: 1, IncludeExpired: true, User: testUser}
			err = ss.GetAPIKeys(context.Background(), &query)
			assert.Nil(t, err)

			found := false
			for _, k := range query.Result {
				if k.Name == "key2" {
					found = true
				}
			}
			assert.True(t, found)
		})
	})
}

func TestIntegrationApiKeyErrors(t *testing.T) {
	mockTimeNow()
	defer resetTimeNow()

	t.Run("Testing API Key errors", func(t *testing.T) {
		ss := InitTestDB(t)

		t.Run("Delete non-existing key should return error", func(t *testing.T) {
			cmd := models.DeleteApiKeyCommand{Id: 1}
			err := ss.DeleteApiKey(context.Background(), &cmd)

			assert.EqualError(t, err, models.ErrApiKeyNotFound.Error())
		})

		t.Run("Testing API Duplicate Key Errors", func(t *testing.T) {
			t.Run("Given saved api key", func(t *testing.T) {
				cmd := models.AddApiKeyCommand{OrgId: 0, Name: "duplicate", Key: "asd"}
				err := ss.AddAPIKey(context.Background(), &cmd)
				assert.Nil(t, err)

				t.Run("Add API Key with existing Org ID and Name", func(t *testing.T) {
					cmd := models.AddApiKeyCommand{OrgId: 0, Name: "duplicate", Key: "asd"}
					err = ss.AddAPIKey(context.Background(), &cmd)
					assert.EqualError(t, err, models.ErrDuplicateApiKey.Error())
				})
			})
		})
	})
}

type getApiKeysTestCase struct {
	desc            string
	user            *models.SignedInUser
	expectedNumKeys int
}

func TestIntegrationSQLStore_GetAPIKeys(t *testing.T) {
	tests := []getApiKeysTestCase{
		{
			desc: "expect all keys for wildcard scope",
			user: &models.SignedInUser{OrgId: 1, Permissions: map[int64]map[string][]string{
				1: {"apikeys:read": {"apikeys:*"}},
			}},
			expectedNumKeys: 10,
		},
		{
			desc: "expect only api keys that user have scopes for",
			user: &models.SignedInUser{OrgId: 1, Permissions: map[int64]map[string][]string{
				1: {"apikeys:read": {"apikeys:id:1", "apikeys:id:3"}},
			}},
			expectedNumKeys: 2,
		},
		{
			desc: "expect no keys when user have no scopes",
			user: &models.SignedInUser{OrgId: 1, Permissions: map[int64]map[string][]string{
				1: {"apikeys:read": {}},
			}},
			expectedNumKeys: 0,
		},
	}

	for _, tt := range tests {
		t.Run(tt.desc, func(t *testing.T) {
			store := InitTestDB(t, InitTestDBOpt{})
			seedApiKeys(t, store, 10)

			query := &models.GetApiKeysQuery{OrgId: 1, User: tt.user}
			err := store.GetAPIKeys(context.Background(), query)
			require.NoError(t, err)
			assert.Len(t, query.Result, tt.expectedNumKeys)
		})
	}
}

func seedApiKeys(t *testing.T, store *SQLStore, num int) {
	t.Helper()

	for i := 0; i < num; i++ {
		err := store.AddAPIKey(context.Background(), &models.AddApiKeyCommand{
			Name:  fmt.Sprintf("key:%d", i),
			Key:   fmt.Sprintf("key:%d", i),
			OrgId: 1,
		})
		require.NoError(t, err)
	}
}
