package migrations

import (
	"fmt"
	"strings"
)

const (
	POSTGRES = "postgres"
	SQLITE   = "sqlite3"
	MYSQL    = "mysql"
)

type Migration interface {
	Sql(dialect Dialect) string
}

type ColumnType string

const (
	DB_TYPE_STRING ColumnType = "String"
)

type MigrationBase struct {
	desc string
}

type RawSqlMigration struct {
	MigrationBase

	sqlite string
	mysql  string
}

func (m *RawSqlMigration) Sql(dialect Dialect) string {
	switch dialect.DriverName() {
	case MYSQL:
		return m.mysql
	case SQLITE:
		return m.sqlite
	}

	panic("db type not supported")
}

func (m *RawSqlMigration) Sqlite(sql string) *RawSqlMigration {
	m.sqlite = sql
	return m
}

func (m *RawSqlMigration) Mysql(sql string) *RawSqlMigration {
	m.mysql = sql
	return m
}

func (m *RawSqlMigration) Desc(desc string) *RawSqlMigration {
	m.desc = desc
	return m
}

type AddColumnMigration struct {
	MigrationBase
	tableName  string
	columnName string
	columnType ColumnType
	length     int
}

func (m *AddColumnMigration) Table(tableName string) *AddColumnMigration {
	m.tableName = tableName
	return m
}

func (m *AddColumnMigration) Length(length int) *AddColumnMigration {
	m.length = length
	return m
}

func (m *AddColumnMigration) Column(columnName string) *AddColumnMigration {
	m.columnName = columnName
	return m
}

func (m *AddColumnMigration) Type(columnType ColumnType) *AddColumnMigration {
	m.columnType = columnType
	return m
}

func (m *AddColumnMigration) Sql(dialect Dialect) string {
	return fmt.Sprintf("ALTER TABLE %s ADD COLUMN %s %s", m.tableName, m.columnName, dialect.ToDBTypeSql(m.columnType, m.length))
}

func (m *AddColumnMigration) Desc(desc string) *AddColumnMigration {
	m.desc = desc
	return m
}

type AddIndexMigration struct {
	MigrationBase
	tableName string
	columns   string
	indexName string
}

func (m *AddIndexMigration) Name(name string) *AddIndexMigration {
	m.indexName = name
	return m
}

func (m *AddIndexMigration) Table(tableName string) *AddIndexMigration {
	m.tableName = tableName
	return m
}

func (m *AddIndexMigration) Columns(columns ...string) *AddIndexMigration {
	m.columns = strings.Join(columns, ",")
	return m
}

func (m *AddIndexMigration) Sql(dialect Dialect) string {
	return fmt.Sprintf("CREATE UNIQUE INDEX %s ON %s(%s)", m.indexName, m.tableName, m.columns)
}
