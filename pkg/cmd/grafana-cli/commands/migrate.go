package commands

import (
	"context"
	"fmt"

	"github.com/golang-migrate/migrate/v4"
	"github.com/golang-migrate/migrate/v4/database"
	"github.com/golang-migrate/migrate/v4/database/mysql"
	"github.com/golang-migrate/migrate/v4/database/postgres"
	"github.com/golang-migrate/migrate/v4/database/sqlite3"
	"github.com/grafana/grafana/pkg/cmd/grafana-cli/logger"
	"github.com/grafana/grafana/pkg/cmd/grafana-cli/utils"
	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/services/sqlstore/migrator"
)

func getDatabaseDriver(sqlStore db.DB) (database.Driver, error) {
	var dd database.Driver
	err := sqlStore.WithDbSession(context.Background(), func(session *db.Session) error {
		var err error
		switch {
		case sqlStore.GetDialect().DriverName() == migrator.Postgres:
			dd, err = postgres.WithInstance(session.DB().DB, &postgres.Config{})
			if err != nil {
				return err
			}
		case sqlStore.GetDialect().DriverName() == migrator.MySQL:
			dd, err = mysql.WithInstance(session.DB().DB, &mysql.Config{})
			if err != nil {
				return err
			}
		case sqlStore.GetDialect().DriverName() == migrator.SQLite:
			dd, err = sqlite3.WithInstance(session.DB().DB, &sqlite3.Config{})
			if err != nil {
				return err
			}
		default:
			return fmt.Errorf("unsupported database driver")
		}

		return nil
	})
	return dd, err
}

func getMigrationsVersion(c utils.CommandLine, sqlStore db.DB) error {
	driverName := sqlStore.GetDialect().DriverName()
	sd, err := migrator.GetMigrateSourceDriver(driverName)
	if err != nil {
		return err
	}

	dd, err := getDatabaseDriver(sqlStore)
	if err != nil {
		return err
	}

	m, err := migrate.NewWithInstance("iofs", sd, driverName, dd)
	if err != nil {
		return err
	}

	v, dirty, err := m.Version()
	if err != nil {
		return err
	}

	logger.Info("version", v, "dirty", dirty)
	return nil
}

func runMigrationsSteps(c utils.CommandLine, sqlStore db.DB) error {
	driverName := sqlStore.GetDialect().DriverName()
	sd, err := migrator.GetMigrateSourceDriver(driverName)
	if err != nil {
		return err
	}

	dd, err := getDatabaseDriver(sqlStore)
	if err != nil {
		return err
	}

	m, err := migrate.NewWithInstance("iofs", sd, driverName, dd)
	if err != nil {
		return err
	}

	err = m.Steps(c.Int("steps"))
	if err != nil {
		return err
	}

	return nil
}
