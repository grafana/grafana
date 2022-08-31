package migrator

import (
	"errors"
	"fmt"
	"regexp"
	"strconv"
	"strings"

	"github.com/golang-migrate/migrate/v4/database"
	"github.com/lib/pq"

	"xorm.io/xorm"
)

type PostgresDialect struct {
	BaseDialect
}

func NewPostgresDialect(engine *xorm.Engine) Dialect {
	d := PostgresDialect{}
	d.BaseDialect.dialect = &d
	d.BaseDialect.engine = engine
	d.BaseDialect.driverName = Postgres
	return &d
}

func (db *PostgresDialect) SupportEngine() bool {
	return false
}

func (db *PostgresDialect) Quote(name string) string {
	return "\"" + name + "\""
}

func (db *PostgresDialect) LikeStr() string {
	return "ILIKE"
}

func (db *PostgresDialect) AutoIncrStr() string {
	return ""
}

func (db *PostgresDialect) BooleanStr(value bool) string {
	return strconv.FormatBool(value)
}

func (db *PostgresDialect) Default(col *Column) string {
	if col.Type == DB_Bool {
		if col.Default == "0" {
			return "FALSE"
		}
		return "TRUE"
	}
	return col.Default
}

func (db *PostgresDialect) SQLType(c *Column) string {
	var res string
	switch t := c.Type; t {
	case DB_TinyInt:
		res = DB_SmallInt
		return res
	case DB_MediumInt, DB_Int, DB_Integer:
		if c.IsAutoIncrement {
			return DB_Serial
		}
		return DB_Integer
	case DB_Serial, DB_BigSerial:
		c.IsAutoIncrement = true
		c.Nullable = false
		res = t
	case DB_Binary, DB_VarBinary:
		return DB_Bytea
	case DB_DateTime:
		res = DB_TimeStamp
	case DB_TimeStampz:
		return "timestamp with time zone"
	case DB_Float:
		res = DB_Real
	case DB_TinyText, DB_MediumText, DB_LongText:
		res = DB_Text
	case DB_NVarchar:
		res = DB_Varchar
	case DB_Uuid:
		res = DB_Uuid
	case DB_Blob, DB_TinyBlob, DB_MediumBlob, DB_LongBlob:
		return DB_Bytea
	case DB_Double:
		return "DOUBLE PRECISION"
	default:
		if c.IsAutoIncrement {
			return DB_Serial
		}
		res = t
	}

	var hasLen1 = (c.Length > 0)
	var hasLen2 = (c.Length2 > 0)
	if hasLen2 {
		res += "(" + strconv.Itoa(c.Length) + "," + strconv.Itoa(c.Length2) + ")"
	} else if hasLen1 {
		res += "(" + strconv.Itoa(c.Length) + ")"
	}
	return res
}

func (db *PostgresDialect) IndexCheckSQL(tableName, indexName string) (string, []interface{}) {
	args := []interface{}{tableName, indexName}
	sql := "SELECT 1 FROM " + db.Quote("pg_indexes") + " WHERE" + db.Quote("tablename") + "=? AND " + db.Quote("indexname") + "=?"
	return sql, args
}

func (db *PostgresDialect) DropIndexSQL(tableName string, index *Index) string {
	quote := db.Quote
	idxName := index.XName(tableName)
	return fmt.Sprintf("DROP INDEX %v CASCADE", quote(idxName))
}

func (db *PostgresDialect) UpdateTableSQL(tableName string, columns []*Column) string {
	var statements = []string{}

	for _, col := range columns {
		statements = append(statements, "ALTER "+db.Quote(col.Name)+" TYPE "+db.SQLType(col))
	}

	return "ALTER TABLE " + db.Quote(tableName) + " " + strings.Join(statements, ", ") + ";"
}

func (db *PostgresDialect) CleanDB() error {
	sess := db.engine.NewSession()
	defer sess.Close()

	if _, err := sess.Exec("DROP SCHEMA public CASCADE;"); err != nil {
		return fmt.Errorf("%v: %w", "failed to drop schema public", err)
	}

	if _, err := sess.Exec("CREATE SCHEMA public;"); err != nil {
		return fmt.Errorf("%v: %w", "failed to create schema public", err)
	}

	return nil
}

// TruncateDBTables truncates all the tables.
// A special case is the dashboard_acl table where we keep the default permissions.
func (db *PostgresDialect) TruncateDBTables() error {
	tables, err := db.engine.DBMetas()
	if err != nil {
		return err
	}
	sess := db.engine.NewSession()
	defer sess.Close()

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
			if _, err := sess.Exec(fmt.Sprintf("ALTER SEQUENCE %v RESTART WITH 3;", db.Quote(fmt.Sprintf("%v_id_seq", table.Name)))); err != nil {
				return fmt.Errorf("failed to reset table %q: %w", table.Name, err)
			}
		default:
			if _, err := sess.Exec(fmt.Sprintf("TRUNCATE TABLE %v RESTART IDENTITY CASCADE;", db.Quote(table.Name))); err != nil {
				if db.isUndefinedTable(err) {
					continue
				}
				return fmt.Errorf("failed to truncate table %q: %w", table.Name, err)
			}
		}
	}

	return nil
}

