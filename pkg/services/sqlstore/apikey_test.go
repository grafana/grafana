package sqlstore

import (
	m "github.com/grafana/grafana/pkg/models"
	. "github.com/smartystreets/goconvey/convey"
	"testing"
	"time"
)

func TestApiKeyDataAccess(t *testing.T) {

	Convey("Testing API Key data access", t, func() {
		InitTestDB(t)

		Convey("Given saved api key", func() {
			cmd := m.AddApiKeyCommand{OrgId: 1, Name: "hello", Key: "asd"}
			err := AddApiKey(&cmd)
			So(err, ShouldBeNil)

			Convey("Should be able to get key by name", func() {
				query := m.GetApiKeyByNameQuery{KeyName: "hello", OrgId: 1}
				err = GetApiKeyByName(&query)

				So(err, ShouldBeNil)
				So(query.Result, ShouldNotBeNil)
			})

		})

		t.Run("Add non expiring key", func(t *testing.T) {
			cmd := m.AddApiKeyCommand{OrgId: 1, Name: "non-expiring", Key: "asd1", SecondsToLive: 0}
			err := AddApiKey(&cmd)
			if err != nil {
				t.Fatalf("expected to work %v", err)
			}
			query := m.GetApiKeyByNameQuery{KeyName: "non-expiring", OrgId: 1}
			err = GetApiKeyByName(&query)
			if err != nil {
				t.Fatalf("expected to be found")
			}
			if !query.Result.Expires.IsZero() {
				t.Fatalf("expires should be zero date")
			}
		})

		t.Run("Add an expiring key", func(t *testing.T) {
			//expires in one hour
			cmd := m.AddApiKeyCommand{OrgId: 1, Name: "expiring-in-an-hour", Key: "asd2", SecondsToLive: 3600}
			err := AddApiKey(&cmd)
			if err != nil {
				t.Fatalf("expected to work %v", err)
			}
			query := m.GetApiKeyByNameQuery{KeyName: "expiring-in-an-hour", OrgId: 1}
			err = GetApiKeyByName(&query)
			if err != nil {
				t.Fatalf("expected to be found %v", err)
			}
			if query.Result.Expires.Before(time.Now()) {
				t.Fatalf("expected not to expire")
			}
			if query.Result.Expires.After(time.Now().Add(time.Duration(2) * time.Hour)) {
				t.Fatalf("expected to be expired by then")
			}
		})

		t.Run("Add a key with invalid lifespan", func(t *testing.T) {
			//expires in one day
			cmd := m.AddApiKeyCommand{OrgId: 1, Name: "key-with-invalid-lifespan", Key: "asd3", SecondsToLive: -3600}
			err := AddApiKey(&cmd)
			if err != nil {
				t.Fatalf("expected to work %v", err)
			}
			query := m.GetApiKeyByNameQuery{KeyName: "key-with-invalid-lifespan", OrgId: 1}
			err = GetApiKeyByName(&query)
			if err != nil {
				t.Fatalf("expected to be found %v", err)
			}
			if !query.Result.Expires.IsZero() {
				t.Fatalf("expires should be a zero date")
			}
		})

		t.Run("Add keys", func(t *testing.T) {
			//never expires
			cmd := m.AddApiKeyCommand{OrgId: 1, Name: "key1", Key: "key1", SecondsToLive: 0}
			err := AddApiKey(&cmd)
			if err != nil {
				t.Fatalf("expected to work %v", err)
			}
			//expires in 1s
			cmd = m.AddApiKeyCommand{OrgId: 1, Name: "key2", Key: "key2", SecondsToLive: 1}
			err = AddApiKey(&cmd)
			if err != nil {
				t.Fatalf("expected to work %v", err)
			}
			//expires in one hour
			cmd = m.AddApiKeyCommand{OrgId: 1, Name: "key3", Key: "key3", SecondsToLive: 3600}
			err = AddApiKey(&cmd)
			if err != nil {
				t.Fatalf("expected to work %v", err)
			}

			// sleep for 1s
			time.Sleep(time.Second)

			query := m.GetApiKeysQuery{OrgId: 1, IncludeInvalid: false}
			err = GetApiKeys(&query)
			if err != nil {
				t.Fatalf("expected to succeed %v", err)
			}
			for _, k := range query.Result {
				if k.Name == "key2" {
					t.Fatalf("key2 should not be there")
				}
			}

			query = m.GetApiKeysQuery{OrgId: 1, IncludeInvalid: true}
			err = GetApiKeys(&query)
			if err != nil {
				t.Fatalf("expected to succeed %v", err)
			}

			found := false
			for _, k := range query.Result {
				if k.Name == "key2" {
					found = true
				}
			}
			if !found {
				t.Fatalf("key2 should be there")
			}

		})
	})
}
