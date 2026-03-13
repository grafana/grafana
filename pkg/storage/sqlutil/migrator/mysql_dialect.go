package migrator

import (
	"context"
	"database/sql"
	"fmt"
	"strconv"
	"strings"

)

type MySQLDialect struct {
	BaseDialect
}

func NewMysqlDialect() Dialect {
	d := MySQLDialect{}
	d.dialect = &d
	d.driverName = MySQL
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
	case DB_Uuid:
		res = DB_Char
		c.Length = 36
	default:
		res = c.Type
	}

	hasLen1 := c.Length > 0
	hasLen2 := c.Length2 > 0

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
	statements := make([]string, 0, 1+len(columns))
	statements = append(statements, "DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci")
	for _, col := range columns {
		statements = append(statements, "MODIFY "+col.StringNoPk(db))
	}
	return "ALTER TABLE " + db.Quote(tableName) + " " + strings.Join(statements, ", ") + ";"
}

func (db *MySQLDialect) TableCheckSQL(tableName string) (string, []any) {
	return "SELECT 1 FROM " + db.Quote("INFORMATION_SCHEMA") + "." + db.Quote("TABLES") +
		" WHERE " + db.Quote("TABLE_SCHEMA") + " = DATABASE() AND " + db.Quote("TABLE_NAME") + "=?", []any{tableName}
}

func (db *MySQLDialect) IndexCheckSQL(tableName, indexName string) (string, []any) {
	args := []any{tableName, indexName}
	sql := "SELECT 1 FROM " + db.Quote("INFORMATION_SCHEMA") + "." + db.Quote("STATISTICS") +
		" WHERE " + db.Quote("TABLE_SCHEMA") + " = DATABASE() AND " + db.Quote("TABLE_NAME") + "=? AND " + db.Quote("INDEX_NAME") + "=?"
	return sql, args
}

func (db *MySQLDialect) ColumnCheckSQL(tableName, columnName string) (string, []any) {
	args := []any{tableName, columnName}
	sql := "SELECT 1 FROM " + db.Quote("INFORMATION_SCHEMA") + "." + db.Quote("COLUMNS") +
		" WHERE " + db.Quote("TABLE_SCHEMA") + " = DATABASE() AND " + db.Quote("TABLE_NAME") + "=? AND " + db.Quote("COLUMN_NAME") + "=?"
	return sql, args
}

func (db *MySQLDialect) RenameColumn(table Table, column *Column, newName string) string {
	quote := db.dialect.Quote
	return fmt.Sprintf("ALTER TABLE %s CHANGE %s %s %s", quote(table.Name), quote(column.Name), quote(newName), db.SQLType(column))
}

func (db *MySQLDialect) GetDBName(ctx context.Context, dbh *sql.DB) (string, error) {
	var dbName sql.NullString
	if err := dbh.QueryRowContext(ctx, "SELECT DATABASE()").Scan(&dbName); err != nil {
		return "", err
	}
	if !dbName.Valid {
		return "", fmt.Errorf("failed to get database name")
	}
	return dbName.String, nil
}

func (db *MySQLDialect) Lock(ctx context.Context, conn *sql.Conn, key string, timeout int) error {
	var success sql.NullBool
	if err := conn.QueryRowContext(ctx, "SELECT GET_LOCK(?, ?)", key, timeout).Scan(&success); err != nil {
		return err
	}
	if !success.Valid || !success.Bool {
		return ErrLockDB
	}
	return nil
}

func (db *MySQLDialect) Unlock(ctx context.Context, conn *sql.Conn, key string) error {
	var success sql.NullBool
	if err := conn.QueryRowContext(ctx, "SELECT RELEASE_LOCK(?)", key).Scan(&success); err != nil {
		return err
	}
	if !success.Valid || !success.Bool {
		return ErrReleaseLockDB
	}
	return nil
}
