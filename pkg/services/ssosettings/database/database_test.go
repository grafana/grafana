package database

import (
	"context"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/stretchr/testify/require"
	"golang.org/x/exp/maps"

	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/services/ssosettings"
	"github.com/grafana/grafana/pkg/services/ssosettings/models"
)

func TestIntegrationGetSSOSettings(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}

	var sqlStore *sqlstore.SQLStore
	var ssoSettingsStore *SSOSettingsStore

	setup := func() {
		sqlStore = db.InitTestDB(t)
		ssoSettingsStore = ProvideStore(sqlStore)

		err := insertSSOSetting(ssoSettingsStore, "azuread", nil)
		require.NoError(t, err)
	}

	t.Run("returns existing SSO settings", func(t *testing.T) {
		setup()

		expected := &models.SSOSetting{
			Provider: "azuread",
			Settings: map[string]interface{}{
				"enabled": true,
			},
		}

		actual, err := ssoSettingsStore.Get(context.Background(), "azuread")
		require.NoError(t, err)

		require.True(t, maps.Equal(expected.Settings, actual.Settings))
	})

	t.Run("returns not found if the SSO setting is missing for the specified provider", func(t *testing.T) {
		setup()

		_, err := ssoSettingsStore.Get(context.Background(), "okta")
		require.ErrorAs(t, err, &ssosettings.ErrNotFound)
	})

	t.Run("returns not found if the SSO setting is soft deleted for the specified provider", func(t *testing.T) {
		setup()
		err := ssoSettingsStore.Delete(context.Background(), "azuread")
		require.NoError(t, err)

		_, err = ssoSettingsStore.Get(context.Background(), "azuread")
		require.ErrorAs(t, err, &ssosettings.ErrNotFound)
	})
}

func TestIntegrationUpsertSSOSettings(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}

	var sqlStore *sqlstore.SQLStore
	var ssoSettingsStore *SSOSettingsStore

	setup := func() {
		sqlStore = db.InitTestDB(t)
		ssoSettingsStore = ProvideStore(sqlStore)
	}

	t.Run("insert a new SSO setting successfully", func(t *testing.T) {
		setup()

		expected := &models.SSOSetting{
			Provider: "azuread",
			Settings: map[string]interface{}{
				"enabled": true,
			},
		}

		err := ssoSettingsStore.Upsert(context.Background(), "azuread", map[string]interface{}{
			"enabled": true,
		})
		require.NoError(t, err)

		actual, err := ssoSettingsStore.Get(context.Background(), "azuread")
		require.NoError(t, err)

		require.True(t, maps.Equal(expected.Settings, actual.Settings))
	})

	t.Run("replaces an existing SSO setting for the specified provider", func(t *testing.T) {
		setup()

		err := ssoSettingsStore.Upsert(context.Background(), "azuread", map[string]interface{}{
			"enabled": true,
		})
		require.NoError(t, err)

		err = ssoSettingsStore.Upsert(context.Background(), "azuread", map[string]interface{}{
			"enabled": false,
		})
		require.NoError(t, err)

		actual, err := ssoSettingsStore.Get(context.Background(), "azuread")
		require.NoError(t, err)

		list, err := ssoSettingsStore.List(context.Background())
		require.NoError(t, err)

		require.Equal(t, 1, len(list))
		require.Equal(t, false, actual.Settings["enabled"])
	})
}

func TestIntegrationListSSOSettings(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}

	var sqlStore *sqlstore.SQLStore
	var ssoSettingsStore *SSOSettingsStore

	setup := func() {
		sqlStore = db.InitTestDB(t)
		ssoSettingsStore = ProvideStore(sqlStore)

		err := insertSSOSetting(ssoSettingsStore, "azuread", map[string]interface{}{
			"enabled": true,
		})
		require.NoError(t, err)

		err = insertSSOSetting(ssoSettingsStore, "okta", map[string]interface{}{
			"enabled": false,
		})
		require.NoError(t, err)
	}

	t.Run("returns every SSO settings successfully", func(t *testing.T) {
		setup()

		list, err := ssoSettingsStore.List(context.Background())

		require.NoError(t, err)
		require.Equal(t, 2, len(list))
	})
}

