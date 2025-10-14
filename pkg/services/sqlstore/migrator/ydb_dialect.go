package migrator

import (
	"errors"
	"fmt"
	"net/url"
	"strconv"
	"strings"

	"github.com/lib/pq"

	"github.com/grafana/grafana/pkg/util/xorm"
	"github.com/grafana/grafana/pkg/util/xorm/core"
)

type YDBDialect struct {
	BaseDialect
}

func NewYDBDialect() Dialect {
	d := YDBDialect{}
	d.dialect = &d
	d.driverName = YDB
	return &d
}

func (db *YDBDialect) IndexCheckSQL(tableName, indexName string) (string, []any) {
	return "SELECT Path FROM `.sys/partition_stats` where Path LIKE '%/'" +
		" || $1 || '/' || $2 || '/indexImplTable'", []any{tableName, indexName}
}

func (db *YDBDialect) SupportEngine() bool {
	return false
}

func (db *YDBDialect) Quote(name string) string {
	return "`" + name + "`"
}

func (db *YDBDialect) Concat(strs ...string) string {
	return strings.Join(strs, " || ")
}

func (db *YDBDialect) LikeOperator(column string, wildcardBefore bool, pattern string, wildcardAfter bool) (string, string) {
	param := pattern
	if wildcardBefore {
		param = "%" + param
	}
	if wildcardAfter {
		param = param + "%"
	}
	return fmt.Sprintf("%s ILIKE ?", column), param
}

func (db *YDBDialect) AutoIncrStr() string {
	return ""
}

func (db *YDBDialect) BooleanValue(value bool) any {
	return value
}

func (db *YDBDialect) BooleanStr(value bool) string {
	return strconv.FormatBool(value)
}

func (db *YDBDialect) BatchSize() int {
	return 1000
}

func (db *YDBDialect) SQLType(c *Column) string {
	xormDialect := core.QueryDialect(core.YDB)
	column := &core.Column{
		SQLType: core.SQLType{
			Name:           c.Type,
			DefaultLength:  c.Length,
			DefaultLength2: c.Length2,
		},
		IsAutoIncrement: c.IsAutoIncrement,
	}

	return xormDialect.SqlType(column)
}

func (b *YDBDialect) AddColumnSQL(tableName string, col *Column) string {
	col.Default = ""
	col.Nullable = true

	return b.BaseDialect.AddColumnSQL(tableName, col)
}

func (b *YDBDialect) RenameColumn(table Table, column *Column, newName string) string {
	oldName := column.Name
	column.Name = newName
	sql := b.AddColumnSQL(table.Name, column) + ";"
	if !column.IsPrimaryKey {
		column.Name = oldName
		sql += b.DropColumn(table, column)
	}

	return sql
}

// TODO:
func (b *YDBDialect) ColumnCheckSQL(tableName, columnName string) (string, []any) {
	return "", nil
}

func (b *YDBDialect) DropColumn(table Table, column *Column) string {
	return fmt.Sprintf("alter table %s DROP COLUMN %s", b.dialect.Quote(table.Name), b.dialect.Quote(column.Name))
}

func (db *YDBDialect) DropIndexSQL(tableName string, index *Index) string {
	return fmt.Sprintf("alter table %s DROP INDEX %s", db.dialect.Quote(tableName), db.dialect.Quote(index.XName(tableName)))
}

func (db *YDBDialect) UpdateTableSQL(tableName string, columns []*Column) string {
	return ""
	var statements = []string{}

	for _, col := range columns {
		statements = append(statements, "ALTER "+db.Quote(col.Name)+" TYPE "+db.SQLType(col))
	}

	return "ALTER TABLE " + db.Quote(tableName) + " " + strings.Join(statements, ", ") + ";"
}

func (db *YDBDialect) CleanDB(engine *xorm.Engine) error {
	sess := engine.NewSession()
	defer sess.Close()

	if _, err := sess.Exec("DROP SCHEMA public CASCADE;"); err != nil {
		return fmt.Errorf("%v: %w", "failed to drop schema public", err)
	}

	if _, err := sess.Exec("CREATE SCHEMA public;"); err != nil {
		return fmt.Errorf("%v: %w", "failed to create schema public", err)
	}

	return nil
}

