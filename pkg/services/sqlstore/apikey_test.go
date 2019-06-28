package sqlstore

import (
	"github.com/grafana/grafana/pkg/models"
	"github.com/stretchr/testify/assert"
	"testing"
	"time"
)

func TestApiKeyDataAccess(t *testing.T) {
	mockTimeNow()
	defer resetTimeNow()

	t.Run("Testing API Key data access", func(t *testing.T) {
		InitTestDB(t)

		t.Run("Given saved api key", func(t *testing.T) {
			cmd := models.AddApiKeyCommand{OrgId: 1, Name: "hello", Key: "asd"}
			err := AddApiKey(&cmd)
			assert.Nil(t, err)

			t.Run("Should be able to get key by name", func(t *testing.T) {
				query := models.GetApiKeyByNameQuery{KeyName: "hello", OrgId: 1}
				err = GetApiKeyByName(&query)

				assert.Nil(t, err)
				assert.NotNil(t, query.Result)
			})

		})

		t.Run("Add non expiring key", func(t *testing.T) {
			cmd := models.AddApiKeyCommand{OrgId: 1, Name: "non-expiring", Key: "asd1", SecondsToLive: 0}
			err := AddApiKey(&cmd)
			assert.Nil(t, err)

			query := models.GetApiKeyByNameQuery{KeyName: "non-expiring", OrgId: 1}
			err = GetApiKeyByName(&query)
			assert.Nil(t, err)

			assert.Nil(t, query.Result.Expires)
		})

		t.Run("Add an expiring key", func(t *testing.T) {
			//expires in one hour
			cmd := models.AddApiKeyCommand{OrgId: 1, Name: "expiring-in-an-hour", Key: "asd2", SecondsToLive: 3600}
			err := AddApiKey(&cmd)
			assert.Nil(t, err)

			query := models.GetApiKeyByNameQuery{KeyName: "expiring-in-an-hour", OrgId: 1}
			err = GetApiKeyByName(&query)
			assert.Nil(t, err)

			assert.True(t, *query.Result.Expires >= timeNow().Unix())

			// timeNow() has been called twice since creation; once by AddApiKey and once by GetApiKeyByName
			// therefore two seconds should be subtracted by next value retuned by timeNow()
			// that equals the number by which timeSeed has been advanced
			then := timeNow().Add(-2 * time.Second)
			expected := then.Add(1 * time.Hour).UTC().Unix()
			assert.Equal(t, *query.Result.Expires, expected)
		})

		t.Run("Add a key with negative lifespan", func(t *testing.T) {
			//expires in one day
			cmd := models.AddApiKeyCommand{OrgId: 1, Name: "key-with-negative-lifespan", Key: "asd3", SecondsToLive: -3600}
			err := AddApiKey(&cmd)
			assert.EqualError(t, err, models.ErrInvalidApiKeyExpiration.Error())

			query := models.GetApiKeyByNameQuery{KeyName: "key-with-negative-lifespan", OrgId: 1}
			err = GetApiKeyByName(&query)
			assert.EqualError(t, err, "Invalid API Key")
		})

		t.Run("Add keys", func(t *testing.T) {
			//never expires
			cmd := models.AddApiKeyCommand{OrgId: 1, Name: "key1", Key: "key1", SecondsToLive: 0}
			err := AddApiKey(&cmd)
			assert.Nil(t, err)

			//expires in 1s
			cmd = models.AddApiKeyCommand{OrgId: 1, Name: "key2", Key: "key2", SecondsToLive: 1}
			err = AddApiKey(&cmd)
			assert.Nil(t, err)

			//expires in one hour
			cmd = models.AddApiKeyCommand{OrgId: 1, Name: "key3", Key: "key3", SecondsToLive: 3600}
			err = AddApiKey(&cmd)
			assert.Nil(t, err)

			// advance mocked getTime by 1s
			timeNow()

			query := models.GetApiKeysQuery{OrgId: 1, IncludeInvalid: false}
			err = GetApiKeys(&query)
			assert.Nil(t, err)

			for _, k := range query.Result {
				if k.Name == "key2" {
					t.Fatalf("key2 should not be there")
				}
			}

			query = models.GetApiKeysQuery{OrgId: 1, IncludeInvalid: true}
			err = GetApiKeys(&query)
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