func (db *PostgresDialect) isThisError(err error, errcode string) bool {
	var driverErr *pq.Error
	if errors.As(err, &driverErr) {
		if string(driverErr.Code) == errcode {
			return true
		}
	}

	return false
}

func (db *PostgresDialect) ErrorMessage(err error) string {
	var driverErr *pq.Error
	if errors.As(err, &driverErr) {
		return driverErr.Message
	}
	return ""
}

func (db *PostgresDialect) isUndefinedTable(err error) bool {
	return db.isThisError(err, "42P01")
}

func (db *PostgresDialect) IsUniqueConstraintViolation(err error) bool {
	return db.isThisError(err, "23505")
}

func (db *PostgresDialect) IsDeadlock(err error) bool {
	return db.isThisError(err, "40P01")
}

func (db *PostgresDialect) PostInsertId(table string, sess *xorm.Session) error {
	if table != "org" {
		return nil
	}

	// sync primary key sequence of org table
	if _, err := sess.Exec("SELECT setval('org_id_seq', (SELECT max(id) FROM org));"); err != nil {
		return fmt.Errorf("failed to sync primary key for org table: %w", err)
	}
	return nil
}

// UpsertSQL returns the upsert sql statement for PostgreSQL dialect
func (db *PostgresDialect) UpsertSQL(tableName string, keyCols, updateCols []string) string {
	str, _ := db.UpsertMultipleSQL(tableName, keyCols, updateCols, 1)
	return str
}

// UpsertMultipleSQL returns the upsert sql statement for PostgreSQL dialect
func (db *PostgresDialect) UpsertMultipleSQL(tableName string, keyCols, updateCols []string, count int) (string, error) {
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

func (db *PostgresDialect) Lock(cfg LockCfg) error {
	// trying to obtain the lock for a resource identified by a 64-bit or 32-bit key value
	// the lock is exclusive: multiple lock requests stack, so that if the same resource is locked three times
	// it must then be unlocked three times to be released for other sessions' use.
	// it will either obtain the lock immediately and return true,
	// or return false if the lock cannot be acquired immediately.
	query := "SELECT pg_try_advisory_lock(?)"
	var success bool

	key, err := db.getLockKey()
	if err != nil {
		return fmt.Errorf("failed to generate advisory lock key: %w", err)
	}
	_, err = cfg.Session.SQL(query, key).Get(&success)
	if err != nil {
		return err
	}
	if !success {
		return ErrLockDB
	}

	return nil
}

// OrderBy normalizes ordering so that nulls end up last in sorting, which they do by default in both sqlite and mysql but not postgres
// order should be a string like `dashboard.id ASC`
func (db *PostgresDialect) OrderBy(order string) string {
	nullSort := "FIRST"
	normalizedOrder := strings.ToUpper(strings.TrimSpace(order))

	if strings.HasSuffix(normalizedOrder, " DESC") {
		nullSort = "LAST"
	}

	return fmt.Sprintf("%s NULLS %s", order, nullSort)
}

func (db *PostgresDialect) Unlock(cfg LockCfg) error {
	// trying to release a previously-acquired exclusive session level advisory lock.
	// it will either return true if the lock is successfully released or
	// false if the lock was not held (in addition an SQL warning will be reported by the server)
	query := "SELECT pg_advisory_unlock(?)"
	var success bool

	key, err := db.getLockKey()
	if err != nil {
		return fmt.Errorf("failed to generate advisory lock key: %w", err)
	}
	_, err = cfg.Session.SQL(query, key).Get(&success)
	if err != nil {
		return err
	}
	if !success {
		return ErrReleaseLockDB
	}
	return nil
}

func getDBName(dsn string) (string, error) {
	if strings.HasPrefix(dsn, "postgres://") || strings.HasPrefix(dsn, "postgresql://") {
		parsedDSN, err := pq.ParseURL(dsn)
		if err != nil {
			return "", err
		}
		dsn = parsedDSN
	}
	re := regexp.MustCompile(`dbname=(\w+)`)
	submatch := re.FindSubmatch([]byte(dsn))
	if len(submatch) < 2 {
		return "", fmt.Errorf("failed to get database name")
	}
	return string(submatch[1]), nil
}

func (db *PostgresDialect) getLockKey() (string, error) {
	dbName, err := getDBName(db.engine.DataSourceName())
	if err != nil {
		return "", err
	}
	key, err := database.GenerateAdvisoryLockId(dbName)
	if err != nil {
		return "", err
	}
	return key, nil
}
