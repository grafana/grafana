package commands

import (
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"testing"

	"github.com/prometheus/client_golang/prometheus"
	"github.com/stretchr/testify/require"
	"github.com/urfave/cli/v2"
	"k8s.io/component-base/metrics/legacyregistry"

	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/storage/unified/sql/db"
	"github.com/grafana/grafana/pkg/util/xorm"
)

const repoHomePath = "../../../.."

// runGrafanaCLI runs args the way `grafana <args>` would, returning the error
// that the grafana binary turns into a non-zero exit code.
func runGrafanaCLI(t *testing.T, args ...string) error {
	t.Helper()

	// server.InitializeForCLI registers collectors on the global registries,
	// which a real CLI process only does once.
	prevDefault, prevLegacy := prometheus.DefaultRegisterer, legacyregistry.Registerer
	prometheus.DefaultRegisterer = prometheus.NewRegistry()
	legacyRegistry := prometheus.NewRegistry()
	legacyregistry.Registerer = func() prometheus.Registerer { return legacyRegistry }
	t.Cleanup(func() {
		prometheus.DefaultRegisterer, legacyregistry.Registerer = prevDefault, prevLegacy
	})

	app := &cli.App{Commands: []*cli.Command{CLICommand("test")}}
	return app.Run(append([]string{"grafana"}, args...))
}

func writeIni(t *testing.T, content string) string {
	t.Helper()
	path := filepath.Join(t.TempDir(), "custom.ini")
	require.NoError(t, os.WriteFile(path, []byte(content), 0o600))
	return path
}

func TestMigrateCommandsAcceptConfigFlags(t *testing.T) {
	for _, name := range []string{"db-migrate", "resource-db-migrate"} {
		cmd := findCommand(t, adminCommands, name)
		var flags []string
		for _, f := range cmd.Flags {
			flags = append(flags, f.Names()...)
		}
		require.Subset(t, flags, []string{"config", "homepath", "configOverrides"}, name)
	}
}

func findCommand(t *testing.T, cmds []*cli.Command, name string) *cli.Command {
	t.Helper()
	for _, c := range cmds {
		if c.Name == name {
			return c
		}
	}
	t.Fatalf("command %s not found", name)
	return nil
}

func TestResourceDbMigrateConfigFlags(t *testing.T) {
	configPath := writeIni(t, "[database]\nhost = from-config-file\n")

	tests := map[string][]string{
		"flags after the subcommand": {
			"cli", "admin", "resource-db-migrate",
			"--homepath", repoHomePath, "--config", configPath, "--configOverrides", "cfg:default.database.name=from-overrides",
		},
		"global flags": {
			"cli", "--homepath", repoHomePath, "--config", configPath, "--configOverrides", "cfg:default.database.name=from-overrides",
			"admin", "resource-db-migrate",
		},
	}

	for name, args := range tests {
		t.Run(name, func(t *testing.T) {
			var gotCfg *setting.Cfg
			restore := swapResourceDBProvider(t, func(cfg *setting.Cfg) (db.DBProvider, error) {
				gotCfg = cfg
				return failingProvider{err: errors.New("boom")}, nil
			})
			defer restore()

			err := runGrafanaCLI(t, args...)
			require.ErrorContains(t, err, "boom", "migration failures must reach the exit code")

			require.NotNil(t, gotCfg)
			database := gotCfg.Raw.Section("database")
			require.Equal(t, "from-config-file", database.Key("host").String())
			require.Equal(t, "from-overrides", database.Key("name").String())
		})
	}
}

func TestDbMigrate(t *testing.T) {
	dataDir := t.TempDir()
	configPath := writeIni(t, fmt.Sprintf("[paths]\ndata = %s\nlogs = %s\n", dataDir, filepath.Join(dataDir, "log")))
	dbPath := filepath.Join(dataDir, "grafana.db")

	// An empty database gets the full Grafana schema, but not the unified
	// storage resource tables, which resource-db-migrate owns.
	require.NoError(t, runGrafanaCLI(t, "cli", "admin", "db-migrate", "--homepath", repoHomePath, "--config", configPath))

	engine, err := xorm.NewEngine("sqlite3", dbPath)
	require.NoError(t, err)
	t.Cleanup(func() { _ = engine.Close() })

	migrations, err := engine.Table("migration_log").Count()
	require.NoError(t, err)
	require.NotZero(t, migrations)

	failed, err := engine.Table("migration_log").Where("success = ?", false).Count()
	require.NoError(t, err)
	require.Zero(t, failed)

	exists, err := engine.IsTableExist(resourceMigrationLogTable)
	require.NoError(t, err)
	require.False(t, exists, "db-migrate must not run the resource migrations")

	// Running again, with the flags in their global position, applies nothing.
	require.NoError(t, runGrafanaCLI(t, "cli", "--homepath", repoHomePath, "--config", configPath, "admin", "db-migrate"))
	after, err := engine.Table("migration_log").Count()
	require.NoError(t, err)
	require.Equal(t, migrations, after)
}

func TestDbMigrateErrors(t *testing.T) {
	t.Run("invalid database configuration", func(t *testing.T) {
		configPath := writeIni(t, "[database]\ntype = nosuchdb\n")
		err := runGrafanaCLI(t, "cli", "admin", "db-migrate", "--homepath", repoHomePath, "--config", configPath)
		require.ErrorContains(t, err, "unknown database type: nosuchdb")
	})

	t.Run("migrations skipped on an empty database", func(t *testing.T) {
		dataDir := t.TempDir()
		configPath := writeIni(t, fmt.Sprintf("[paths]\ndata = %s\nlogs = %s\n", dataDir, filepath.Join(dataDir, "log")))
		err := runGrafanaCLI(t, "cli", "admin", "db-migrate", "--homepath", repoHomePath, "--config", configPath,
			"--configOverrides", "cfg:default.database.skip_migrations=true")
		require.ErrorContains(t, err, "could not determine if admin user exists")
	})
}
