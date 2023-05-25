package settingsprovider

import (
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/services/settings"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/services/sqlstore/migrations"
	"github.com/grafana/grafana/pkg/services/sqlstore/migrator"
	"github.com/grafana/grafana/pkg/setting"
)

// testSettingsMigrator is a migrator that only adds the OSS + settings table
type testSettingsMigrator struct {
	migrations.OSSMigrations
}

func (m *testSettingsMigrator) AddMigration(mg *migrator.Migrator) {
	m.OSSMigrations.AddMigration(mg)
	AddMigration(mg)
}

// Write integration tests for the database struct
func TestIntegrationUpsertSettings(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping testing in short mode")
	}
	// using EnterpriseMigrations causes dep loop
	migrator := &testSettingsMigrator{migrations.OSSMigrations{}}
	sqlStore := sqlstore.InitTestDBWithMigration(t, migrator)
	d := database{sqlStore}

	// these tests are not parallelizable
	// because they share the same database (expensive to setup)
	testCases := []struct {
		name     string
		updates  setting.SettingsBag
		removals setting.SettingsRemovals
		want     []settings.Setting
	}{
		{
			name: "insert new settings",
			updates: setting.SettingsBag{
				"auth": map[string]string{
					"disable_login_form": "true",
				},
			},
			want: []settings.Setting{
				{
					Section: "auth",
					Key:     "disable_login_form",
					Value:   "true",
				},
			},
		},
		{
			name: "update existing settings",
			updates: setting.SettingsBag{
				"auth": map[string]string{
					"disable_login_form": "false",
				},
			},
			want: []settings.Setting{
				{
					Section: "auth",
					Key:     "disable_login_form",
					Value:   "false",
				},
			},
		},
		{
			name: "set to same value in settings",
			updates: setting.SettingsBag{
				"auth": map[string]string{
					"disable_login_form": "false",
				},
			},
			want: []settings.Setting{
				{
					Section: "auth",
					Key:     "disable_login_form",
					Value:   "false",
				},
			},
		},
		{
			name: "remove existing settings",
			removals: setting.SettingsRemovals{
				"auth": []string{
					"disable_login_form",
				},
			},
			want: []settings.Setting{},
		},
		{
			name: "remove non-existing settings",
			removals: setting.SettingsRemovals{
				"auth": []string{
					"disable_login_form",
				},
			},
			want: []settings.Setting{},
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			// Upsert the settings
			err := d.UpsertSettings(tc.updates, tc.removals)
			require.NoError(t, err)

			// Check that the settings were inserted
			got, err := d.GetSettings()
			require.NoError(t, err)
			require.EqualValues(t, tc.want, got)
		})
	}
}
