package secret

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"go.opentelemetry.io/otel/trace/noop"

	"github.com/grafana/grafana/pkg/services/accesscontrol/actest"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/setting"
	secretdatabase "github.com/grafana/grafana/pkg/storage/secret/database"
	"github.com/grafana/grafana/pkg/storage/secret/migrator"
	"github.com/grafana/grafana/pkg/util/testutil"
)

// TestIntegrationRegisterDependencies validates the fix for
// https://github.com/grafana/grafana/issues/121399 — "secret_data_key does not exist"
//
// When a user runs `grafana-cli admin secrets-consolidation consolidate` on a fresh install
// (or after deleting /var/lib/grafana), the CLI path previously skipped RegisterDependencies,
// so secret_data_key and related tables were never created.
func TestIntegrationRegisterDependencies(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	t.Run("creates secret DB tables on a fresh database (run_secrets_db_migrations=true)", func(t *testing.T) {
		// Use a raw store with no migrations — simulates a fresh CLI run where
		// the general OSS migrator has run but the secret migrator has NOT.
		testDB := sqlstore.NewTestStore(t, sqlstore.WithoutMigrator())

		cfg := setting.NewCfg()
		cfg.SecretsManagement.RunSecretsDBMigrations = true

		secretDBMigrator := migrator.NewWithEngine(testDB)

		registerer, err := RegisterDependencies(nil, cfg, secretDBMigrator, actest.FakeService{})
		require.NoError(t, err)
		assert.NotNil(t, registerer, "should return a non-nil DependencyRegisterer")

		// Verify that the secret_data_key table was created — this is the table that
		// DisableAllDataKeys operates on during secrets-consolidation.
		tracer := noop.NewTracerProvider().Tracer("test")
		database := secretdatabase.ProvideDatabase(testDB, tracer)

		_, err = database.ExecContext(t.Context(), "SELECT COUNT(*) FROM secret_data_key")
		assert.NoError(t, err, "secret_data_key table should exist after RegisterDependencies")

		// Verify the other secret tables also exist
		for _, table := range []string{
			"secret_secure_value",
			"secret_keeper",
			"secret_encrypted_value",
		} {
			_, tableErr := database.ExecContext(t.Context(), "SELECT COUNT(*) FROM "+table)
			assert.NoError(t, tableErr, "table %q should exist after RegisterDependencies", table)
		}
	})

	t.Run("skips DB migrations when run_secrets_db_migrations=false", func(t *testing.T) {
		testDB := sqlstore.NewTestStore(t, sqlstore.WithoutMigrator())

		cfg := setting.NewCfg()
		cfg.SecretsManagement.RunSecretsDBMigrations = false

		secretDBMigrator := migrator.NewWithEngine(testDB)

		registerer, err := RegisterDependencies(nil, cfg, secretDBMigrator, actest.FakeService{})
		require.NoError(t, err)
		assert.NotNil(t, registerer)

		// Tables should NOT exist because migration was skipped
		tracer := noop.NewTracerProvider().Tracer("test")
		database := secretdatabase.ProvideDatabase(testDB, tracer)

		_, err = database.ExecContext(t.Context(), "SELECT COUNT(*) FROM secret_data_key")
		assert.Error(t, err, "secret_data_key table should NOT exist when run_secrets_db_migrations=false")
	})

	t.Run("is idempotent — calling twice does not fail", func(t *testing.T) {
		testDB := sqlstore.NewTestStore(t, sqlstore.WithoutMigrator())

		cfg := setting.NewCfg()
		cfg.SecretsManagement.RunSecretsDBMigrations = true

		secretDBMigrator := migrator.NewWithEngine(testDB)

		_, err := RegisterDependencies(nil, cfg, secretDBMigrator, actest.FakeService{})
		require.NoError(t, err, "first call should succeed")

		_, err = RegisterDependencies(nil, cfg, secretDBMigrator, actest.FakeService{})
		require.NoError(t, err, "second call should also succeed (idempotent)")
	})
}
