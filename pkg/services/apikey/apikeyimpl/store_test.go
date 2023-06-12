package apikeyimpl

import (
	"context"
	"fmt"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/apikey"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/setting"
)

type getStore func(db.DB, *setting.Cfg) store

type getApiKeysTestCase struct {
	desc               string
	user               *user.SignedInUser
	expectedNumKeys    int
	expectedAllNumKeys int
}

func mockTimeNow() {
	var timeSeed int64
	timeNow = func() time.Time {
		loc := time.FixedZone("MockZoneUTC-5", -5*60*60)
		fakeNow := time.Unix(timeSeed, 0).In(loc)
		timeSeed++
		return fakeNow
	}
}

func resetTimeNow() {
	timeNow = time.Now
}

func seedApiKeys(t *testing.T, store store, num int) {
	t.Helper()

	for i := 0; i < num; i++ {
		_, err := store.AddAPIKey(context.Background(), &apikey.AddCommand{
			Name:  fmt.Sprintf("key:%d", i),
			Key:   fmt.Sprintf("key:%d", i),
			OrgID: 1,
		})
		require.NoError(t, err)
	}
}

func testIntegrationApiKeyDataAccess(t *testing.T, fn getStore) {
	t.Helper()

	mockTimeNow()
	defer resetTimeNow()

	t.Run("Testing API Key data access", func(t *testing.T) {
		db := db.InitTestDB(t)
		ss := fn(db, db.Cfg)

		t.Run("Given saved api key", func(t *testing.T) {
			cmd := apikey.AddCommand{OrgID: 1, Name: "hello", Key: "asd"}
			_, err := ss.AddAPIKey(context.Background(), &cmd)
			assert.Nil(t, err)

			t.Run("Should be able to get key by name", func(t *testing.T) {
				query := apikey.GetByNameQuery{KeyName: "hello", OrgID: 1}
				key, err := ss.GetApiKeyByName(context.Background(), &query)

				assert.Nil(t, err)
				assert.NotNil(t, key)
			})

			t.Run("Should be able to get key by hash", func(t *testing.T) {
				key, err := ss.GetAPIKeyByHash(context.Background(), cmd.Key)

				assert.Nil(t, err)
				assert.NotNil(t, key)
			})
			t.Run("Should be able to delete key by id", func(t *testing.T) {
				key, err := ss.GetAPIKeyByHash(context.Background(), cmd.Key)
				assert.NoError(t, err)
				err = ss.DeleteApiKey(context.Background(), &apikey.DeleteCommand{ID: key.ID, OrgID: key.OrgID})
				assert.NoError(t, err)
			})
		})

		t.Run("Add non expiring key", func(t *testing.T) {
			cmd := apikey.AddCommand{OrgID: 1, Name: "non-expiring", Key: "asd1", SecondsToLive: 0}
			_, err := ss.AddAPIKey(context.Background(), &cmd)
			assert.Nil(t, err)

			query := apikey.GetByNameQuery{KeyName: "non-expiring", OrgID: 1}
			key, err := ss.GetApiKeyByName(context.Background(), &query)
			assert.Nil(t, err)
			assert.Nil(t, key.Expires)
		})

		t.Run("Add an expiring key", func(t *testing.T) {
			// expires in one hour
			cmd := apikey.AddCommand{OrgID: 1, Name: "expiring-in-an-hour", Key: "asd2", SecondsToLive: 3600}
			_, err := ss.AddAPIKey(context.Background(), &cmd)
			assert.Nil(t, err)

			query := apikey.GetByNameQuery{KeyName: "expiring-in-an-hour", OrgID: 1}
			key, err := ss.GetApiKeyByName(context.Background(), &query)
			assert.Nil(t, err)

			assert.True(t, *key.Expires >= timeNow().Unix())

			// timeNow() has been called twice since creation; once by AddAPIKey and once by GetApiKeyByName
			// therefore two seconds should be subtracted by next value returned by timeNow()
			// that equals the number by which timeSeed has been advanced
			then := timeNow().Add(-2 * time.Second)
			expected := then.Add(1 * time.Hour).UTC().Unix()
			assert.Equal(t, *key.Expires, expected)
		})

		t.Run("Last Used At datetime update", func(t *testing.T) {
			// expires in one hour
			cmd := apikey.AddCommand{OrgID: 1, Name: "last-update-at", Key: "asd3", SecondsToLive: 3600}
			key, err := ss.AddAPIKey(context.Background(), &cmd)
			require.NoError(t, err)

			assert.Nil(t, key.LastUsedAt)

			err = ss.UpdateAPIKeyLastUsedDate(context.Background(), key.ID)
			require.NoError(t, err)

			query := apikey.GetByNameQuery{KeyName: "last-update-at", OrgID: 1}
			key, err = ss.GetApiKeyByName(context.Background(), &query)
			assert.Nil(t, err)
			assert.NotNil(t, key.LastUsedAt)
		})

		t.Run("Add a key with negative lifespan", func(t *testing.T) {
			// expires in one day
			cmd := apikey.AddCommand{OrgID: 1, Name: "key-with-negative-lifespan", Key: "asd3", SecondsToLive: -3600}
			_, err := ss.AddAPIKey(context.Background(), &cmd)
			assert.EqualError(t, err, apikey.ErrInvalidExpiration.Error())

			query := apikey.GetByNameQuery{KeyName: "key-with-negative-lifespan", OrgID: 1}
			_, err = ss.GetApiKeyByName(context.Background(), &query)
			assert.EqualError(t, err, "invalid API key")
		})

		t.Run("Add keys", func(t *testing.T) {
			// never expires
			cmd := apikey.AddCommand{OrgID: 1, Name: "key1", Key: "key1", SecondsToLive: 0}
			_, err := ss.AddAPIKey(context.Background(), &cmd)
			assert.Nil(t, err)

			// expires in 1s
			cmd = apikey.AddCommand{OrgID: 1, Name: "key2", Key: "key2", SecondsToLive: 1}
			_, err = ss.AddAPIKey(context.Background(), &cmd)
			assert.Nil(t, err)

			// expires in one hour
			cmd = apikey.AddCommand{OrgID: 1, Name: "key3", Key: "key3", SecondsToLive: 3600}
			_, err = ss.AddAPIKey(context.Background(), &cmd)
			assert.Nil(t, err)

			// advance mocked getTime by 1s
			timeNow()

			testUser := &user.SignedInUser{
				OrgID: 1,
				Permissions: map[int64]map[string][]string{
					1: {accesscontrol.ActionAPIKeyRead: []string{accesscontrol.ScopeAPIKeysAll}},
				},
			}
			query := apikey.GetApiKeysQuery{OrgID: 1, IncludeExpired: false, User: testUser}
			keys, err := ss.GetAPIKeys(context.Background(), &query)
			assert.Nil(t, err)

			for _, k := range keys {
				if k.Name == "key2" {
					t.Fatalf("key2 should not be there")
				}
			}

			query = apikey.GetApiKeysQuery{OrgID: 1, IncludeExpired: true, User: testUser}
			keys, err = ss.GetAPIKeys(context.Background(), &query)
			assert.Nil(t, err)

			found := false
			for _, k := range keys {
				if k.Name == "key2" {
					found = true
				}
			}
			assert.True(t, found)
		})
	})

	t.Run("Testing API Key errors", func(t *testing.T) {
		db := db.InitTestDB(t)
		ss := fn(db, db.Cfg)

		t.Run("Delete non-existing key should return error", func(t *testing.T) {
			cmd := apikey.DeleteCommand{ID: 1}
			err := ss.DeleteApiKey(context.Background(), &cmd)

			assert.EqualError(t, err, apikey.ErrNotFound.Error())
		})

		t.Run("Testing API Duplicate Key Errors", func(t *testing.T) {
			t.Run("Given saved api key", func(t *testing.T) {
				cmd := apikey.AddCommand{OrgID: 0, Name: "duplicate", Key: "asd"}
				_, err := ss.AddAPIKey(context.Background(), &cmd)
				assert.Nil(t, err)

				t.Run("Add API Key with existing Org ID and Name", func(t *testing.T) {
					cmd := apikey.AddCommand{OrgID: 0, Name: "duplicate", Key: "asd"}
					_, err = ss.AddAPIKey(context.Background(), &cmd)
					assert.EqualError(t, err, apikey.ErrDuplicate.Error())
				})
			})
		})
	})

	t.Run("Testing Get API keys", func(t *testing.T) {
		tests := []getApiKeysTestCase{
			{
				desc: "expect all keys for wildcard scope",
				user: &user.SignedInUser{OrgID: 1, Permissions: map[int64]map[string][]string{
					1: {"apikeys:read": {"apikeys:*"}},
				}},
				expectedNumKeys:    10,
				expectedAllNumKeys: 10,
			},
			{
				desc: "expect only api keys that user have scopes for",
				user: &user.SignedInUser{OrgID: 1, Permissions: map[int64]map[string][]string{
					1: {"apikeys:read": {"apikeys:id:1", "apikeys:id:3"}},
				}},
				expectedNumKeys:    2,
				expectedAllNumKeys: 10,
			},
			{
				desc: "expect no keys when user have no scopes",
				user: &user.SignedInUser{OrgID: 1, Permissions: map[int64]map[string][]string{
					1: {"apikeys:read": {}},
				}},
				expectedNumKeys:    0,
				expectedAllNumKeys: 10,
			},
		}

		for _, tt := range tests {
			t.Run(tt.desc, func(t *testing.T) {
				db := db.InitTestDB(t, db.InitTestDBOpt{})
				store := fn(db, db.Cfg)
				seedApiKeys(t, store, 10)

				query := &apikey.GetApiKeysQuery{OrgID: 1, User: tt.user}
				keys, err := store.GetAPIKeys(context.Background(), query)
				require.NoError(t, err)
				assert.Len(t, keys, tt.expectedNumKeys)

				res, err := store.GetAllAPIKeys(context.Background(), 1)
				require.NoError(t, err)
				assert.Equal(t, tt.expectedAllNumKeys, len(res))
			})
		}
	})
}
