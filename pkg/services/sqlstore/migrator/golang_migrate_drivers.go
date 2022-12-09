package migrator

import (
	"database/sql"
	"embed"
	"errors"
	"fmt"
	"io"
	"io/ioutil"
	"os"
	"path/filepath"

	"github.com/golang-migrate/migrate/v4/database"
	"github.com/golang-migrate/migrate/v4/database/mysql"
	"github.com/golang-migrate/migrate/v4/database/postgres"
	"github.com/golang-migrate/migrate/v4/database/sqlite3"
	"github.com/golang-migrate/migrate/v4/source"
	"github.com/golang-migrate/migrate/v4/source/iofs"
	"github.com/grafana/grafana/pkg/util"
	"github.com/hashicorp/go-multierror"
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

type SQLiteDriver struct {
	*sqlite3.Sqlite

	db     *sql.DB
	config SQLiteConfig
}

type SQLiteConfig struct {
	*sqlite3.Config

	DryRun bool
}

func NewSQLiteDriver(instance *sql.DB, sqliteCfg SQLiteConfig) (*SQLiteDriver, error) {
	if sqliteCfg.Config == nil {
		sqliteCfg.Config = &sqlite3.Config{}
	}
	dd, err := sqlite3.WithInstance(instance, sqliteCfg.Config)
	if err != nil {
		return nil, err
	}
	sd, ok := dd.(*sqlite3.Sqlite)
	if !ok {
		return nil, fmt.Errorf("failed to cast to postgres driver: %w", err)
	}

	return &SQLiteDriver{sd, instance, sqliteCfg}, nil
}

func (m *SQLiteDriver) SetVersion(version int, dirty bool) error {
	tx, err := m.db.Begin()
	if err != nil {
		return &database.Error{OrigErr: err, Err: "transaction start failed"}
	}

	query := "DELETE FROM " + m.config.MigrationsTable
	if _, err := tx.Exec(query); err != nil {
		return &database.Error{OrigErr: err, Query: []byte(query)}
	}

	// Also re-write the schema version for nil dirty versions to prevent
	// empty schema version for failed down migration on the first migration
	// See: https://github.com/golang-migrate/migrate/issues/330
	if version >= 0 || (version == database.NilVersion && dirty) {
		query := fmt.Sprintf(`INSERT INTO %s (version, dirty) VALUES (?, ?)`, m.config.MigrationsTable)
		if _, err := tx.Exec(query, version, dirty); err != nil {
			if errRollback := tx.Rollback(); errRollback != nil {
				err = multierror.Append(err, errRollback)
			}
			return &database.Error{OrigErr: err, Query: []byte(query)}
		}
	}

	if m.config.DryRun {
		if errRollback := tx.Rollback(); errRollback != nil {
			return &database.Error{OrigErr: errRollback, Query: []byte(query)}
		}
		return nil
	}

	if err := tx.Commit(); err != nil {
		return &database.Error{OrigErr: err, Err: "transaction commit failed"}
	}

	return nil
}

func (m *SQLiteDriver) Run(migration io.Reader) error {
	migr, err := ioutil.ReadAll(migration)
	if err != nil {
		return err
	}
	query := string(migr[:])

	return m.executeQuery(query)
}

func (m *SQLiteDriver) executeQuery(query string) error {
	tx, err := m.db.Begin()
	if err != nil {
		return &database.Error{OrigErr: err, Err: "transaction start failed"}
	}
	if _, err := tx.Exec(query); err != nil {
		if errRollback := tx.Rollback(); errRollback != nil {
			err = multierror.Append(err, errRollback)
		}
		return &database.Error{OrigErr: err, Query: []byte(query)}
	}

	if m.config.DryRun {
		if errRollback := tx.Rollback(); errRollback != nil {
			return &database.Error{OrigErr: errRollback, Query: []byte(query)}
		}
		return nil
	}

	if err := tx.Commit(); err != nil {
		return &database.Error{OrigErr: err, Err: "transaction commit failed"}
	}
	return nil
}

func GetDatabaseDriver(driverName string, instance *sql.DB, sqliteCfg SQLiteConfig) (database.Driver, error) {
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
		dd, err = NewSQLiteDriver(instance, sqliteCfg)
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
