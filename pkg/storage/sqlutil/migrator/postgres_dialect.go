package migrator

import (
	"context"
	"database/sql"
	"fmt"
	"strconv"
	"strings"
)

type PostgresDialect struct {
	BaseDialect
}

func NewPostgresDialect() Dialect {
	d := PostgresDialect{}
	d.dialect = &d
	d.driverName = Postgres
	return &d
}

func (db *PostgresDialect) SupportEngine() bool {
	return false
}

func (db *PostgresDialect) Quote(name string) string {
	return "\"" + name + "\""
}

func (db *PostgresDialect) AutoIncrStr() string {
	return ""
}

func (db *PostgresDialect) BooleanStr(value bool) string {
	return strconv.FormatBool(value)
}

func (db *PostgresDialect) SQLType(c *Column) string {
	var res string
	switch t := c.Type; t {
	case DB_TinyInt:
		return DB_SmallInt
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
		return DB_Uuid
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

	hasLen1 := c.Length > 0
	hasLen2 := c.Length2 > 0
	if hasLen2 {
		res += "(" + strconv.Itoa(c.Length) + "," + strconv.Itoa(c.Length2) + ")"
	} else if hasLen1 {
		res += "(" + strconv.Itoa(c.Length) + ")"
	}
	return res
}

func (db *PostgresDialect) TableCheckSQL(tableName string) (string, []any) {
	return "SELECT 1 FROM information_schema.tables WHERE table_schema = current_schema() AND table_name = ?", []any{tableName}
}

func (db *PostgresDialect) IndexCheckSQL(tableName, indexName string) (string, []any) {
	return "SELECT 1 FROM pg_indexes WHERE tablename = ? AND indexname = ?", []any{tableName, indexName}
}

func (db *PostgresDialect) DropIndexSQL(tableName string, index *Index) string {
	return fmt.Sprintf("DROP INDEX %v CASCADE", db.Quote(index.XName(tableName)))
}

func (db *PostgresDialect) UpdateTableSQL(tableName string, columns []*Column) string {
	statements := make([]string, 0, len(columns))
	for _, col := range columns {
		statements = append(statements, "ALTER "+db.Quote(col.Name)+" TYPE "+db.SQLType(col))
	}
	return "ALTER TABLE " + db.Quote(tableName) + " " + strings.Join(statements, ", ") + ";"
}

func (db *PostgresDialect) ColumnCheckSQL(tableName, columnName string) (string, []any) {
	return "SELECT 1 FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = ? AND column_name = ?", []any{tableName, columnName}
}

func (db *PostgresDialect) GetDBName(ctx context.Context, dbh *sql.DB) (string, error) {
	var dbName string
	if err := dbh.QueryRowContext(ctx, "SELECT current_database()").Scan(&dbName); err != nil {
		return "", err
	}
	if dbName == "" {
		return "", fmt.Errorf("failed to get database name")
	}
	return dbName, nil
}

func (db *PostgresDialect) Lock(ctx context.Context, conn *sql.Conn, key string, _ int) error {
	lockID, err := strconv.ParseInt(key, 10, 64)
	if err != nil {
		return err
	}
	var success bool
	if err := conn.QueryRowContext(ctx, "SELECT pg_try_advisory_lock(?)", lockID).Scan(&success); err != nil {
		return err
	}
	if !success {
		return ErrLockDB
	}
	return nil
}

func (db *PostgresDialect) Unlock(ctx context.Context, conn *sql.Conn, key string) error {
	lockID, err := strconv.ParseInt(key, 10, 64)
	if err != nil {
		return err
	}
	var success bool
	if err := conn.QueryRowContext(ctx, "SELECT pg_advisory_unlock(?)", lockID).Scan(&success); err != nil {
		return err
	}
	if !success {
		return ErrReleaseLockDB
	}
	return nil
}
