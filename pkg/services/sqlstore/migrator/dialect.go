package migrator

import (
	"fmt"
	"strings"
)

type Dialect interface {
	DriverName() string
	QuoteStr() string
	Quote(string) string
	AndStr() string
	AutoIncrStr() string
	OrStr() string
	EqStr() string
	ShowCreateNull() bool
	SqlType(col *Column) string
	SupportEngine() bool
	LikeStr() string
	Default(col *Column) string
	BooleanStr(bool) string
	DateTimeFunc(string) string

	CreateIndexSql(tableName string, index *Index) string
	CreateTableSql(table *Table) string
	AddColumnSql(tableName string, col *Column) string
	CopyTableData(sourceTable string, targetTable string, sourceCols []string, targetCols []string) string
	DropTable(tableName string) string
	DropIndexSql(tableName string, index *Index) string

	TableCheckSql(tableName string) (string, []interface{})
	RenameTable(oldName string, newName string) string
	UpdateTableSql(tableName string, columns []*Column) string
}

func NewDialect(name string) Dialect {
	switch name {
	case MYSQL:
		return NewMysqlDialect()
	case SQLITE:
		return NewSqlite3Dialect()
	case POSTGRES:
		return NewPostgresDialect()
	}

	panic("Unsupported database type: " + name)
}

type BaseDialect struct {
	dialect    Dialect
	driverName string
}

func (d *BaseDialect) DriverName() string {
	return d.driverName
}

func (b *BaseDialect) ShowCreateNull() bool {
	return true
}

func (b *BaseDialect) AndStr() string {
	return "AND"
}

func (b *BaseDialect) LikeStr() string {
	return "LIKE"
}

func (b *BaseDialect) OrStr() string {
	return "OR"
}

func (b *BaseDialect) EqStr() string {
	return "="
}

func (b *BaseDialect) Default(col *Column) string {
	return col.Default
}

func (db *BaseDialect) DateTimeFunc(value string) string {
	return value
}

func (b *BaseDialect) CreateTableSql(table *Table) string {
	var sql string
	sql = "CREATE TABLE IF NOT EXISTS "
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
		sql += "PRIMARY KEY ( "
		sql += b.dialect.Quote(strings.Join(pkList, b.dialect.Quote(",")))
		sql += " ), "
	}

	sql = sql[:len(sql)-2] + ")"
	if b.dialect.SupportEngine() {
		sql += " ENGINE=InnoDB DEFAULT CHARSET utf8mb4 COLLATE utf8mb4_unicode_ci"
	}

	sql += ";"
	return sql
}

func (db *BaseDialect) AddColumnSql(tableName string, col *Column) string {
	return fmt.Sprintf("alter table %s ADD COLUMN %s", db.dialect.Quote(tableName), col.StringNoPk(db.dialect))
}

func (db *BaseDialect) CreateIndexSql(tableName string, index *Index) string {
	quote := db.dialect.Quote
	var unique string
	if index.Type == UniqueIndex {
		unique = " UNIQUE"
	}

	idxName := index.XName(tableName)

	return fmt.Sprintf("CREATE%s INDEX %v ON %v (%v);", unique,
		quote(idxName), quote(tableName),
		quote(strings.Join(index.Cols, quote(","))))
}

func (db *BaseDialect) QuoteColList(cols []string) string {
	var sourceColsSql = ""
	for _, col := range cols {
		sourceColsSql += db.dialect.Quote(col)
		sourceColsSql += "\n, "
	}
	return strings.TrimSuffix(sourceColsSql, "\n, ")
}

func (db *BaseDialect) CopyTableData(sourceTable string, targetTable string, sourceCols []string, targetCols []string) string {
	sourceColsSql := db.QuoteColList(sourceCols)
	targetColsSql := db.QuoteColList(targetCols)

	quote := db.dialect.Quote
	return fmt.Sprintf("INSERT INTO %s (%s) SELECT %s FROM %s", quote(targetTable), targetColsSql, sourceColsSql, quote(sourceTable))
}

func (db *BaseDialect) DropTable(tableName string) string {
	quote := db.dialect.Quote
	return fmt.Sprintf("DROP TABLE IF EXISTS %s", quote(tableName))
}

func (db *BaseDialect) RenameTable(oldName string, newName string) string {
	quote := db.dialect.Quote
	return fmt.Sprintf("ALTER TABLE %s RENAME TO %s", quote(oldName), quote(newName))
}

func (db *BaseDialect) DropIndexSql(tableName string, index *Index) string {
	quote := db.dialect.Quote
	var name string
	name = index.XName(tableName)
	return fmt.Sprintf("DROP INDEX %v ON %s", quote(name), quote(tableName))
}

func (db *BaseDialect) UpdateTableSql(tableName string, columns []*Column) string {
	return "-- NOT REQUIRED"
}
