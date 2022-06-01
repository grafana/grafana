package migrator

import (
	"strings"
)

type MigrationBase struct {
	id        string
	Condition MigrationCondition
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

func (m *MigrationBase) SkipMigrationLog() bool {
	return false
}

type RawSQLMigration struct {
	MigrationBase

	sql map[string]string
}

// NewRawSQLMigration should be used carefully, the usage
// of SQL statements that cause breaking changes like renaming
// a table or a column, or changing a column type should not be used.
func NewRawSQLMigration(sql string) *RawSQLMigration {
	m := &RawSQLMigration{}
	if sql != "" {
		m.Default(sql)
	}
	return m
}

func (m *RawSQLMigration) SQL(dialect Dialect) string {
	if m.sql != nil {
		if val := m.sql[dialect.DriverName()]; val != "" {
			return val
		}

		if val := m.sql["default"]; val != "" {
			return val
		}
	}

	return dialect.NoOpSQL()
}

func (m *RawSQLMigration) Set(dialect string, sql string) *RawSQLMigration {
	if m.sql == nil {
		m.sql = make(map[string]string)
	}

	m.sql[dialect] = sql
	return m
}

func (m *RawSQLMigration) Default(sql string) *RawSQLMigration {
	return m.Set("default", sql)
}

func (m *RawSQLMigration) SQLite(sql string) *RawSQLMigration {
	return m.Set(SQLite, sql)
}

func (m *RawSQLMigration) Mysql(sql string) *RawSQLMigration {
	return m.Set(MySQL, sql)
}

func (m *RawSQLMigration) Postgres(sql string) *RawSQLMigration {
	return m.Set(Postgres, sql)
}

func (m *RawSQLMigration) Mssql(sql string) *RawSQLMigration {
	return m.Set(MSSQL, sql)
}

type AddColumnMigration struct {
	MigrationBase
	tableName string
	column    *Column
}

func NewAddColumnMigration(table Table, col *Column) *AddColumnMigration {
	m := &AddColumnMigration{tableName: table.Name, column: col}
	m.Condition = &IfColumnNotExistsCondition{TableName: table.Name, ColumnName: col.Name}
	return m
}

func (m *AddColumnMigration) Table(tableName string) *AddColumnMigration {
	m.tableName = tableName
	return m
}

func (m *AddColumnMigration) Column(col *Column) *AddColumnMigration {
	m.column = col
	return m
}

func (m *AddColumnMigration) SQL(dialect Dialect) string {
	return dialect.AddColumnSQL(m.tableName, m.column)
}

type RenameColumnMigration struct {
	MigrationBase
	table   Table
	column  *Column
	newName string
}

// NewRenameColumnMigration may cause breaking changes.
// DEPRECATED: It should no longer be used. Kept only for legacy reasons.
func NewRenameColumnMigration(table Table, column *Column, newName string) *RenameColumnMigration {
	return &RenameColumnMigration{table: table, column: column, newName: newName}
}

func (m *RenameColumnMigration) Table(table Table) *RenameColumnMigration {
	m.table = table
	return m
}

func (m *RenameColumnMigration) Column(column *Column) *RenameColumnMigration {
	m.column = column
	return m
}

func (m *RenameColumnMigration) Rename(newName string) *RenameColumnMigration {
	m.newName = newName
	return m
}

func (m *RenameColumnMigration) SQL(d Dialect) string {
	return d.RenameColumn(m.table, m.column, m.newName)
}

type AddIndexMigration struct {
	MigrationBase
	tableName string
	index     *Index
}

func NewAddIndexMigration(table Table, index *Index) *AddIndexMigration {
	m := &AddIndexMigration{tableName: table.Name, index: index}
	m.Condition = &IfIndexNotExistsCondition{TableName: table.Name, IndexName: index.XName(table.Name)}
	return m
}

func (m *AddIndexMigration) Table(tableName string) *AddIndexMigration {
	m.tableName = tableName
	return m
}

func (m *AddIndexMigration) SQL(dialect Dialect) string {
	return dialect.CreateIndexSQL(m.tableName, m.index)
}

type DropIndexMigration struct {
	MigrationBase
	tableName string
	index     *Index
}

func NewDropIndexMigration(table Table, index *Index) *DropIndexMigration {
	m := &DropIndexMigration{tableName: table.Name, index: index}
	m.Condition = &IfIndexExistsCondition{TableName: table.Name, IndexName: index.XName(table.Name)}
	return m
}

func (m *DropIndexMigration) SQL(dialect Dialect) string {
	if m.index.Name == "" {
		m.index.Name = strings.Join(m.index.Cols, "_")
	}
	return dialect.DropIndexSQL(m.tableName, m.index)
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

func (m *AddTableMigration) SQL(d Dialect) string {
	return d.CreateTableSQL(&m.table)
}

type DropTableMigration struct {
	MigrationBase
	tableName string
}

func NewDropTableMigration(tableName string) *DropTableMigration {
	return &DropTableMigration{tableName: tableName}
}

func (m *DropTableMigration) SQL(d Dialect) string {
	return d.DropTable(m.tableName)
}

type RenameTableMigration struct {
	MigrationBase
	oldName string
	newName string
}

// NewRenameTableMigration may cause breaking changes.
// DEPRECATED: It should no longer be used. Kept only for legacy reasons.
func NewRenameTableMigration(oldName string, newName string) *RenameTableMigration {
	return &RenameTableMigration{oldName: oldName, newName: newName}
}

func (m *RenameTableMigration) Rename(oldName string, newName string) *RenameTableMigration {
	m.oldName = oldName
	m.newName = newName
	return m
}

func (m *RenameTableMigration) SQL(d Dialect) string {
	return d.RenameTable(m.oldName, m.newName)
}

type CopyTableDataMigration struct {
	MigrationBase
	sourceTable string
	targetTable string
	sourceCols  []string
	targetCols  []string
	// colMap      map[string]string
}

func NewCopyTableDataMigration(targetTable string, sourceTable string, colMap map[string]string) *CopyTableDataMigration {
	m := &CopyTableDataMigration{sourceTable: sourceTable, targetTable: targetTable}
	for key, value := range colMap {
		m.targetCols = append(m.targetCols, key)
		m.sourceCols = append(m.sourceCols, value)
	}
	return m
}

func (m *CopyTableDataMigration) SQL(d Dialect) string {
	return d.CopyTableData(m.sourceTable, m.targetTable, m.sourceCols, m.targetCols)
}

type TableCharsetMigration struct {
	MigrationBase
	tableName string
	columns   []*Column
}

func NewTableCharsetMigration(tableName string, columns []*Column) *TableCharsetMigration {
	return &TableCharsetMigration{tableName: tableName, columns: columns}
}

func (m *TableCharsetMigration) SQL(d Dialect) string {
	return d.UpdateTableSQL(m.tableName, m.columns)
}
