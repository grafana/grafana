package dbimpl

import (
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/setting"
)

func TestNewResourceDbProvider(t *testing.T) {
	t.Parallel()

	t.Run("MySQL engine", func(t *testing.T) {
		t.Parallel()
		cfg := setting.NewCfg()
		dbSection := cfg.SectionWithEnvOverrides("database")
		dbSection.Key("type").SetValue(dbTypeMySQL)
		dbSection.Key("host").SetValue("/var/run/mysql.socket")
		dbSection.Key("name").SetValue("grafana")
		dbSection.Key("user").SetValue("user")
		dbSection.Key("password").SetValue("password")

		engine, err := newResourceDBProvider(nil, setting.ProvideService(cfg), nil)
		require.NoError(t, err)
		require.NotNil(t, engine)
		require.Equal(t, dbTypeMySQL, engine.engine.Dialect().DriverName())
	})

	t.Run("Postgres engine", func(t *testing.T) {
		t.Parallel()
		cfg := setting.NewCfg()
		dbSection := cfg.SectionWithEnvOverrides("database")
		dbSection.Key("type").SetValue(dbTypePostgres)
		dbSection.Key("host").SetValue("localhost")
		dbSection.Key("name").SetValue("grafana")
		dbSection.Key("user").SetValue("user")
		dbSection.Key("password").SetValue("password")

		engine, err := newResourceDBProvider(nil, setting.ProvideService(cfg), nil)
		require.NoError(t, err)
		require.NotNil(t, engine)
		require.Equal(t, dbTypePostgres, engine.engine.Dialect().DriverName())
	})

	t.Run("SQLite engine", func(t *testing.T) {
		t.Parallel()
		cfg := setting.NewCfg()
		dbSection := cfg.SectionWithEnvOverrides("database")
		dbSection.Key("type").SetValue(dbTypeSQLite)
		dbSection.Key("path").SetValue(":memory:")

		engine, err := newResourceDBProvider(nil, setting.ProvideService(cfg), nil)
		require.NoError(t, err)
		require.NotNil(t, engine)
		require.Equal(t, dbTypeSQLite, engine.engine.Dialect().DriverName())
	})

	t.Run("No database type", func(t *testing.T) {
		t.Parallel()
		cfg := setting.NewCfg()

		engine, err := newResourceDBProvider(nil, setting.ProvideService(cfg), nil)
		require.Error(t, err)
		require.Nil(t, engine)
		require.Contains(t, err.Error(), "no database type specified")
	})

	t.Run("Unknown database type", func(t *testing.T) {
		t.Parallel()
		cfg := setting.NewCfg()
		dbSection := cfg.SectionWithEnvOverrides("database")
		dbSection.Key("type").SetValue("unknown")

		engine, err := newResourceDBProvider(nil, setting.ProvideService(cfg), nil)
		require.Error(t, err)
		require.Nil(t, engine)
		require.Contains(t, err.Error(), "unknown")
	})
}

func TestDatabaseConfigOverridenByEnvVariable(t *testing.T) {
	prevEnv := os.Environ()
	t.Cleanup(func() {
		// Revert env variables to state before this test.
		os.Clearenv()
		for _, e := range prevEnv {
			sp := strings.SplitN(e, "=", 2)
			if len(sp) == 2 {
				assert.NoError(t, os.Setenv(sp[0], sp[1]))
			}
		}
	})

	tmpDir := t.TempDir()

	require.NoError(t, os.MkdirAll(filepath.Join(tmpDir, "conf"), 0o750))
	// We need to include database.url in defaults, otherwise it won't be overridden by environment variable!
	require.NoError(t, os.WriteFile(filepath.Join(tmpDir, "conf/defaults.ini"), []byte("[log.console]\nlevel =\n[database]\nurl = \n"), 0o644))

	dbConfig := `
[database]
type = postgres
host = localhost
name = grafana
user = user
password = password
`
	require.NoError(t, os.WriteFile(filepath.Join(tmpDir, "conf/custom.ini"), []byte(dbConfig), 0o644))

	// Override database URL
	require.NoError(t, os.Setenv("GF_DATABASE_URL", "mysql://gf:pwd@overthere:3306/grafana"))

	cfg := setting.NewCfg()
	require.NoError(t, cfg.Load(setting.CommandLineArgs{HomePath: tmpDir}))

	engine, err := newResourceDBProvider(nil, setting.ProvideService(cfg), nil)
	require.NoError(t, err)
	require.NotNil(t, engine)
	// Verify that GF_DATABASE_URL value is used.
	require.Equal(t, dbTypeMySQL, engine.engine.Dialect().DriverName())
	require.Contains(t, engine.engine.DataSourceName(), "overthere:3306")
}
