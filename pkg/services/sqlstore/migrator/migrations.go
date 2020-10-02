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

type RawSqlMigration struct {
	MigrationBase

	sql map[string]string
}

func NewRawSqlMigration(sql string) *RawSqlMigration {
	m := &RawSqlMigration{}
	if sql != "" {
		m.Default(sql)
	}
	return m
}

func (m *RawSqlMigration) Sql(dialect Dialect) string {
	if m.sql != nil {
		if val := m.sql[dialect.DriverName()]; val != "" {
			return val
		}

		if val := m.sql["default"]; val != "" {
			return val
		}
	}

	return dialect.NoOpSql()
}

func (m *RawSqlMigration) Set(dialect string, sql string) *RawSqlMigration {
	if m.sql == nil {
		m.sql = make(map[string]string)
	}

	m.sql[dialect] = sql
	return m
}

func (m *RawSqlMigration) Default(sql string) *RawSqlMigration {
	return m.Set("default", sql)
}

func (m *RawSqlMigration) Sqlite(sql string) *RawSqlMigration {
	return m.Set(SQLITE, sql)
}

func (m *RawSqlMigration) Mysql(sql string) *RawSqlMigration {
	return m.Set(MYSQL, sql)
}

func (m *RawSqlMigration) Postgres(sql string) *RawSqlMigration {
	return m.Set(POSTGRES, sql)
}

func (m *RawSqlMigration) Mssql(sql string) *RawSqlMigration {
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

func (m *AddColumnMigration) Sql(dialect Dialect) string {
	return dialect.AddColumnSql(m.tableName, m.column)
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

func (m *AddIndexMigration) Sql(dialect Dialect) string {
	return dialect.CreateIndexSql(m.tableName, m.index)
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

func (m *DropIndexMigration) Sql(dialect Dialect) string {
	if m.index.Name == "" {
		m.index.Name = strings.Join(m.index.Cols, "_")
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

func (m *CopyTableDataMigration) Sql(d Dialect) string {
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

func (m *TableCharsetMigration) Sql(d Dialect) string {
	return d.UpdateTableSql(m.tableName, m.columns)
}
