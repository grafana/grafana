package database

import (
	"context"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/services/ssosettings"
	"github.com/grafana/grafana/pkg/services/ssosettings/models"
	"github.com/grafana/grafana/pkg/tests/testsuite"
)

const (
	withinDuration = 5 * time.Minute
)

func TestMain(m *testing.M) {
	testsuite.Run(m)
}

func TestIntegrationGetSSOSettings(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}

	var sqlStore db.DB
	var ssoSettingsStore *SSOSettingsStore

	setup := func() {
		sqlStore = db.InitTestDB(t)
		ssoSettingsStore = ProvideStore(sqlStore)

		template := models.SSOSettings{
			Settings: map[string]any{"enabled": true},
		}
		err := populateSSOSettings(sqlStore, template, "azuread", "github", "google")
		require.NoError(t, err)
	}

	t.Run("returns existing SSO settings", func(t *testing.T) {
		setup()

		expected := &models.SSOSettings{
			Provider: "azuread",
			Settings: map[string]any{"enabled": true},
		}

		actual, err := ssoSettingsStore.Get(context.Background(), "azuread")
		require.NoError(t, err)

		require.EqualValues(t, expected.Settings, actual.Settings)
	})

	t.Run("returns not found if the SSO setting is missing for the specified provider", func(t *testing.T) {
		setup()

		_, err := ssoSettingsStore.Get(context.Background(), "okta")
		require.ErrorAs(t, err, &ssosettings.ErrNotFound)
	})

	t.Run("returns not found if the SSO setting is soft deleted for the specified provider", func(t *testing.T) {
		setup()

		provider := "okta"
		template := models.SSOSettings{
			Settings:  map[string]any{"enabled": true},
			IsDeleted: true,
		}
		err := populateSSOSettings(sqlStore, template, provider)
		require.NoError(t, err)

		_, err = ssoSettingsStore.Get(context.Background(), provider)
		require.ErrorAs(t, err, &ssosettings.ErrNotFound)
	})

	t.Run("returns not found if the specified provider is empty", func(t *testing.T) {
		setup()

		_, err := ssoSettingsStore.Get(context.Background(), "")
		require.ErrorAs(t, err, &ssosettings.ErrNotFound)
	})
}

