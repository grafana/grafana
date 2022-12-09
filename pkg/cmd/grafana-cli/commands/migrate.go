package commands

import (
	"context"
	"fmt"
	"strings"

	"github.com/golang-migrate/migrate/v4"
	"github.com/golang-migrate/migrate/v4/database"
	"github.com/golang-migrate/migrate/v4/source"
	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/cmd/grafana-cli/logger"
	"github.com/grafana/grafana/pkg/cmd/grafana-cli/utils"
	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/services/sqlstore/migrations"
	"github.com/grafana/grafana/pkg/services/sqlstore/migrator"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/urfave/cli/v2"
)

func runMigrateCommand(command func(commandLine utils.CommandLine, ourceDriver source.Driver, dbDricer database.Driver, m *migrate.Migrate) error) func(context *cli.Context) error {
	return func(c *cli.Context) error {
		cmd := &utils.ContextCommandLine{Context: c}

		cfg, err := initMigrateCfg(cmd)
		if err != nil {
			return fmt.Errorf("%v: %w", "failed to load configuration", err)
		}

		tracer, err := tracing.ProvideService(cfg)
		if err != nil {
			return fmt.Errorf("%v: %w", "failed to initialize tracer service", err)
		}

		bus := bus.ProvideBus(tracer)

		sqlStore, err := db.ProvideService(cfg, nil, &migrations.OSSMigrations{}, bus, tracer)
		if err != nil {
			return fmt.Errorf("%v: %w", "failed to initialize SQL store", err)
		}

		if err := sqlStore.WithDbSession(context.Background(), func(session *db.Session) error {
			driverName := sqlStore.GetDialect().DriverName()
			sd, err := migrator.GetMigrateSourceDriver(driverName)
			if err != nil {
				return err
			}

			dd, err := migrator.GetDatabaseDriver(driverName, session.DB().DB)
			if err != nil {
				return err
			}

			m, err := migrate.NewWithInstance("iofs", sd, driverName, dd)
			if err != nil {
				return err
			}

			if err := command(cmd, sd, dd, m); err != nil {
				return err
			}

			return nil
		}); err != nil {
			return err
		}

		logger.Info("\n\n")
		return nil
	}
}

func initMigrateCfg(cmd *utils.ContextCommandLine) (*setting.Cfg, error) {
	configOptions := strings.Split(cmd.String("configOverrides"), " ")
	configOptions = append(configOptions, cmd.Args().Slice()...)
	cfg, err := setting.NewCfgFromArgs(setting.CommandLineArgs{
		Config:   cmd.ConfigFile(),
		HomePath: cmd.HomePath(),
		// tailing arguments have precedence over the options string
		Args: append(configOptions, "cfg:log.level=error", "cfg:default.database.skip_migrations=true", "cfg:default.database.skip_ensure_default_org_and_user=true"), // tailing arguments have precedence over the options string
	})

	if err != nil {
		return nil, err
	}

	if cmd.Bool("debug") {
		cfg.LogConfigSources()
	}

	return cfg, nil
}

func getMigrationsVersion(c utils.CommandLine, sourceDriver source.Driver, dbDricer database.Driver, m *migrate.Migrate) error {
	v, dirty, err := m.Version()
	if err != nil {
		return err
	}

	logger.Info(fmt.Sprintf("version: %d dirty: %v\n", v, dirty))
	return nil
}

func runMigrationsSteps(c utils.CommandLine, sourceDriver source.Driver, dbDricer database.Driver, m *migrate.Migrate) error {
	return m.Steps(c.Int("steps"))
}

func runMigrations(c utils.CommandLine, sourceDriver source.Driver, dbDricer database.Driver, m *migrate.Migrate) error {
	return m.Migrate(uint(c.Uint("version")))
}

func forceMigrationsVersion(c utils.CommandLine, sourceDriver source.Driver, dbDricer database.Driver, m *migrate.Migrate) error {
	return m.Force(c.Int("version"))
}

func listMigrations(c utils.CommandLine, sourceDriver source.Driver, dbDricer database.Driver, m *migrate.Migrate) error {
	r, err := migrator.ListMigrations(sourceDriver, dbDricer)
	if err != nil {
		return err
	}

	for _, item := range r {
		var check string
		switch {
		case item.IsDirty:
			check = "\u274C"
		case item.HasRun:
			check = "\u2705"
		default:
			check = " "
		}
		logger.Info(fmt.Sprintf("[%s] %d\n", check, item.Version))
	}

	return nil
}
