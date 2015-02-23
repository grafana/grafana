package migrator

import (
	"fmt"
	"strings"
)

type MigrationBase struct {
	id string
}

func (m *MigrationBase) Id() string {
	return m.id
}

func (m *MigrationBase) SetId(id string) {
	m.id = id
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

type AddColumnMigration struct {
	MigrationBase
	tableName string
	column    *Column
}

func (m *AddColumnMigration) Table(tableName string) *AddColumnMigration {
	m.tableName = tableName
	return m
}

func (m *AddColumnMigration) Column(col *Column) *AddColumnMigration {
	m.column = col
	return m
}

func (m *AddColumnMigration) Sql(dialect Dialect) string {
	return dialect.AddColumnSql(m.tableName, m.column)
}

type AddIndexMigration struct {
	MigrationBase
	tableName string
	index     Index
}

func (m *AddIndexMigration) Name(name string) *AddIndexMigration {
	m.index.Name = name
	return m
}

func (m *AddIndexMigration) Table(tableName string) *AddIndexMigration {
	m.tableName = tableName
	return m
}

func (m *AddIndexMigration) Unique() *AddIndexMigration {
	m.index.Type = UniqueIndex
	return m
}

func (m *AddIndexMigration) Columns(columns ...string) *AddIndexMigration {
	m.index.Cols = columns
	return m
}

func (m *AddIndexMigration) Sql(dialect Dialect) string {
	if m.index.Name == "" {
		m.index.Name = fmt.Sprintf("%s", strings.Join(m.index.Cols, "_"))
	}
	return dialect.CreateIndexSql(m.tableName, &m.index)
}

type AddTableMigration struct {
	MigrationBase
	table Table
}

func (m *AddTableMigration) Sql(d Dialect) string {
	return d.CreateTableSql(&m.table)
}

func (m *AddTableMigration) Name(name string) *AddTableMigration {
	m.table.Name = name
	return m
}

func (m *AddTableMigration) WithColumns(columns ...*Column) *AddTableMigration {
	for _, col := range columns {
		m.table.Columns = append(m.table.Columns, col)
		if col.IsPrimaryKey {
			m.table.PrimaryKeys = append(m.table.PrimaryKeys, col.Name)
		}
	}
	return m
}

func (m *AddTableMigration) WithColumn(col *Column) *AddTableMigration {
	m.table.Columns = append(m.table.Columns, col)
	if col.IsPrimaryKey {
		m.table.PrimaryKeys = append(m.table.PrimaryKeys, col.Name)
	}
	return m
}

type RenameColumnMigration struct {
	MigrationBase
	tableName string
	oldName   string
	newName   string
}

func (m *RenameColumnMigration) Table(tableName string) *RenameColumnMigration {
	m.tableName = tableName
	return m
}

func (m *RenameColumnMigration) Rename(oldName string, newName string) *RenameColumnMigration {
	m.oldName = oldName
	m.newName = newName
	return m
}