func TestIntegrationUpsertSSOSettings(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}

	var sqlStore db.DB
	var ssoSettingsStore *SSOSettingsStore

	setup := func() {
		sqlStore = db.InitTestDB(t)
		ssoSettingsStore = ProvideStore(sqlStore)
	}

	t.Run("insert a new SSO setting successfully", func(t *testing.T) {
		setup()

		settings := models.SSOSettings{
			Provider: "azuread",
			Settings: map[string]any{
				"enabled":   true,
				"client_id": "azuread-client",
			},
		}

		err := ssoSettingsStore.Upsert(context.Background(), &settings)
		require.NoError(t, err)

		actual, err := getSSOSettingsByProvider(sqlStore, settings.Provider, false)
		require.NoError(t, err)
		require.EqualValues(t, settings.Settings, actual.Settings)
		require.NotEmpty(t, actual.ID)
		require.WithinDuration(t, time.Now().UTC(), actual.Created, withinDuration)
		require.WithinDuration(t, time.Now().UTC(), actual.Updated, withinDuration)

		deleted, notDeleted, err := getSSOSettingsCountByDeleted(sqlStore)
		require.NoError(t, err)
		require.EqualValues(t, 0, deleted)
		require.EqualValues(t, 1, notDeleted)
	})

	t.Run("replaces an existing SSO setting for the specified provider", func(t *testing.T) {
		setup()

		provider := "github"
		template := models.SSOSettings{
			Settings: map[string]any{
				"enabled":       true,
				"client_id":     "github-client",
				"client_secret": "this-is-a-secret",
			},
		}
		err := populateSSOSettings(sqlStore, template, provider)
		require.NoError(t, err)

		newSettings := models.SSOSettings{
			Provider: provider,
			Settings: map[string]any{
				"enabled":       true,
				"client_id":     "new-github-client",
				"client_secret": "this-is-a-new-secret",
			},
		}
		err = ssoSettingsStore.Upsert(context.Background(), &newSettings)
		require.NoError(t, err)

		actual, err := getSSOSettingsByProvider(sqlStore, provider, false)
		require.NoError(t, err)
		require.EqualValues(t, newSettings.Settings, actual.Settings)
		require.WithinDuration(t, time.Now().UTC(), actual.Updated, withinDuration)

		deleted, notDeleted, err := getSSOSettingsCountByDeleted(sqlStore)
		require.NoError(t, err)
		require.EqualValues(t, 0, deleted)
		require.EqualValues(t, 1, notDeleted)
	})

	t.Run("trying to update a deleted SSO Settings will insert a new record", func(t *testing.T) {
		setup()

		provider := "azuread"
		template := models.SSOSettings{
			Settings: map[string]any{
				"enabled":       true,
				"client_id":     "azuread-client",
				"client_secret": "this-is-a-secret",
			},
			IsDeleted: true,
		}
		err := populateSSOSettings(sqlStore, template, provider)
		require.NoError(t, err)

		newSettings := models.SSOSettings{
			Provider: provider,
			Settings: map[string]any{
				"enabled":       true,
				"client_id":     "new-azuread-client",
				"client_secret": "this-is-a-new-secret",
			},
		}

		err = ssoSettingsStore.Upsert(context.Background(), &newSettings)
		require.NoError(t, err)

		actual, err := getSSOSettingsByProvider(sqlStore, provider, false)
		require.NoError(t, err)
		require.EqualValues(t, newSettings.Settings, actual.Settings)
		require.WithinDuration(t, time.Now().UTC(), actual.Created, withinDuration)
		require.WithinDuration(t, time.Now().UTC(), actual.Updated, withinDuration)

		old, err := getSSOSettingsByProvider(sqlStore, provider, true)
		require.NoError(t, err)
		require.EqualValues(t, template.Settings, old.Settings)
	})

	t.Run("replaces the settings only for the specified provider leaving the other provider's settings unchanged", func(t *testing.T) {
		setup()

		providers := []string{"github", "gitlab", "google"}
		template := models.SSOSettings{
			Settings: map[string]any{
				"enabled":       true,
				"client_id":     "my-client",
				"client_secret": "this-is-a-secret",
			},
		}
		err := populateSSOSettings(sqlStore, template, providers...)
		require.NoError(t, err)

		newSettings := models.SSOSettings{
			Provider: providers[0],
			Settings: map[string]any{
				"enabled":       true,
				"client_id":     "my-new-client",
				"client_secret": "this-is-my-new-secret",
			},
		}
		err = ssoSettingsStore.Upsert(context.Background(), &newSettings)
		require.NoError(t, err)

		actual, err := getSSOSettingsByProvider(sqlStore, providers[0], false)
		require.NoError(t, err)
		require.EqualValues(t, newSettings.Settings, actual.Settings)
		require.WithinDuration(t, time.Now().UTC(), actual.Updated, withinDuration)

		for index := 1; index < len(providers); index++ {
			existing, err := getSSOSettingsByProvider(sqlStore, providers[index], false)
			require.NoError(t, err)
			require.EqualValues(t, template.Settings, existing.Settings)
		}
	})

	t.Run("fails if the provider is empty", func(t *testing.T) {
		setup()

		template := models.SSOSettings{
			Settings: map[string]any{
				"enabled":       true,
				"client_id":     "azuread-client",
				"client_secret": "this-is-a-secret",
			},
			IsDeleted: true,
		}
		err := populateSSOSettings(sqlStore, template, "azuread")
		require.NoError(t, err)

		settings := models.SSOSettings{
			Provider: "",
			Settings: map[string]any{
				"enabled":   true,
				"client_id": "new-client",
			},
		}

		err = ssoSettingsStore.Upsert(context.Background(), &settings)
		require.Error(t, err)
		require.ErrorIs(t, err, ssosettings.ErrNotFound)
	})
}

func TestIntegrationListSSOSettings(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}

	var sqlStore db.DB
	var ssoSettingsStore *SSOSettingsStore

	setup := func() {
		sqlStore = db.InitTestDB(t)
		ssoSettingsStore = ProvideStore(sqlStore)
	}

	t.Run("returns every SSO settings successfully", func(t *testing.T) {
		setup()

		providers := []string{"azuread", "okta", "github"}
		settings := models.SSOSettings{
			Settings: map[string]any{
				"enabled":   true,
				"client_id": "the_client_id",
			},
			IsDeleted: false,
		}
		err := populateSSOSettings(sqlStore, settings, providers...)
		require.NoError(t, err)

		deleted := models.SSOSettings{
			Settings: map[string]any{
				"enabled": false,
			},
			IsDeleted: true,
		}
		err = populateSSOSettings(sqlStore, deleted, "google", "gitlab", "okta")
		require.NoError(t, err)

		list, err := ssoSettingsStore.List(context.Background())

		require.NoError(t, err)
		require.Len(t, list, len(providers))

		for _, item := range list {
			require.Contains(t, providers, item.Provider)
			require.EqualValues(t, settings.Settings, item.Settings)
		}
	})

	t.Run("returns empty list if no settings are found", func(t *testing.T) {
		setup()

		deleted := models.SSOSettings{
			Settings: map[string]any{
				"enabled": false,
			},
			IsDeleted: true,
		}
		err := populateSSOSettings(sqlStore, deleted, "google", "gitlab", "okta")
		require.NoError(t, err)

		list, err := ssoSettingsStore.List(context.Background())

		require.NoError(t, err)
		require.Len(t, list, 0)
	})
}

