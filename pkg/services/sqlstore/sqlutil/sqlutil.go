package sqlutil

import (
	"errors"
	"fmt"
	"io/fs"
	"os"
	"path/filepath"
)

// ITestDB is an interface of arguments for testing db
type ITestDB interface {
	Helper()
	Fatalf(format string, args ...any)
	Logf(format string, args ...any)
	Log(args ...any)
	Cleanup(func())
	Skipf(format string, args ...any)
}

type TestDB struct {
	DriverName string
	ConnStr    string
	Path       string
	Host       string
	Port       string
	User       string
	Password   string
	Database   string
	Cleanup    func()
}

func GetTestDBType() string {
	dbType := "sqlite3"

	// environment variable present for test db?
	if db, present := os.LookupEnv("GRAFANA_TEST_DB"); present {
		dbType = db
	}
	return dbType
}

func GetTestDB(dbType string) (*TestDB, error) {
	switch dbType {
	case "mysql":
		return mySQLTestDB()
	case "postgres":
		return postgresTestDB()
	case "sqlite3":
		return sqLite3TestDB()
	}

	return nil, fmt.Errorf("unknown test db type: %s", dbType)
}

func sqLite3TestDB() (*TestDB, error) {
	if os.Getenv("SQLITE_INMEMORY") == "true" {
		return &TestDB{
			DriverName: "sqlite3",
			ConnStr:    "file::memory:",
			Cleanup:    func() {},
		}, nil
	}

	ret := &TestDB{
		DriverName: "sqlite3",
		Cleanup:    func() {},
	}

	sqliteDb := os.Getenv("SQLITE_TEST_DB")
	if sqliteDb == "" {
		// try to create a database file in the user's cache directory
		dir, err := os.UserCacheDir()
		if err != nil {
			return nil, err
		}

		// if cache dir doesn't exist, fall back to temp dir
		if _, err := os.Stat(dir); errors.Is(err, fs.ErrNotExist) {
			dir = os.TempDir()
			if _, err := os.Stat(dir); err != nil {
				return nil, err
			}
		}

		err = os.Mkdir(filepath.Join(dir, "grafana-test"), 0750)
		if err != nil && !errors.Is(err, fs.ErrExist) {
			return nil, err
		}

		f, err := os.CreateTemp(filepath.Join(dir, "grafana-test"), "grafana-test-*.db")
		if err != nil {
			return nil, err
		}

		sqliteDb = f.Name()

		ret.Cleanup = func() {
			// remove db file if it exists
			err := os.Remove(sqliteDb)
			if err != nil && !errors.Is(err, fs.ErrNotExist) {
				fmt.Printf("Error removing sqlite db file %s: %v\n", sqliteDb, err)
			}

			// remove wal & shm files if they exist
			err = os.Remove(sqliteDb + "-wal")
			if err != nil && !errors.Is(err, fs.ErrNotExist) {
				fmt.Printf("Error removing sqlite wal file %s: %v\n", sqliteDb+"-wal", err)
			}
			err = os.Remove(sqliteDb + "-shm")
			if err != nil && !errors.Is(err, fs.ErrNotExist) {
				fmt.Printf("Error removing sqlite shm file %s: %v\n", sqliteDb+"-shm", err)
			}
		}
	}

	ret.ConnStr = "file:" + sqliteDb + "?cache=private&mode=rwc"
	if os.Getenv("SQLITE_JOURNAL_MODE") != "false" {
		// For tests, set sync=OFF for faster commits. Reference: https://www.sqlite.org/pragma.html#pragma_synchronous.
		ret.ConnStr += "&_journal_mode=WAL&_synchronous=OFF"
	}
	ret.Path = sqliteDb

	return ret, nil
}

func mySQLTestDB() (*TestDB, error) {
	host := os.Getenv("MYSQL_HOST")
	if host == "" {
		host = "localhost"
	}
	port := os.Getenv("MYSQL_PORT")
	if port == "" {
		port = "3306"
	}
	conn_str := fmt.Sprintf("grafana:password@tcp(%s:%s)/grafana_tests?collation=utf8mb4_unicode_ci&sql_mode='ANSI_QUOTES'&parseTime=true", host, port)
	return &TestDB{
		DriverName: "mysql",
		ConnStr:    conn_str,
		Host:       host,
		Port:       port,
		User:       "grafana",
		Password:   "password",
		Database:   "grafana_tests",
		Cleanup:    func() {},
	}, nil
}

func postgresTestDB() (*TestDB, error) {
	host := os.Getenv("POSTGRES_HOST")
	if host == "" {
		host = "localhost"
	}
	port := os.Getenv("POSTGRES_PORT")
	if port == "" {
		port = "5432"
	}
	connStr := fmt.Sprintf("user=grafanatest password=grafanatest host=%s port=%s dbname=grafanatest sslmode=disable", host, port)
	return &TestDB{
		DriverName: "postgres",
		ConnStr:    connStr,
		Host:       host,
		Port:       port,
		User:       "grafanatest",
		Password:   "grafanatest",
		Database:   "grafanatest",
		Cleanup:    func() {},
	}, nil
}
