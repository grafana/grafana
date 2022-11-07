package migrator

import (
	"database/sql"
	"errors"
	"fmt"
	"strconv"
	"strings"

	"github.com/VividCortex/mysqlerr"
	"github.com/go-sql-driver/mysql"
	"github.com/golang-migrate/migrate/v4/database"
	"xorm.io/xorm"
)

type MySQLDialect struct {
	BaseDialect
}

func NewMysqlDialect(engine *xorm.Engine) Dialect {
	d := MySQLDialect{}
	d.BaseDialect.dialect = &d
	d.BaseDialect.engine = engine
	d.BaseDialect.driverName = MySQL
	return &d
}

func (db *MySQLDialect) SupportEngine() bool {
	return true
}

func (db *MySQLDialect) Quote(name string) string {
	return "`" + name + "`"
}

func (db *MySQLDialect) AutoIncrStr() string {
	return "AUTO_INCREMENT"
}

func (db *MySQLDialect) BooleanStr(value bool) string {
	if value {
		return "1"
	}
	return "0"
}

func (db *MySQLDialect) BatchSize() int {
	return 1000
}

func (db *MySQLDialect) SQLType(c *Column) string {
	var res string
	switch c.Type {
	case DB_Bool:
		res = DB_TinyInt
		c.Length = 1
	case DB_Serial:
		c.IsAutoIncrement = true
		c.IsPrimaryKey = true
		c.Nullable = false
		res = DB_Int
	case DB_BigSerial:
		c.IsAutoIncrement = true
		c.IsPrimaryKey = true
		c.Nullable = false
		res = DB_BigInt
	case DB_Bytea:
		res = DB_Blob
	case DB_TimeStampz:
		res = DB_Char
		c.Length = 64
	case DB_NVarchar:
		res = DB_Varchar
	default:
		res = c.Type
	}

	var hasLen1 = (c.Length > 0)
	var hasLen2 = (c.Length2 > 0)

	if res == DB_BigInt && !hasLen1 && !hasLen2 {
		c.Length = 20
		hasLen1 = true
	}

	if hasLen2 {
		res += "(" + strconv.Itoa(c.Length) + "," + strconv.Itoa(c.Length2) + ")"
	} else if hasLen1 {
		res += "(" + strconv.Itoa(c.Length) + ")"
	}

	switch c.Type {
	case DB_Char, DB_Varchar, DB_NVarchar, DB_TinyText, DB_Text, DB_MediumText, DB_LongText:
		if c.IsLatin {
			res += " CHARACTER SET latin1 COLLATE latin1_bin"
		} else {
			res += " CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci"
		}
	}

	return res
}

func (db *MySQLDialect) UpdateTableSQL(tableName string, columns []*Column) string {
	var statements = []string{}

	statements = append(statements, "DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci")

	for _, col := range columns {
		statements = append(statements, "MODIFY "+col.StringNoPk(db))
	}

	return "ALTER TABLE " + db.Quote(tableName) + " " + strings.Join(statements, ", ") + ";"
}

func (db *MySQLDialect) IndexCheckSQL(tableName, indexName string) (string, []interface{}) {
	args := []interface{}{tableName, indexName}
	sql := "SELECT 1 FROM " + db.Quote("INFORMATION_SCHEMA") + "." + db.Quote("STATISTICS") + " WHERE " + db.Quote("TABLE_SCHEMA") + " = DATABASE() AND " + db.Quote("TABLE_NAME") + "=? AND " + db.Quote("INDEX_NAME") + "=?"
	return sql, args
}

func (db *MySQLDialect) ColumnCheckSQL(tableName, columnName string) (string, []interface{}) {
	args := []interface{}{tableName, columnName}
	sql := "SELECT 1 FROM " + db.Quote("INFORMATION_SCHEMA") + "." + db.Quote("COLUMNS") + " WHERE " + db.Quote("TABLE_SCHEMA") + " = DATABASE() AND " + db.Quote("TABLE_NAME") + "=? AND " + db.Quote("COLUMN_NAME") + "=?"
	return sql, args
}

func (db *MySQLDialect) RenameColumn(table Table, column *Column, newName string) string {
	quote := db.dialect.Quote
	return fmt.Sprintf(
		"ALTER TABLE %s CHANGE %s %s %s",
		quote(table.Name), quote(column.Name), quote(newName), db.SQLType(column),
	)
}

func (db *MySQLDialect) CleanDB() error {
	tables, err := db.engine.DBMetas()
	if err != nil {
		return err
	}
	sess := db.engine.NewSession()
	defer sess.Close()

	for _, table := range tables {
		switch table.Name {
		default:
			if _, err := sess.Exec("set foreign_key_checks = 0"); err != nil {
				return fmt.Errorf("%v: %w", "failed to disable foreign key checks", err)
			}
			if _, err := sess.Exec("drop table " + table.Name + " ;"); err != nil {
				return fmt.Errorf("failed to delete table %q: %w", table.Name, err)
			}
			if _, err := sess.Exec("set foreign_key_checks = 1"); err != nil {
				return fmt.Errorf("%v: %w", "failed to disable foreign key checks", err)
			}
		}
	}

	return nil
}