func TestIntegrationDeleteSSOSettings(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}

	var sqlStore *sqlstore.SQLStore
	var ssoSettingsStore *SSOSettingsStore

	setup := func() {
		sqlStore = db.InitTestDB(t)
		ssoSettingsStore = ProvideStore(sqlStore)
	}

	t.Run("soft deletes the settings successfully", func(t *testing.T) {
		setup()

		providers := []string{"azuread", "github", "google"}

		err := populateSSOSettings(sqlStore, false, providers...)
		require.NoError(t, err)

		err = ssoSettingsStore.Delete(context.Background(), providers[0])
		require.NoError(t, err)

		deleted, err := getSSOSettingsCountByDeleted(sqlStore, true)
		require.NoError(t, err)
		require.EqualValues(t, 1, deleted)

		notDeleted, err := getSSOSettingsCountByDeleted(sqlStore, false)
		require.NoError(t, err)
		require.EqualValues(t, len(providers)-1, notDeleted)
	})

	t.Run("return not found if the provider doesn't exist in db", func(t *testing.T) {
		setup()

		providers := []string{"github", "google", "okta"}
		invalidProvider := "azuread"

		err := populateSSOSettings(sqlStore, false, providers...)
		require.NoError(t, err)

		err = ssoSettingsStore.Delete(context.Background(), invalidProvider)
		require.Error(t, err)
		require.ErrorIs(t, err, ssosettings.ErrNotFound)

		deleted, err := getSSOSettingsCountByDeleted(sqlStore, true)
		require.NoError(t, err)
		require.EqualValues(t, 0, deleted)

		notDeleted, err := getSSOSettingsCountByDeleted(sqlStore, false)
		require.NoError(t, err)
		require.EqualValues(t, len(providers), notDeleted)
	})

	t.Run("return not found if the provider sso settings are already deleted", func(t *testing.T) {
		setup()

		providers := []string{"azuread", "github", "google"}

		err := populateSSOSettings(sqlStore, true, providers...)
		require.NoError(t, err)

		err = ssoSettingsStore.Delete(context.Background(), providers[0])
		require.Error(t, err)
		require.ErrorIs(t, err, ssosettings.ErrNotFound)

		deleted, err := getSSOSettingsCountByDeleted(sqlStore, true)
		require.NoError(t, err)
		require.EqualValues(t, len(providers), deleted)
	})

	t.Run("delete one record if more valid sso settings are available for a provider", func(t *testing.T) {
		setup()

		provider := "azuread"

		// insert sso for the same provider 2 times in the database
		err := populateSSOSettings(sqlStore, false, provider)
		require.NoError(t, err)
		err = populateSSOSettings(sqlStore, false, provider)
		require.NoError(t, err)

		err = ssoSettingsStore.Delete(context.Background(), provider)
		require.NoError(t, err)

		deleted, err := getSSOSettingsCountByDeleted(sqlStore, true)
		require.NoError(t, err)
		require.EqualValues(t, 1, deleted)

		notDeleted, err := getSSOSettingsCountByDeleted(sqlStore, false)
		require.NoError(t, err)
		require.EqualValues(t, 1, notDeleted)
	})
}

func insertSSOSetting(ssoSettingsStore ssosettings.Store, provider string, settings map[string]interface{}) error {
	if settings == nil {
		settings = map[string]interface{}{
			"enabled": true,
		}
	}
	return ssoSettingsStore.Upsert(context.Background(), provider, settings)
}

func populateSSOSettings(sqlStore *sqlstore.SQLStore, deleted bool, providers ...string) error {
	return sqlStore.WithDbSession(context.Background(), func(sess *db.Session) error {
		for _, provider := range providers {
			_, err := sess.Insert(&models.SSOSetting{
				ID:        uuid.New().String(),
				Provider:  provider,
				Created:   time.Now().UTC(),
				IsDeleted: deleted,
			})
			if err != nil {
				return err
			}
		}
		return nil
	})
}

func getSSOSettingsCountByDeleted(sqlStore *sqlstore.SQLStore, deleted bool) (int64, error) {
	var count int64
	var err error

	err = sqlStore.WithDbSession(context.Background(), func(sess *db.Session) error {
		count, err = sess.Table("sso_setting").Where("is_deleted = ?", sqlStore.GetDialect().BooleanStr(deleted)).Count()
		return err
	})

	return count, err
}
