package migrator

import (
	"context"
	"fmt"
	"strconv"
	"strings"

	"golang.org/x/exp/slices"

	"github.com/grafana/grafana/pkg/services/sqlstore/session"
	"github.com/grafana/grafana/pkg/util/xorm"
)

var (
	ErrLockDB        = fmt.Errorf("failed to obtain lock")
	ErrReleaseLockDB = fmt.Errorf("failed to release lock")
)

type Dialect interface {
	DriverName() string
	Quote(string) string
	AndStr() string
	AutoIncrStr() string
	OrStr() string
	EqStr() string
	ShowCreateNull() bool
	SQLType(col *Column) string
	SupportEngine() bool
	// LikeOperator returns SQL snippet and query parameter for case-insensitive LIKE operation, with optional wildcards (%) before/after the pattern.
	LikeOperator(column string, wildcardBefore bool, pattern string, wildcardAfter bool) (string, string)
	Default(col *Column) string
	// BooleanValue can be used as an argument in SELECT or INSERT statements. For constructing
	// raw SQL queries, please use BooleanStr instead.
	BooleanValue(bool) any
	// BooleanStr should only be used to construct SQL statements (strings). For arguments to queries, use BooleanValue instead.
	BooleanStr(bool) string
	DateTimeFunc(string) string
	BatchSize() int
	UnionDistinct() string // this is the default UNION type
	UnionAll() string

	OrderBy(order string) string

	CreateIndexSQL(tableName string, index *Index) string
	CreateTableSQL(table *Table) string
	AddColumnSQL(tableName string, col *Column) string
	CopyTableData(sourceTable string, targetTable string, sourceCols []string, targetCols []string) string
	DropTable(tableName string) string
	DropIndexSQL(tableName string, index *Index) string

	// RenameTable is deprecated, its use cause breaking changes
	// so, it should no longer be used. Kept for legacy reasons.
	RenameTable(oldName string, newName string) string
	// RenameColumn is deprecated, its use cause breaking changes
	// so, it should no longer be used. Kept for legacy reasons.
	RenameColumn(table Table, column *Column, newName string) string

	UpdateTableSQL(tableName string, columns []*Column) string

	IndexCheckSQL(tableName, indexName string) (string, []any)
	ColumnCheckSQL(tableName, columnName string) (string, []any)
	// UpsertSQL returns the upsert sql statement for a dialect
	UpsertSQL(tableName string, keyCols, updateCols []string) string
	UpsertMultipleSQL(tableName string, keyCols, updateCols []string, count int) (string, error)

	ColString(*Column) string
	ColStringNoPk(*Column) string

	Limit(limit int64) string
	LimitOffset(limit int64, offset int64) string

	PreInsertId(table string, sess *xorm.Session) error
	PostInsertId(table string, sess *xorm.Session) error

	CleanDB(engine *xorm.Engine) error
	TruncateDBTables(engine *xorm.Engine) error
	// CreateDatabaseFromSnapshot is called when migration log table is not found.
	// Dialect can recreate all tables from existing snapshot. After successful (nil error) return,
	// migrator will list migrations from the log, and apply all missing migrations.
	CreateDatabaseFromSnapshot(ctx context.Context, engine *xorm.Engine, migrationLogTableName string) error

	IsUniqueConstraintViolation(err error) bool
	ErrorMessage(err error) string
	IsDeadlock(err error) bool
	Lock(LockCfg) error
	Unlock(LockCfg) error

	GetDBName(string) (string, error)

	// InsertQuery accepts a table name and a map of column names to values to insert.
	// It returns a query string and a slice of parameters that can be executed against the database.
	InsertQuery(tableName string, row map[string]any) (string, []any, error)
	// UpdateQuery accepts a table name, a map of column names to values to update, and a map of
	// column names to values to use in the where clause.
	// It returns a query string and a slice of parameters that can be executed against the database.
	UpdateQuery(tableName string, row map[string]any, where map[string]any) (string, []any, error)
	// Insert accepts a table name and a map of column names to insert.
	// The insert is executed as part of the provided session.
	Insert(ctx context.Context, tx *session.SessionTx, tableName string, row map[string]any) error
	// Update accepts a table name, a map of column names to values to update, and a map of
	// column names to values to use in the where clause.
	// The update is executed as part of the provided session.
	Update(ctx context.Context, tx *session.SessionTx, tableName string, row map[string]any, where map[string]any) error
	// Concat returns the sql statement for concating multiple strings
	// Implementations are not expected to quote the arguments
	// therefore any callers should take care to quote arguments as necessary
	Concat(...string) string
}

