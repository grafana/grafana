package migrator

import (
	"context"
	"database/sql"
	"fmt"
	"strconv"
	"strings"
)

var (
	ErrLockDB        = fmt.Errorf("failed to obtain lock")
	ErrReleaseLockDB = fmt.Errorf("failed to release lock")
)

type Dialect interface {
	DriverName() string
	Quote(string) string
	AutoIncrStr() string
	ShowCreateNull() bool
	SQLType(col *Column) string
	SupportEngine() bool
	Default(col *Column) string
	BooleanStr(bool) string

	CreateIndexSQL(tableName string, index *Index) string
	CreateTableSQL(table *Table) string
	AddColumnSQL(tableName string, col *Column) string
	CopyTableData(sourceTable string, targetTable string, sourceCols []string, targetCols []string) string
	DropTable(tableName string) string
	DropIndexSQL(tableName string, index *Index) string
	RenameTable(oldName string, newName string) string
	RenameColumn(table Table, column *Column, newName string) string
	UpdateTableSQL(tableName string, columns []*Column) string

	TableCheckSQL(tableName string) (string, []any)
	IndexCheckSQL(tableName, indexName string) (string, []any)
	ColumnCheckSQL(tableName, columnName string) (string, []any)

	ColString(*Column) string
	ColStringNoPk(*Column) string

	GetDBName(context.Context, *sql.DB) (string, error)
	Lock(context.Context, *sql.Conn, string, int) error
	Unlock(context.Context, *sql.Conn, string) error
}

type dialectFunc func() Dialect

var supportedDialects = map[string]dialectFunc{
	MySQL:                  NewMysqlDialect,
	SQLite:                 NewSQLite3Dialect,
	Postgres:               NewPostgresDialect,
	MySQL + "WithHooks":    NewMysqlDialect,
	SQLite + "WithHooks":   NewSQLite3Dialect,
	Postgres + "WithHooks": NewPostgresDialect,
}

func NewDialect(driverName string) Dialect {
	if fn, exist := supportedDialects[driverName]; exist {
		return fn()
	}

	panic("Unsupported database type: " + driverName)
}

type BaseDialect struct {
	dialect    Dialect
	driverName string
}

func (b *BaseDialect) DriverName() string {
	return b.driverName
}

func (b *BaseDialect) ShowCreateNull() bool {
	return true
}

func (b *BaseDialect) Default(col *Column) string {
	if col.Type == DB_Bool {
		bl, err := strconv.ParseBool(col.Default)
		if err != nil {
			panic(fmt.Errorf("failed to create default value for column '%s': invalid boolean default value '%s'", col.Name, col.Default))
		}
		return b.dialect.BooleanStr(bl)
	}
	return col.Default
}

func (b *BaseDialect) CreateTableSQL(table *Table) string {
	sql := "CREATE TABLE IF NOT EXISTS "
	sql += b.dialect.Quote(table.Name) + " (\n"

	pkList := table.PrimaryKeys

	for _, col := range table.Columns {
		if col.IsPrimaryKey && len(pkList) == 1 {
			sql += col.String(b.dialect)
		} else {
			sql += col.StringNoPk(b.dialect)
		}
		sql = strings.TrimSpace(sql)
		sql += "\n, "
	}

	if len(pkList) > 1 {
		quotedCols := make([]string, 0, len(pkList))
		for _, col := range pkList {
			quotedCols = append(quotedCols, b.dialect.Quote(col))
		}

		sql += "PRIMARY KEY ( " + strings.Join(quotedCols, ",") + " ), "
	}

	sql = sql[:len(sql)-2] + ")"
	if b.dialect.SupportEngine() {
		sql += " ENGINE=InnoDB DEFAULT CHARSET utf8mb4 COLLATE utf8mb4_unicode_ci"
	}

	sql += ";"
	return sql
}

func (b *BaseDialect) AddColumnSQL(tableName string, col *Column) string {
	return fmt.Sprintf("alter table %s ADD COLUMN %s", b.dialect.Quote(tableName), col.StringNoPk(b.dialect))
}

