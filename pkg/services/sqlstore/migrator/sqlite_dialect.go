package migrator

import (
	"fmt"
	"strings"

	"github.com/grafana/grafana/pkg/util/sqlite"
	"github.com/grafana/grafana/pkg/util/xorm"
)

type SQLite3 struct {
	BaseDialect
}

func NewSQLite3Dialect() Dialect {
	d := SQLite3{}
	d.dialect = &d
	d.driverName = SQLite
	return &d
}

func (db *SQLite3) SupportEngine() bool {
	return false
}

func (db *SQLite3) Quote(name string) string {
	return "`" + name + "`"
}

func (db *SQLite3) AutoIncrStr() string {
	return "AUTOINCREMENT"
}

func (db *SQLite3) BooleanValue(value bool) any {
	if value {
		return 1
	}
	return 0
}

func (db *SQLite3) BooleanStr(value bool) string {
	if value {
		return "1"
	}
	return "0"
}

func (db *SQLite3) BatchSize() int {
	// SQLite has a maximum parameter count per statement of 100.
	// So, we use a small batch size to support write operations.
	return 10
}

func (db *SQLite3) DateTimeFunc(value string) string {
	return "datetime(" + value + ")"
}

func (db *SQLite3) SQLType(c *Column) string {
	switch c.Type {
	case DB_Date, DB_DateTime, DB_TimeStamp, DB_Time:
		return DB_DateTime
	case DB_TimeStampz:
		return DB_Text
	case DB_Char, DB_Varchar, DB_NVarchar, DB_TinyText, DB_Text, DB_MediumText, DB_LongText:
		return DB_Text
	case DB_Bit, DB_TinyInt, DB_SmallInt, DB_MediumInt, DB_Int, DB_Integer, DB_BigInt, DB_Bool:
		return DB_Integer
	case DB_Float, DB_Double, DB_Real:
		return DB_Real
	case DB_Decimal, DB_Numeric:
		return DB_Numeric
	case DB_TinyBlob, DB_Blob, DB_MediumBlob, DB_LongBlob, DB_Bytea, DB_Binary, DB_VarBinary:
		return DB_Blob
	case DB_Serial, DB_BigSerial:
		c.IsPrimaryKey = true
		c.IsAutoIncrement = true
		c.Nullable = false
		return DB_Integer
	default:
		return c.Type
	}
}

func (db *SQLite3) IndexCheckSQL(tableName, indexName string) (string, []any) {
	args := []any{tableName, indexName}
	sql := "SELECT 1 FROM " + db.Quote("sqlite_master") + " WHERE " + db.Quote("type") + "='index' AND " + db.Quote("tbl_name") + "=? AND " + db.Quote("name") + "=?"
	return sql, args
}

func (db *SQLite3) DropIndexSQL(tableName string, index *Index) string {
	quote := db.Quote
	// var unique string
	idxName := index.XName(tableName)
	return fmt.Sprintf("DROP INDEX %v", quote(idxName))
}

func (db *SQLite3) CleanDB(engine *xorm.Engine) error {
	return nil
}

// TruncateDBTables deletes all data from all the tables and resets the sequences.
// A special case is the dashboard_acl table where we keep the default permissions.
func (db *SQLite3) TruncateDBTables(engine *xorm.Engine) error {
	tables, err := engine.Dialect().GetTables()
	if err != nil {
		return err
	}

	sess := engine.NewSession()
	defer sess.Close()

	for _, table := range tables {
		switch table.Name {
		case "migration_log":
			continue
		case "dashboard_acl":
			// keep default dashboard permissions
			if _, err := sess.Exec(fmt.Sprintf("DELETE FROM %q WHERE dashboard_id != -1 AND org_id != -1;", table.Name)); err != nil {
				return fmt.Errorf("failed to truncate table %q: %w", table.Name, err)
			}
			if _, err := sess.Exec("UPDATE sqlite_sequence SET seq = 2 WHERE name = '%s';", table.Name); err != nil {
				return fmt.Errorf("failed to cleanup sqlite_sequence: %w", err)
			}
		default:
			if _, err := sess.Exec(fmt.Sprintf("DELETE FROM %s;", table.Name)); err != nil {
				return fmt.Errorf("failed to truncate table %q: %w", table.Name, err)
			}
		}
	}
	if _, err := sess.Exec("UPDATE sqlite_sequence SET seq = 0 WHERE name != 'dashboard_acl';"); err != nil {
		// if we have not created any autoincrement columns in the database this will fail, the error is expected and we can ignore it
		// we can't discriminate based on code because sqlite returns a generic error code
		if err.Error() != "no such table: sqlite_sequence" {
			return fmt.Errorf("failed to cleanup sqlite_sequence: %w", err)
		}
	}
	return nil
}

func (db *SQLite3) ErrorMessage(err error) string {
	return sqlite.ErrorMessage(err)
}

func (db *SQLite3) IsUniqueConstraintViolation(err error) bool {
	return sqlite.IsUniqueConstraintViolation(err)
}

func (db *SQLite3) IsDeadlock(err error) bool {
	return false // No deadlock
}

// UpsertSQL returns the upsert sql statement for SQLite dialect
func (db *SQLite3) UpsertSQL(tableName string, keyCols, updateCols []string) string {
	str, _ := db.UpsertMultipleSQL(tableName, keyCols, updateCols, 1)
	return str
}

// UpsertMultipleSQL returns the upsert sql statement for PostgreSQL dialect
func (db *SQLite3) UpsertMultipleSQL(tableName string, keyCols, updateCols []string, count int) (string, error) {
	if count < 1 {
		return "", fmt.Errorf("upsert statement must have count >= 1. Got %v", count)
	}
	columnsStr := strings.Builder{}
	onConflictStr := strings.Builder{}
	colPlaceHoldersStr := strings.Builder{}
	setStr := strings.Builder{}

	const separator = ", "
	separatorVar := separator
	for i, c := range updateCols {
		if i == len(updateCols)-1 {
			separatorVar = ""
		}

		columnsStr.WriteString(fmt.Sprintf("%s%s", db.Quote(c), separatorVar))
		colPlaceHoldersStr.WriteString(fmt.Sprintf("?%s", separatorVar))
		setStr.WriteString(fmt.Sprintf("%s=excluded.%s%s", db.Quote(c), db.Quote(c), separatorVar))
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
	colPlaceHolders := colPlaceHoldersStr.String()
	for i := 0; i < count; i++ {
		if i == count-1 {
			separatorVar = ""
		}
		valuesStr.WriteString(fmt.Sprintf("(%s)%s", colPlaceHolders, separatorVar))
	}

	s := fmt.Sprintf(`INSERT INTO %s (%s) VALUES %s ON CONFLICT(%s) DO UPDATE SET %s`,
		tableName,
		columnsStr.String(),
		valuesStr.String(),
		onConflictStr.String(),
		setStr.String(),
	)
	return s, nil
}

func (db *SQLite3) Concat(strs ...string) string {
	return strings.Join(strs, " || ")
}