func (b *YDBDialect) Default(col *Column) string {
	if col.Type == DB_Bool {
		// Ensure that all dialects support the same literals in the same way.
		bl, err := strconv.ParseBool(col.Default)
		if err != nil {
			panic(fmt.Errorf("failed to create default value for column '%s': invalid boolean default value '%s'", col.Name, col.Default))
		}
		return b.dialect.BooleanStr(bl)
	}

	if col.Type == DB_NVarchar {
		return `"` + col.Default + `"`
	}

	return col.Default
}

func (b *YDBDialect) CreateTableSQL(table *Table) string {
	sql := "CREATE TABLE IF NOT EXISTS "
	sql += b.dialect.Quote(table.Name) + " (\n"

	pkList := table.PrimaryKeys

	for _, col := range table.Columns {
		sql += col.StringNoPk(b.dialect)
		sql = strings.TrimSpace(sql)
		sql += "\n, "
	}

	if len(pkList) > 0 {
		quotedCols := []string{}
		for _, col := range pkList {
			quotedCols = append(quotedCols, b.dialect.Quote(col))
		}

		sql += "PRIMARY KEY ( " + strings.Join(quotedCols, ",") + " ), "
	}

	sql = sql[:len(sql)-2] + ")"

	sql += ";"
	return sql
}

// TruncateDBTables truncates all the tables.
// A special case is the dashboard_acl table where we keep the default permissions.
func (db *YDBDialect) TruncateDBTables(engine *xorm.Engine) error {
	tables, err := engine.Dialect().GetTables()
	if err != nil {
		return err
	}
	sess := engine.NewSession()
	defer sess.Close()

	dbName, err := db.GetDBName(engine.DataSourceName())
	if err != nil {
		return err
	}

	for _, table := range tables {
		switch table.Name {
		case "":
			continue
		case "migration_log":
			continue
		case "dashboard_acl":
			// keep default dashboard permissions
			if _, err := sess.Exec(fmt.Sprintf("DELETE FROM %v WHERE dashboard_id != -1 AND org_id != -1;", db.Quote(table.Name))); err != nil {
				return fmt.Errorf("failed to truncate table %q: %w", table.Name, err)
			}
			if _, err := sess.Exec(fmt.Sprintf("ALTER SEQUENCE %v RESTART WITH 3;", db.Quote(fmt.Sprintf("%s/%v/_serial_column_id", dbName, table.Name)))); err != nil {
				return fmt.Errorf("failed to reset table %q: %w", table.Name, err)
			}
		default:
			if _, err := sess.Exec(fmt.Sprintf("DELETE FROM %v;", db.Quote(table.Name))); err != nil {
				if db.isUndefinedTable(err) {
					continue
				}
				return fmt.Errorf("failed to truncate table %q: %w", table.Name, err)
			}

			_, tableCols, err := engine.Dialect().GetColumns(table.Name)
			if err != nil {
				return err
			}

			for _, column := range tableCols {
				if column.IsAutoIncrement {
					sequenceName := fmt.Sprintf("%v/%v/_serial_column_%v", dbName, table.Name, column.Name)
					if _, err := sess.Exec(fmt.Sprintf("ALTER SEQUENCE %v RESTART;", db.Quote(sequenceName))); err != nil {
						return fmt.Errorf("failed to reset sequence %q: %w", sequenceName, err)
					}
				}
			}
		}
	}

	return nil
}

func (db *YDBDialect) isThisError(err error, errcode string) bool {
	var driverErr *pq.Error
	if errors.As(err, &driverErr) {
		if string(driverErr.Code) == errcode {
			return true
		}
	}

	return false
}

func (db *YDBDialect) ErrorMessage(err error) string {
	var driverErr *pq.Error
	if errors.As(err, &driverErr) {
		return driverErr.Message
	}
	return ""
}

func (db *YDBDialect) isUndefinedTable(err error) bool {
	return db.isThisError(err, "42P01")
}

func (db *YDBDialect) IsUniqueConstraintViolation(err error) bool {
	return db.isThisError(err, "23505")
}

func (db *YDBDialect) IsDeadlock(err error) bool {
	return db.isThisError(err, "40P01")
}

