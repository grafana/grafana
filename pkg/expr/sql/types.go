package sql

import (
	"database/sql"
	"database/sql/driver"

	"github.com/grafana/grafana-plugin-sdk-go/data"
)

// DuckDB stores dataframes from previous datasource queries
// and allows querying using SQL Expressions in Grafana
type DuckDB struct {
	db     *sql.DB
	name   string
	lookup Fields
}

type Row []driver.Value
type Table []Row
type Tables map[string]Table
type Fields map[string]*data.Field
type Unknown map[string]bool
type TableFields map[string][]*data.Field