func (b *BaseDialect) CreateIndexSQL(tableName string, index *Index) string {
	quote := b.dialect.Quote
	var unique string
	if index.Type == UniqueIndex {
		unique = " UNIQUE"
	}

	idxName := index.XName(tableName)

	quotedCols := make([]string, 0, len(index.Cols))
	for _, col := range index.Cols {
		quotedCols = append(quotedCols, b.dialect.Quote(col))
	}

	return fmt.Sprintf("CREATE%s INDEX %v ON %v (%v);", unique, quote(idxName), quote(tableName), strings.Join(quotedCols, ","))
}

func (b *BaseDialect) QuoteColList(cols []string) string {
	var sourceColsSQL = ""
	for _, col := range cols {
		sourceColsSQL += b.dialect.Quote(col)
		sourceColsSQL += "\n, "
	}
	return strings.TrimSuffix(sourceColsSQL, "\n, ")
}

func (b *BaseDialect) CopyTableData(sourceTable string, targetTable string, sourceCols []string, targetCols []string) string {
	sourceColsSQL := b.QuoteColList(sourceCols)
	targetColsSQL := b.QuoteColList(targetCols)

	quote := b.dialect.Quote
	return fmt.Sprintf("INSERT INTO %s (%s)\nSELECT %s\nFROM %s", quote(targetTable), targetColsSQL, sourceColsSQL, quote(sourceTable))
}

func (b *BaseDialect) DropTable(tableName string) string {
	quote := b.dialect.Quote
	return fmt.Sprintf("DROP TABLE IF EXISTS %s", quote(tableName))
}

func (b *BaseDialect) RenameTable(oldName string, newName string) string {
	quote := b.dialect.Quote
	return fmt.Sprintf("ALTER TABLE %s RENAME TO %s", quote(oldName), quote(newName))
}

func (b *BaseDialect) RenameColumn(table Table, column *Column, newName string) string {
	quote := b.dialect.Quote
	return fmt.Sprintf(
		"ALTER TABLE %s RENAME COLUMN %s TO %s",
		quote(table.Name), quote(column.Name), quote(newName),
	)
}

func (b *BaseDialect) DropIndexSQL(tableName string, index *Index) string {
	quote := b.dialect.Quote
	name := index.XName(tableName)
	return fmt.Sprintf("DROP INDEX %v ON %s", quote(name), quote(tableName))
}

func (b *BaseDialect) UpdateTableSQL(tableName string, _ []*Column) string {
	return "-- NOT REQUIRED"
}

func (b *BaseDialect) ColString(col *Column) string {
	sql := b.dialect.Quote(col.Name) + " "

	sql += b.dialect.SQLType(col) + " "

	if col.IsPrimaryKey {
		sql += "PRIMARY KEY "
		if col.IsAutoIncrement {
			sql += b.dialect.AutoIncrStr() + " "
		}
	}

	if b.dialect.ShowCreateNull() {
		if col.Nullable {
			sql += "NULL "
		} else {
			sql += "NOT NULL "
		}
	}

	if col.Default != "" {
		sql += "DEFAULT " + b.dialect.Default(col) + " "
	}

	return sql
}

func (b *BaseDialect) ColStringNoPk(col *Column) string {
	sql := b.dialect.Quote(col.Name) + " "

	sql += b.dialect.SQLType(col) + " "

	if b.dialect.ShowCreateNull() {
		if col.Nullable {
			sql += "NULL "
		} else {
			sql += "NOT NULL "
		}
	}

	if col.Default != "" {
		sql += "DEFAULT " + b.dialect.Default(col) + " "
	}

	return sql
}

func (b *BaseDialect) TableCheckSQL(tableName string) (string, []any) {
	return "", []any{tableName}
}

func (b *BaseDialect) IndexCheckSQL(tableName, indexName string) (string, []any) {
	return "", []any{tableName, indexName}
}

func (b *BaseDialect) ColumnCheckSQL(tableName, columnName string) (string, []any) {
	return "", []any{tableName, columnName}
}

func (b *BaseDialect) GetDBName(_ context.Context, _ *sql.DB) (string, error) {
	return "", nil
}

func (b *BaseDialect) Lock(_ context.Context, _ *sql.Conn, _ string, _ int) error {
	return nil
}

func (b *BaseDialect) Unlock(_ context.Context, _ *sql.Conn, _ string) error {
	return nil
}
