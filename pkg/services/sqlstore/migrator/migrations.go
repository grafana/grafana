package migrator

import (
	"fmt"
	"strings"

	"github.com/go-xorm/xorm"
)

type OnSuccess func(*xorm.Session) error

type MigrationBase struct {
	id        string
	Condition MigrationCondition
	OnSuccess OnSuccess
}

func (m *MigrationBase) Id() string {
	return m.id
}

func (m *MigrationBase) SetId(id string) {
	m.id = id
}

func (m *MigrationBase) GetCondition() MigrationCondition {
	return m.Condition
}

func (m *MigrationBase) ExecOnSuccess(sess *xorm.Session) error {
	if m.OnSuccess != nil {
		return m.OnSuccess(sess)
	}
	return nil
}

type RawSqlMigration struct {
	MigrationBase

	sqlite   string
	mysql    string
	postgres string
}

func (m *RawSqlMigration) Sql(dialect Dialect) string {
	switch dialect.DriverName() {
	case MYSQL:
		return m.mysql
	case SQLITE:
		return m.sqlite
	case POSTGRES:
		return m.postgres
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

func (m *RawSqlMigration) Postgres(sql string) *RawSqlMigration {
	m.postgres = sql
	return m
}

type AddColumnMigration struct {
	MigrationBase
	tableName string
	column    *Column
}

func NewAddColumnMigration(table Table, col *Column) *AddColumnMigration {
	return &AddColumnMigration{tableName: table.Name, column: col}
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
	index     *Index
}

func NewAddIndexMigration(table Table, index *Index) *AddIndexMigration {
	return &AddIndexMigration{tableName: table.Name, index: index}
}

func (m *AddIndexMigration) Table(tableName string) *AddIndexMigration {
	m.tableName = tableName
	return m
}

func (m *AddIndexMigration) Sql(dialect Dialect) string {
	return dialect.CreateIndexSql(m.tableName, m.index)
}

type DropIndexMigration struct {
	MigrationBase
	tableName string
	index     *Index
}

func NewDropIndexMigration(table Table, index *Index) *DropIndexMigration {
	return &DropIndexMigration{tableName: table.Name, index: index}
}

func (m *DropIndexMigration) Sql(dialect Dialect) string {
	if m.index.Name == "" {
		m.index.Name = fmt.Sprintf("%s", strings.Join(m.index.Cols, "_"))
	}
	return dialect.DropIndexSql(m.tableName, m.index)
}

type AddTableMigration struct {
	MigrationBase
	table Table
}

func NewAddTableMigration(table Table) *AddTableMigration {
	for _, col := range table.Columns {
		if col.IsPrimaryKey {
			table.PrimaryKeys = append(table.PrimaryKeys, col.Name)
		}
	}
	return &AddTableMigration{table: table}
}

func (m *AddTableMigration) Sql(d Dialect) string {
	return d.CreateTableSql(&m.table)
}

type DropTableMigration struct {
	MigrationBase
	tableName string
}

func NewDropTableMigration(tableName string) *DropTableMigration {
	return &DropTableMigration{tableName: tableName}
}

func (m *DropTableMigration) Sql(d Dialect) string {
	return d.DropTable(m.tableName)
}

type RenameTableMigration struct {
	MigrationBase
	oldName string
	newName string
}

func NewRenameTableMigration(oldName string, newName string) *RenameTableMigration {
	return &RenameTableMigration{oldName: oldName, newName: newName}
}

func (m *RenameTableMigration) IfTableExists(tableName string) *RenameTableMigration {
	m.Condition = &IfTableExistsCondition{TableName: tableName}
	return m
}

func (m *RenameTableMigration) Rename(oldName string, newName string) *RenameTableMigration {
	m.oldName = oldName
	m.newName = newName
	return m
}

func (m *RenameTableMigration) Sql(d Dialect) string {
	return d.RenameTable(m.oldName, m.newName)
}

type CopyTableDataMigration struct {
	MigrationBase
	sourceTable string
	targetTable string
	sourceCols  []string
	targetCols  []string
	colMap      map[string]string
}

func NewCopyTableDataMigration(targetTable string, sourceTable string, colMap map[string]string) *CopyTableDataMigration {
	m := &CopyTableDataMigration{sourceTable: sourceTable, targetTable: targetTable}
	for key, value := range colMap {
		m.targetCols = append(m.targetCols, key)
		m.sourceCols = append(m.sourceCols, value)
	}
	return m
}

func (m *CopyTableDataMigration) IfTableExists(tableName string) *CopyTableDataMigration {
	m.Condition = &IfTableExistsCondition{TableName: tableName}
	return m
}

func (m *CopyTableDataMigration) Sql(d Dialect) string {
	return d.CopyTableData(m.sourceTable, m.targetTable, m.sourceCols, m.targetCols)
}
