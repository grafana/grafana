package migrator

import (
	"database/sql"
	"embed"
	"fmt"
	"path/filepath"

	"github.com/golang-migrate/migrate/v4/database"
	"github.com/golang-migrate/migrate/v4/database/mysql"
	"github.com/golang-migrate/migrate/v4/database/postgres"
	"github.com/golang-migrate/migrate/v4/database/sqlite3"
	"github.com/golang-migrate/migrate/v4/source"
	"github.com/golang-migrate/migrate/v4/source/iofs"
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