func (db *YDBDialect) CreateIndexSQL(tableName string, index *Index) string {
	indexName := db.Quote(index.XName(tableName))
	tableName = db.Quote(tableName)

	colsIndex := make([]string, len(index.Cols))
	for i := 0; i < len(index.Cols); i++ {
		colsIndex[i] = db.Quote(index.Cols[i])
	}

	indexOn := strings.Join(colsIndex, ",")

	var buf strings.Builder
	buf.WriteString(fmt.Sprintf("ALTER TABLE %s ADD INDEX %s GLOBAL ON ( %s );", tableName, indexName, indexOn))

	return buf.String()
}

// UpsertSQL returns the upsert sql statement for PostgreSQL dialect
func (db *YDBDialect) UpsertSQL(tableName string, keyCols, updateCols []string) string {
	str, _ := db.UpsertMultipleSQL(tableName, keyCols, updateCols, 1)
	return str
}

// UpsertMultipleSQL returns the upsert sql statement for PostgreSQL dialect
func (db *YDBDialect) UpsertMultipleSQL(tableName string, keyCols, updateCols []string, count int) (string, error) {
	if count < 1 {
		return "", fmt.Errorf("upsert statement must have count >= 1. Got %v", count)
	}
	columnsStr := strings.Builder{}
	onConflictStr := strings.Builder{}
	setStr := strings.Builder{}

	const separator = ", "
	separatorVar := separator
	for i, c := range updateCols {
		if i == len(updateCols)-1 {
			separatorVar = ""
		}

		columnsStr.WriteString(fmt.Sprintf("%s%s", db.Quote(c), separatorVar))
		setStr.WriteString(fmt.Sprintf("%s=EXCLUDED.%s%s", db.Quote(c), db.Quote(c), separatorVar))
	}

	separatorVar = separator
	for i, c := range keyCols {
		if i == len(keyCols)-1 {
			separatorVar = ""
		}
		onConflictStr.WriteString(fmt.Sprintf("%s%s", db.Quote(c), separatorVar))
	}

	valuesStr := strings.Builder{}
	separatorVar = separator
	nextPlaceHolder := 1

	for i := 0; i < count; i++ {
		if i == count-1 {
			separatorVar = ""
		}

		colPlaceHoldersStr := strings.Builder{}
		placeHolderSep := separator
		for j := 1; j <= len(updateCols); j++ {
			if j == len(updateCols) {
				placeHolderSep = ""
			}
			placeHolder := fmt.Sprintf("$%v%s", nextPlaceHolder, placeHolderSep)
			nextPlaceHolder++
			colPlaceHoldersStr.WriteString(placeHolder)
		}
		colPlaceHolders := colPlaceHoldersStr.String()

		valuesStr.WriteString(fmt.Sprintf("(%s)%s", colPlaceHolders, separatorVar))
	}

	s := fmt.Sprintf(`UPSERT INTO %s (%s) VALUES %s;`,
		tableName,
		columnsStr.String(),
		valuesStr.String(),
		// onConflictStr.String(),
		// setStr.String(),
	)

	return s, nil
}

// func (db *YDBDialect) Lock(cfg LockCfg) error {
// 	// trying to obtain the lock for a resource identified by a 64-bit or 32-bit key value
// 	// the lock is exclusive: multiple lock requests stack, so that if the same resource is locked three times
// 	// it must then be unlocked three times to be released for other sessions' use.
// 	// it will either obtain the lock immediately and return true,
// 	// or return false if the lock cannot be acquired immediately.
// 	query := "SELECT pg_try_advisory_lock(?)"
// 	var success bool

// 	_, err := cfg.Session.SQL(query, cfg.Key).Get(&success)
// 	if err != nil {
// 		return err
// 	}
// 	if !success {
// 		return ErrLockDB
// 	}

// 	return nil
// }

// func (db *YDBDialect) Unlock(cfg LockCfg) error {
// 	// trying to release a previously-acquired exclusive session level advisory lock.
// 	// it will either return true if the lock is successfully released or
// 	// false if the lock was not held (in addition an SQL warning will be reported by the server)
// 	query := "SELECT pg_advisory_unlock(?)"
// 	var success bool

// 	_, err := cfg.Session.SQL(query, cfg.Key).Get(&success)
// 	if err != nil {
// 		return err
// 	}
// 	if !success {
// 		return ErrReleaseLockDB
// 	}
// 	return nil
// }

func (db *YDBDialect) GetDBName(dsn string) (string, error) {
	uri, err := url.Parse(dsn)
	if err != nil {
		return "", fmt.Errorf("failed on parse data source %v", dsn)
	}

	return uri.Path, nil
}