func TestIntegrationDeleteSSOSettings(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}

	var sqlStore db.DB
	var ssoSettingsStore *SSOSettingsStore

	setup := func() {
		sqlStore = db.InitTestDB(t)
		ssoSettingsStore = ProvideStore(sqlStore)
	}

	t.Run("soft deletes the settings successfully", func(t *testing.T) {
		setup()

		providers := []string{"azuread", "github", "google"}
		template := models.SSOSettings{
			Settings: map[string]any{
				"enabled": true,
			},
		}
		err := populateSSOSettings(sqlStore, template, providers...)
		require.NoError(t, err)

		err = ssoSettingsStore.Delete(context.Background(), providers[0])
		require.NoError(t, err)

		deleted, notDeleted, err := getSSOSettingsCountByDeleted(sqlStore)
		require.NoError(t, err)
		require.EqualValues(t, 1, deleted)
		require.EqualValues(t, len(providers)-1, notDeleted)
	})

	t.Run("return not found if the provider doesn't exist in db", func(t *testing.T) {
		setup()

		providers := []string{"github", "google", "okta"}
		invalidProvider := "azuread"
		template := models.SSOSettings{
			Settings: map[string]any{
				"enabled": true,
			},
		}
		err := populateSSOSettings(sqlStore, template, providers...)
		require.NoError(t, err)

		err = ssoSettingsStore.Delete(context.Background(), invalidProvider)
		require.Error(t, err)
		require.ErrorIs(t, err, ssosettings.ErrNotFound)

		deleted, notDeleted, err := getSSOSettingsCountByDeleted(sqlStore)
		require.NoError(t, err)
		require.EqualValues(t, 0, deleted)
		require.EqualValues(t, len(providers), notDeleted)
	})

	t.Run("return not found if the provider sso settings are already deleted", func(t *testing.T) {
		setup()

		providers := []string{"azuread", "github", "google"}
		template := models.SSOSettings{
			Settings: map[string]any{
				"enabled": true,
			},
			IsDeleted: true,
		}
		err := populateSSOSettings(sqlStore, template, providers...)
		require.NoError(t, err)

		err = ssoSettingsStore.Delete(context.Background(), providers[0])
		require.Error(t, err)
		require.ErrorIs(t, err, ssosettings.ErrNotFound)

		deleted, notDeleted, err := getSSOSettingsCountByDeleted(sqlStore)
		require.NoError(t, err)
		require.EqualValues(t, len(providers), deleted)
		require.EqualValues(t, 0, notDeleted)
	})

	t.Run("delete one record if more valid sso settings are available for a provider", func(t *testing.T) {
		setup()

		provider := "azuread"
		template := models.SSOSettings{
			Settings: map[string]any{
				"enabled": true,
			},
		}
		// insert sso for the same provider 2 times in the database
		err := populateSSOSettings(sqlStore, template, provider)
		require.NoError(t, err)
		err = populateSSOSettings(sqlStore, template, provider)
		require.NoError(t, err)

		err = ssoSettingsStore.Delete(context.Background(), provider)
		require.NoError(t, err)

		deleted, notDeleted, err := getSSOSettingsCountByDeleted(sqlStore)
		require.NoError(t, err)
		require.EqualValues(t, 1, deleted)
		require.EqualValues(t, 1, notDeleted)
	})

	t.Run("return not found if the provider is empty", func(t *testing.T) {
		setup()

		providers := []string{"github", "google", "okta"}
		template := models.SSOSettings{
			Settings: map[string]any{
				"enabled": true,
			},
		}
		err := populateSSOSettings(sqlStore, template, providers...)
		require.NoError(t, err)

		err = ssoSettingsStore.Delete(context.Background(), "")
		require.Error(t, err)
		require.ErrorIs(t, err, ssosettings.ErrNotFound)

		deleted, notDeleted, err := getSSOSettingsCountByDeleted(sqlStore)
		require.NoError(t, err)
		require.EqualValues(t, 0, deleted)
		require.EqualValues(t, len(providers), notDeleted)
	})
}

func populateSSOSettings(sqlStore db.DB, template models.SSOSettings, providers ...string) error {
	return sqlStore.WithDbSession(context.Background(), func(sess *db.Session) error {
		for _, provider := range providers {
			settings := models.SSOSettings{
				ID:        uuid.New().String(),
				Provider:  provider,
				Settings:  template.Settings,
				Created:   time.Now().UTC(),
				IsDeleted: template.IsDeleted,
			}

			_, err := sess.Insert(settings)
			if err != nil {
				return err
			}
		}
		return nil
	})
}

func getSSOSettingsCountByDeleted(sqlStore db.DB) (deleted, notDeleted int64, err error) {
	err = sqlStore.WithDbSession(context.Background(), func(sess *db.Session) error {
		deleted, err = sess.Table("sso_setting").Where("is_deleted = ?", sqlStore.GetDialect().BooleanValue(true)).Count()
		if err != nil {
			return err
		}
		notDeleted, err = sess.Table("sso_setting").Where("is_deleted = ?", sqlStore.GetDialect().BooleanValue(false)).Count()
		return err
	})

	return
}

func getSSOSettingsByProvider(sqlStore db.DB, provider string, deleted bool) (*models.SSOSettings, error) {
	var model models.SSOSettings
	var err error

	err = sqlStore.WithDbSession(context.Background(), func(sess *db.Session) error {
		_, err = sess.Table("sso_setting").Where("provider = ? AND is_deleted = ?", provider, sqlStore.GetDialect().BooleanValue(deleted)).Get(&model)
		return err
	})

	if err != nil {
		return nil, err
	}

	return &model, err
}
