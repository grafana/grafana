package commands

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/urfave/cli/v2"

	"github.com/grafana/grafana/pkg/cmd/grafana-cli/logger"
	"github.com/grafana/grafana/pkg/cmd/grafana-cli/utils"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/storage/unified/sql/db"
	"github.com/grafana/grafana/pkg/storage/unified/sql/db/dbimpl"
)

const resourceMigrationLogTable = "resource_migration_log"

var resourceDBProvider = func(cfg *setting.Cfg) (db.DBProvider, error) {
	return dbimpl.ProvideResourceDB(nil, cfg, nil)
}

// resourceDbMigrateCommand applies the unified storage resource schema
// migrations to the database configured in --config, then exits.
func resourceDbMigrateCommand(context *cli.Context) error {
	cmd := &utils.ContextCommandLine{Context: context}

	cfg, err := configFromCommandLine(cmd)
	if err != nil {
		return err
	}
	if cmd.Bool("debug") {
		cfg.LogConfigSources()
	}

	return runResourceDbMigrations(context.Context, cfg)
}

func configFromCommandLine(cmd *utils.ContextCommandLine) (*setting.Cfg, error) {
	configOptions := strings.Split(cmd.String("configOverrides"), " ")
	cfg, err := setting.NewCfgFromArgs(setting.CommandLineArgs{
		Config:   cmd.ConfigFile(),
		HomePath: cmd.HomePath(),
		// tailing arguments have precedence over the options string
		Args: append(configOptions, cmd.Args().Slice()...),
	})
	if err != nil {
		return nil, fmt.Errorf("failed to load configuration: %w", err)
	}
	return cfg, nil
}

func runResourceDbMigrations(ctx context.Context, cfg *setting.Cfg) error {
	if ctx == nil {
		ctx = context.Background()
	}

	provider, err := resourceDBProvider(cfg)
	if err != nil {
		return fmt.Errorf("failed to configure the resource database: %w", err)
	}
	if provider == nil {
		return errors.New("no resource database configured: set the type and connection details in the [database] section")
	}

	// Init runs migrations.MigrateResourceStore, which is idempotent: on an
	// already migrated database it only reads resource_migration_log.
	resourceDB, err := provider.Init(ctx)
	if err != nil {
		return fmt.Errorf("failed to migrate the resource database: %w", err)
	}
	defer func() { _ = resourceDB.SqlDB().Close() }()

	last, err := lastResourceMigration(ctx, resourceDB)
	if err != nil {
		return err
	}
	if last == nil {
		// MigrateResourceStore always records at least the migration that
		// creates the log table, so an empty log means the migrator did not do
		// what this command exists to do.
		return fmt.Errorf("%s is empty after migrating", resourceMigrationLogTable)
	}

	logger.Infof("Resource migrations applied to the %s database. Last migration: %s (at %s)\n",
		resourceDB.DriverName(), last.MigrationID, last.Timestamp.UTC().Format(time.RFC3339))
	return nil
}

func lastResourceMigration(ctx context.Context, resourceDB db.DB) (*migrationLogRow, error) {
	query := fmt.Sprintf(
		"SELECT migration_id, timestamp FROM %s WHERE success = ? ORDER BY timestamp DESC, id DESC LIMIT 1",
		resourceMigrationLogTable)
	if resourceDB.DriverName() == "postgres" {
		query = strings.Replace(query, "?", "$1", 1)
	}

	var row migrationLogRow
	err := resourceDB.QueryRowContext(ctx, query, true).Scan(&row.MigrationID, &row.Timestamp)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("failed to read %s: %w", resourceMigrationLogTable, err)
	}
	return &row, nil
}