type LockCfg struct {
	Session *xorm.Session
	Key     string
	Timeout int
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

func (b *BaseDialect) AndStr() string {
	return "AND"
}

func (b *BaseDialect) LikeOperator(column string, wildcardBefore bool, pattern string, wildcardAfter bool) (string, string) {
	param := pattern
	if wildcardBefore {
		param = "%" + param
	}
	if wildcardAfter {
		param = param + "%"
	}
	return fmt.Sprintf("%s LIKE ?", column), param
}

func (b *BaseDialect) OrStr() string {
	return "OR"
}

func (b *BaseDialect) EqStr() string {
	return "="
}

func (b *BaseDialect) Default(col *Column) string {
	if col.Type == DB_Bool {
		// Ensure that all dialects support the same literals in the same way.
		bl, err := strconv.ParseBool(col.Default)
		if err != nil {
			panic(fmt.Errorf("failed to create default value for column '%s': invalid boolean default value '%s'", col.Name, col.Default))
		}
		return b.dialect.BooleanStr(bl)
	}
	return col.Default
}

func (b *BaseDialect) DateTimeFunc(value string) string {
	return value
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
		quotedCols := []string{}
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

	quotedCols := []string{}
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
	return fmt.Sprintf("INSERT INTO %s (%s) SELECT %s FROM %s", quote(targetTable), targetColsSQL, sourceColsSQL, quote(sourceTable))
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

func (b *BaseDialect) ColumnCheckSQL(tableName, columnName string) (string, []any) {
	return "", nil
}

func (b *BaseDialect) DropIndexSQL(tableName string, index *Index) string {
	quote := b.dialect.Quote
	name := index.XName(tableName)
	return fmt.Sprintf("DROP INDEX %v ON %s", quote(name), quote(tableName))
}

func (b *BaseDialect) UpdateTableSQL(tableName string, columns []*Column) string {
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

func (b *BaseDialect) Limit(limit int64) string {
	return fmt.Sprintf(" LIMIT %d", limit)
}

func (b *BaseDialect) LimitOffset(limit int64, offset int64) string {
	return fmt.Sprintf(" LIMIT %d OFFSET %d", limit, offset)
}

func (b *BaseDialect) PreInsertId(table string, sess *xorm.Session) error {
	return nil
}

func (b *BaseDialect) PostInsertId(table string, sess *xorm.Session) error {
	return nil
}

func (b *BaseDialect) CleanDB(engine *xorm.Engine) error {
	return nil
}

func (b *BaseDialect) CreateDatabaseFromSnapshot(ctx context.Context, engine *xorm.Engine, tableName string) error {
	return nil
}

func (b *BaseDialect) TruncateDBTables(engine *xorm.Engine) error {
	return nil
}

// UpsertSQL returns empty string
func (b *BaseDialect) UpsertSQL(tableName string, keyCols, updateCols []string) string {
	return ""
}

func (b *BaseDialect) Lock(_ LockCfg) error {
	return nil
}

func (b *BaseDialect) Unlock(_ LockCfg) error {
	return nil
}

func (b *BaseDialect) OrderBy(order string) string {
	return order
}

func (b *BaseDialect) GetDBName(_ string) (string, error) {
	return "", nil
}

func (b *BaseDialect) InsertQuery(tableName string, row map[string]any) (string, []any, error) {
	if len(row) < 1 {
		return "", nil, fmt.Errorf("no columns provided")
	}

	// allocate slices
	cols := make([]string, 0, len(row))
	vals := make([]any, 0, len(row))
	keys := make([]string, 0, len(row))

	// create sorted list of columns
	for col := range row {
		keys = append(keys, col)
	}
	slices.Sort(keys)

	// build query and values
	for _, col := range keys {
		cols = append(cols, b.dialect.Quote(col))
		vals = append(vals, row[col])
	}

	return fmt.Sprintf("INSERT INTO %s (%s) VALUES (%s)", b.dialect.Quote(tableName), strings.Join(cols, ", "), strings.Repeat("?, ", len(row)-1)+"?"), vals, nil
}

func (b *BaseDialect) UpdateQuery(tableName string, row map[string]any, where map[string]any) (string, []any, error) {
	if len(row) < 1 {
		return "", nil, fmt.Errorf("no columns provided")
	}

	if len(where) < 1 {
		return "", nil, fmt.Errorf("no where clause provided")
	}

	// allocate slices
	cols := make([]string, 0, len(row))
	whereCols := make([]string, 0, len(where))
	vals := make([]any, 0, len(row)+len(where))
	keys := make([]string, 0, len(row))

	// create sorted list of columns to update
	for col := range row {
		keys = append(keys, col)
	}
	slices.Sort(keys)

	// build update query and values
	for _, col := range keys {
		cols = append(cols, b.dialect.Quote(col)+"=?")
		vals = append(vals, row[col])
	}

	// create sorted list of columns for where clause
	keys = make([]string, 0, len(where))
	for col := range where {
		keys = append(keys, col)
	}
	slices.Sort(keys)

	// build where clause and values
	for _, col := range keys {
		whereCols = append(whereCols, b.dialect.Quote(col)+"=?")
		vals = append(vals, where[col])
	}

	return fmt.Sprintf("UPDATE %s SET %s WHERE %s", b.dialect.Quote(tableName), strings.Join(cols, ", "), strings.Join(whereCols, " AND ")), vals, nil
}

func (b *BaseDialect) Insert(ctx context.Context, tx *session.SessionTx, tableName string, row map[string]any) error {
	query, args, err := b.InsertQuery(tableName, row)
	if err != nil {
		return err
	}

	_, err = tx.Exec(ctx, query, args...)
	return err
}

func (b *BaseDialect) Update(ctx context.Context, tx *session.SessionTx, tableName string, row map[string]any, where map[string]any) error {
	query, args, err := b.UpdateQuery(tableName, row, where)
	if err != nil {
		return err
	}

	_, err = tx.Exec(ctx, query, args...)
	return err
}

func (b *BaseDialect) Concat(strs ...string) string {
	return fmt.Sprintf("CONCAT(%s)", strings.Join(strs, ", "))
}

func (b *BaseDialect) UnionDistinct() string {
	return "UNION"
}

func (b *BaseDialect) UnionAll() string {
	return "UNION ALL"
}
