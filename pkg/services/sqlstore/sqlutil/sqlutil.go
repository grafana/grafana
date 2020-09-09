package sqlutil

import (
	"fmt"
	"os"
)

type TestDB struct {
	DriverName string
	ConnStr    string
}

func Sqlite3TestDB() TestDB {
	// To run all tests in a local test database, set ConnStr to "grafana_test.db"
	return TestDB{
		DriverName: "sqlite3",
		ConnStr:    ":memory:",
	}
}

func MySQLTestDB() TestDB {
	host := os.Getenv("MYSQL_HOST")
	if host == "" {
		host = "localhost"
	}
	port := os.Getenv("MYSQL_PORT")
	if port == "" {
		port = "3306"
	}
	return TestDB{
		DriverName: "mysql",
		ConnStr:    fmt.Sprintf("grafana:password@tcp(%s:%s)/grafana_tests?collation=utf8mb4_unicode_ci", host, port),
	}
}

func PostgresTestDB() TestDB {
	host := os.Getenv("POSTGRES_HOST")
	if host == "" {
		host = "localhost"
	}
	port := os.Getenv("POSTGRES_PORT")
	if port == "" {
		port = "5432"
	}
	connStr := fmt.Sprintf("user=grafanatest password=grafanatest host=%s port=%s dbname=grafanatest sslmode=disable",
		host, port)
	return TestDB{
		DriverName: "postgres",
		ConnStr:    connStr,
	}
}

func MSSQLTestDB() TestDB {
	host := os.Getenv("MSSQL_HOST")
	if host == "" {
		host = "localhost"
	}
	port := os.Getenv("MSSQL_PORT")
	if port == "" {
		port = "1433"
	}
	return TestDB{
		DriverName: "mssql",
		ConnStr:    fmt.Sprintf("server=%s;port=%s;database=grafanatest;user id=grafana;password=Password!", host, port),
	}
}