// TruncateDBTables truncates all the tables.
// A special case is the dashboard_acl table where we keep the default permissions.
func (db *MySQLDialect) TruncateDBTables() error {
	tables, err := db.engine.DBMetas()
	if err != nil {
		return err
	}
	sess := db.engine.NewSession()
	defer sess.Close()

	for _, table := range tables {
		switch table.Name {
		case "migration_log":
			continue
		case "dashboard_acl":
			// keep default dashboard permissions
			if _, err := sess.Exec(fmt.Sprintf("DELETE FROM %v WHERE dashboard_id != -1 AND org_id != -1;", db.Quote(table.Name))); err != nil {
				return fmt.Errorf("failed to truncate table %q: %w", table.Name, err)
			}
			if _, err := sess.Exec(fmt.Sprintf("ALTER TABLE %v AUTO_INCREMENT = 3;", db.Quote(table.Name))); err != nil {
				return fmt.Errorf("failed to reset table %q: %w", table.Name, err)
			}
		default:
			if _, err := sess.Exec(fmt.Sprintf("TRUNCATE TABLE %v;", db.Quote(table.Name))); err != nil {
				return fmt.Errorf("failed to truncate table %q: %w", table.Name, err)
			}
		}
	}

	return nil
}

func (db *MySQLDialect) isThisError(err error, errcode uint16) bool {
	var driverErr *mysql.MySQLError
	if errors.As(err, &driverErr) {
		if driverErr.Number == errcode {
			return true
		}
	}

	return false
}

func (db *MySQLDialect) IsUniqueConstraintViolation(err error) bool {
	return db.isThisError(err, mysqlerr.ER_DUP_ENTRY)
}

func (db *MySQLDialect) ErrorMessage(err error) string {
	var driverErr *mysql.MySQLError
	if errors.As(err, &driverErr) {
		return driverErr.Message
	}
	return ""
}

func (db *MySQLDialect) IsDeadlock(err error) bool {
	return db.isThisError(err, mysqlerr.ER_LOCK_DEADLOCK)
}

// UpsertSQL returns the upsert sql statement for MySQL dialect
func (db *MySQLDialect) UpsertSQL(tableName string, keyCols, updateCols []string) string {
	q, _ := db.UpsertMultipleSQL(tableName, keyCols, updateCols, 1)
	return q
}

func (db *MySQLDialect) UpsertMultipleSQL(tableName string, keyCols, updateCols []string, count int) (string, error) {
	if count < 1 {
		return "", fmt.Errorf("upsert statement must have count >= 1. Got %v", count)
	}
	columnsStr := strings.Builder{}
	colPlaceHoldersStr := strings.Builder{}
	setStr := strings.Builder{}

	separator := ", "
	for i, c := range updateCols {
		if i == len(updateCols)-1 {
			separator = ""
		}
		columnsStr.WriteString(fmt.Sprintf("%s%s", db.Quote(c), separator))
		colPlaceHoldersStr.WriteString(fmt.Sprintf("?%s", separator))
		setStr.WriteString(fmt.Sprintf("%s=VALUES(%s)%s", db.Quote(c), db.Quote(c), separator))
	}

	valuesStr := strings.Builder{}
	separator = ", "
	colPlaceHolders := colPlaceHoldersStr.String()
	for i := 0; i < count; i++ {
		if i == count-1 {
			separator = ""
		}
		valuesStr.WriteString(fmt.Sprintf("(%s)%s", colPlaceHolders, separator))
	}

	s := fmt.Sprintf(`INSERT INTO %s (%s) VALUES %s ON DUPLICATE KEY UPDATE %s`,
		tableName,
		columnsStr.String(),
		valuesStr.String(),
		setStr.String(),
	)
	return s, nil
}

func (db *MySQLDialect) Lock(cfg LockCfg) error {
	query := "SELECT GET_LOCK(?, ?)"
	var success sql.NullBool

	lockName, err := db.getLockName()
	if err != nil {
		return fmt.Errorf("failed to generate lock name: %w", err)
	}

	// trying to obtain the lock with the specific name
	// the lock is exclusive per session and is released explicitly by executing RELEASE_LOCK() or implicitly when the session terminates
	// it returns 1 if the lock was obtained successfully,
	// 0 if the attempt timed out (for example, because another client has previously locked the name),
	// or NULL if an error occurred
	// starting from MySQL 5.7 it is even possible for a given session to acquire multiple locks for the same name
	// however other sessions cannot acquire a lock with that name until the acquiring session releases all its locks for the name.
	_, err = cfg.Session.SQL(query, lockName, cfg.Timeout).Get(&success)
	if err != nil {
		return err
	}
	if !success.Valid || !success.Bool {
		return ErrLockDB
	}
	return nil
}

func (db *MySQLDialect) Unlock(cfg LockCfg) error {
	query := "SELECT RELEASE_LOCK(?)"
	var success sql.NullBool

	lockName, err := db.getLockName()
	if err != nil {
		return fmt.Errorf("failed to generate lock name: %w", err)
	}

	// trying to release the lock with the specific name
	// it returns 1 if the lock was released,
	// 0 if the lock was not established by this thread (in which case the lock is not released),
	// and NULL if the named lock did not exist (it was never obtained by a call to GET_LOCK() or if it has previously been released)
	_, err = cfg.Session.SQL(query, lockName).Get(&success)
	if err != nil {
		return err
	}
	if !success.Valid || !success.Bool {
		return ErrReleaseLockDB
	}
	return nil
}

func (db *MySQLDialect) getLockName() (string, error) {
	cfg, err := mysql.ParseDSN(db.engine.DataSourceName())
	if err != nil {
		return "", err
	}

	s, err := database.GenerateAdvisoryLockId(cfg.DBName)
	if err != nil {
		return "", fmt.Errorf("failed to generate advisory lock key: %w", err)
	}

	return s, nil
}
