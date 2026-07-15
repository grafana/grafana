package sqlutil

import (
	"errors"
	"fmt"
	"io/fs"
	"os"
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
		f, err := os.CreateTemp("", "grafana-test-*.db")
		if err != nil {
			return nil, err
		}

		sqliteDb = f.Name()
		if err := f.Close(); err != nil {
			return nil, err
		}

		ret.Cleanup = func() {
			// remove db file if it exists
			err := os.Remove(sqliteDb) // #nosec G703 -- path returned by os.CreateTemp, not user input
			if err != nil && !errors.Is(err, fs.ErrNotExist) {
				fmt.Printf("Error removing sqlite db file %s: %v\n", sqliteDb, err)
			}

			// remove wal & shm files if they exist
			err = os.Remove(sqliteDb + "-wal") // #nosec G703 -- path returned by os.CreateTemp, not user input
			if err != nil && !errors.Is(err, fs.ErrNotExist) {
				fmt.Printf("Error removing sqlite wal file %s: %v\n", sqliteDb+"-wal", err)
			}
			err = os.Remove(sqliteDb + "-shm") // #nosec G703 -- path returned by os.CreateTemp, not user input
			if err != nil && !errors.Is(err, fs.ErrNotExist) {
				fmt.Printf("Error removing sqlite shm file %s: %v\n", sqliteDb+"-shm", err)
			}
		}
	}

	ret.ConnStr = SQLiteTestConnectionString(sqliteDb)
	ret.Path = sqliteDb

	return ret, nil
}

// SQLiteTestConnectionString returns the shared SQLite configuration for file-backed integration test databases.
// It favors concurrency and speed over durability and must only be used with temporary test data.
func SQLiteTestConnectionString(path string) string {
	const sqliteTestConnectionOptions = "cache=private&mode=rwc&_cache_size=134217728&_mmap_size=134217728&_temp_store=MEMORY&_journal_mode=WAL&_synchronous=OFF"

	return "file:" + path + "?" + sqliteTestConnectionOptions
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
	conn_str := fmt.Sprintf("grafana:password@tcp(%s:%s)/grafana_tests?collation=utf8mb4_unicode_ci&sql_mode=ANSI_QUOTES&parseTime=true", host, port)
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
