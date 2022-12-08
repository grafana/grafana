package commands

import (
	"context"
	"fmt"

	"github.com/golang-migrate/migrate/v4"
	"github.com/grafana/grafana/pkg/cmd/grafana-cli/logger"
	"github.com/grafana/grafana/pkg/cmd/grafana-cli/utils"
	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/services/sqlstore/migrator"
)

func getMigrationsVersion(c utils.CommandLine, sqlStore db.DB) error {
	return sqlStore.WithDbSession(context.Background(), func(session *db.Session) error {
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

		v, dirty, err := m.Version()
		if err != nil {
			return err
		}

		logger.Info(fmt.Sprintf("version: %d dirty: %v\n", v, dirty))
		return nil
	})
}

func runMigrationsSteps(c utils.CommandLine, sqlStore db.DB) error {
	return sqlStore.WithDbSession(context.Background(), func(session *db.Session) error {
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

		err = m.Steps(c.Int("steps"))
		if err != nil {
			return err
		}

		return nil
	})
}

func listMigrations(c utils.CommandLine, sqlStore db.DB) error {
	return sqlStore.WithDbSession(context.Background(), func(session *db.Session) error {
		driverName := sqlStore.GetDialect().DriverName()
		sd, err := migrator.GetMigrateSourceDriver(driverName)
		if err != nil {
			return err
		}

		dd, err := migrator.GetDatabaseDriver(driverName, session.DB().DB)
		if err != nil {
			return err
		}

		r, err := migrator.ListMigrations(sd, dd)
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
	})
}
