package database

import (
	"context"
	"testing"

	"golang.org/x/exp/maps"

	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/services/ssosettings"
	"github.com/grafana/grafana/pkg/services/ssosettings/models"
	"github.com/stretchr/testify/require"
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

		err := insertSSOSetting(ssoSettingsStore, "azuread", map[string]interface{}{
			"enabled": true,
		})
		require.NoError(t, err)

		err = ssoSettingsStore.Delete(context.Background(), "azuread")

		require.NoError(t, err)

		var count int64
		err = sqlStore.WithDbSession(context.Background(), func(sess *db.Session) error {
			count, err = sess.Table("sso_setting").Where("is_deleted = ?", sqlStore.GetDialect().BooleanStr(true)).Count()
			return err
		})
		require.NoError(t, err)

		require.Equal(t, int64(1), count)
	})

	t.Run("return without error if the integration was not found", func(t *testing.T) {
		setup()

		err := ssoSettingsStore.Delete(context.Background(), "azuread")
		require.NoError(t, err)

		var count int64
		err = sqlStore.WithDbSession(context.Background(), func(sess *db.Session) error {
			count, err = sess.Table("sso_setting").Where("is_deleted = ?", sqlStore.GetDialect().BooleanStr(true)).Count()
			return err
		})
		require.NoError(t, err)

		require.Equal(t, int64(0), count)
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
