package migrator

import (
	"database/sql"
	"embed"
	"errors"
	"fmt"
	"os"
	"path/filepath"

	"github.com/golang-migrate/migrate/v4/database"
	"github.com/golang-migrate/migrate/v4/database/mysql"
	"github.com/golang-migrate/migrate/v4/database/postgres"
	"github.com/golang-migrate/migrate/v4/database/sqlite3"
	"github.com/golang-migrate/migrate/v4/source"
	"github.com/golang-migrate/migrate/v4/source/iofs"
	"github.com/grafana/grafana/pkg/util"
)

//go:embed golang-migrate/*/*.sql
var fs embed.FS

func GetMigrateSourceDriver(driverName string) (source.Driver, error) {
	d, err := iofs.New(fs, filepath.Join("golang-migrate", driverName))
	if err != nil {
		return nil, err
	}

	return d, nil
}

func GetDatabaseDriver(driverName string, instance *sql.DB) (database.Driver, error) {
	var dd database.Driver
	var err error
	switch {
	case driverName == Postgres:
		dd, err = postgres.WithInstance(instance, &postgres.Config{})
		if err != nil {
			return nil, err
		}
	case driverName == MySQL:
		dd, err = mysql.WithInstance(instance, &mysql.Config{})
		if err != nil {
			return nil, err
		}
	case driverName == SQLite:
		dd, err = sqlite3.WithInstance(instance, &sqlite3.Config{})
		if err != nil {
			return nil, err
		}
	default:
		return nil, fmt.Errorf("unsupported database driver")
	}

	return dd, nil
}

type ListMigrationItem struct {
	Version uint
	HasRun  bool
	IsDirty bool
}

func ListMigrations(sourceDriver source.Driver, databaseDriver database.Driver) ([]ListMigrationItem, error) {
	r := make([]ListMigrationItem, 0, 0)

	dbVersion, dirty, err := databaseDriver.Version()
	if err != nil {
		return nil, fmt.Errorf("failed to get database version: %w", err)
	}

	firstVersion, err := sourceDriver.First()
	if err != nil {
		return nil, fmt.Errorf("failed to get source first version: %w", err)
	}

	v := firstVersion
	for {
		hasRun := false
		isDirty := false
		if v <= uint(dbVersion) {
			hasRun = true
		}

		switch {
		case dbVersion == -1:
			hasRun = false
		case v < uint(dbVersion):
			hasRun = true
		case v == uint(dbVersion):
			hasRun = true
			if dirty {
				isDirty = true
			}
		}

		r = append(r, ListMigrationItem{
			Version: v,
			HasRun:  hasRun,
			IsDirty: isDirty,
		})

		next, err := sourceDriver.Next(v)
		if err != nil {
			if errors.Is(err, os.ErrNotExist) {
				break
			}

			return nil, fmt.Errorf("failed to get next migration: %w", err)
		}

		v = next
	}
	return util.Reverse(r), nil
}
