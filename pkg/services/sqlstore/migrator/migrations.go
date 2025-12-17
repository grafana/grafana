package migrator

import (
	"fmt"
	"slices"
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

	return ""
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

type addPrimaryKeyMigration struct {
	MigrationBase
	tableName string
	uniqueKey Index

	// Used for Sqlite recreation of the table. Temporary table will have tableName + "_new" suffix.
	table Table
}

func (m *addPrimaryKeyMigration) SQL(d Dialect) string {
	if d.DriverName() == SQLite {
		// Final SQL will do following in the individual statements:
		// 1. Create new temporary table
		// 2. Copy data from old table to temporary table
		// 3. Drop old table, rename temporary table to original name
		// 4. Recreate indexes for table.
		//
		// For example:
		//
		//	CREATE TABLE file_new
		//	(
		//		path                    TEXT     NOT NULL,
		//		path_hash               TEXT     NOT NULL,
		//		parent_folder_path_hash TEXT     NOT NULL,
		//		contents                BLOB     NOT NULL,
		//		etag                    TEXT     NOT NULL,
		//		cache_control           TEXT     NOT NULL,
		//		content_disposition     TEXT     NOT NULL,
		//		updated                 DATETIME NOT NULL,
		//		created                 DATETIME NOT NULL,
		//		size                    INTEGER  NOT NULL,
		//		mime_type               TEXT     NOT NULL,
		//
		//		PRIMARY KEY (path_hash)
		//	);
		//
		//	INSERT INTO file_new (path, path_hash, parent_folder_path_hash, contents, etag, cache_control, content_disposition, updated, created, size, mime_type)
		//	SELECT path, path_hash, parent_folder_path_hash, contents, etag, cache_control, content_disposition, updated, created, size, mime_type FROM file;
		//
		//	DROP TABLE file;
		//	ALTER TABLE file_new RENAME TO file;
		//
		//	CREATE INDEX IDX_file_parent_folder_path_hash ON file (parent_folder_path_hash);

		tempTable := m.table
		tempTable.Name = m.tableName + "_new"

		statements := strings.Builder{}

		statements.WriteString(d.CreateTableSQL(&tempTable))
		statements.WriteString("\n") // CreateTableSQL adds semicolon

		cols := make([]string, 0, len(tempTable.Columns))
		for _, col := range tempTable.Columns {
			cols = append(cols, col.Name)
		}
		statements.WriteString(d.CopyTableData(m.tableName, tempTable.Name, cols, cols))
		statements.WriteString(";\n")

		statements.WriteString(d.DropTable(m.tableName))
		statements.WriteString(";\n")

		statements.WriteString(d.RenameTable(tempTable.Name, m.tableName))
		statements.WriteString(";\n")

		for _, idx := range tempTable.Indices {
			// Use real table name, not temporary one now
			statements.WriteString(d.CreateIndexSQL(m.tableName, idx))
			statements.WriteString("\n") // CreateIndexSQL adds semicolon
		}

		return statements.String()
	} else if d.DriverName() == Postgres {
		return fmt.Sprintf(`
		DO $$
		BEGIN
			-- Drop the unique constraint if it exists
			DROP INDEX IF EXISTS "%s";

			-- Add primary key if it doesn't already exist
			IF NOT EXISTS (SELECT 1 FROM pg_index i WHERE indrelid = '%s'::regclass AND indisprimary) THEN
				ALTER TABLE %s ADD PRIMARY KEY (%s);
			END IF;
		END $$;`, m.uniqueKey.XName(m.tableName), m.tableName, m.tableName, strings.Join(m.uniqueKey.Cols, ","))
	} else {
		return ""
	}
}

// ConvertUniqueKeyToPrimaryKey adds series of migrations to convert existing unique key to PRIMARY KEY.
// For Sqlite this means recreating the table, which only works if there are no foreign keys referencing the table.
// 4 migrations are added in total. migrationNames slice can be used to override names of migrations.
func ConvertUniqueKeyToPrimaryKey(mg *Migrator, tableName string, uniqueKey Index, finalTable Table, migrationNames []string) {
	if tableName == "" {
		panic("invalid table name")
	}
	if len(uniqueKey.Cols) == 0 || uniqueKey.Type != UniqueIndex {
		panic("invalid unique type")
	}
	if tableName != finalTable.Name {
		panic("invalid table name")
	}
	if !slices.Equal(uniqueKey.Cols, finalTable.PrimaryKeys) {
		panic("invalid primary key in the final table")
	}

	colPks := map[string]bool{}
	for _, col := range finalTable.Columns {
		if col.IsPrimaryKey {
			colPks[col.Name] = true
		}
	}
	for _, c := range uniqueKey.Cols {
		if !colPks[c] {
			panic(fmt.Sprintf("column %s is not part of primary key in the table definition", c))
		}
	}

	columnsList := strings.Join(uniqueKey.Cols, ",")

	// migration 1 is to handle cases where the table was created with sql_generate_invisible_primary_key = ON
	// in this case we need to do the conversion in one sql statement
	mysqlMigration1 := NewRawSQLMigration("").Mysql(fmt.Sprintf(`
	  ALTER TABLE %s
	  DROP PRIMARY KEY,
	  DROP COLUMN my_row_id,
	  DROP INDEX %s,
	  ADD PRIMARY KEY (%s);
	`, tableName, uniqueKey.XName(tableName), columnsList))
	mysqlMigration1.Condition = &IfColumnExistsCondition{TableName: tableName, ColumnName: "my_row_id"}
	name1 := migrationName(fmt.Sprintf("drop my_row_id and add primary key with columns %s to table %s if my_row_id exists (auto-generated mysql column)", columnsList, tableName), migrationNames, 0)
	mg.AddMigration(name1, mysqlMigration1)

	mysqlMigration2 := NewRawSQLMigration("").Mysql(fmt.Sprintf(`ALTER TABLE %s DROP INDEX %s`, tableName, uniqueKey.XName(tableName)))
	mysqlMigration2.Condition = &IfIndexExistsCondition{TableName: tableName, IndexName: uniqueKey.XName(tableName)}
	name2 := fmt.Sprintf("drop unique index %s with columns %s from %s table if it exists (mysql)", uniqueKey.XName(tableName), columnsList, tableName)
	mg.AddMigration(migrationName(name2, migrationNames, 1), mysqlMigration2)

	mysqlMigration3 := NewRawSQLMigration("").Mysql(fmt.Sprintf(`ALTER TABLE %s ADD PRIMARY KEY (%s)`, tableName, strings.Join(uniqueKey.Cols, ",")))
	mysqlMigration3.Condition = &IfPrimaryKeyNotExistsCondition{TableName: tableName}
	name3 := fmt.Sprintf("add primary key with columns %s to table %s if it doesn't exist (mysql)", columnsList, tableName)
	mg.AddMigration(migrationName(name3, migrationNames, 2), mysqlMigration3)

	// postgres and sqlite statements are idempotent so we can have only one condition-less migration
	name4 := fmt.Sprintf("add primary key with columns %s to table %s (postgres and sqlite)", columnsList, tableName)
	mg.AddMigration(migrationName(name4, migrationNames, 3), &addPrimaryKeyMigration{tableName: tableName, uniqueKey: uniqueKey, table: finalTable})
}

func migrationName(defaultName string, names []string, idx int) string {
	if idx >= len(names) || names[idx] == "" {
		return defaultName
	}
	return names[idx]
}
