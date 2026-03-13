package migrator

import (
	"context"
	"database/sql"
	"fmt"
	"strings"
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

func (db *SQLite3) BooleanStr(value bool) string {
	if value {
		return "1"
	}
	return "0"
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

func (db *SQLite3) TableCheckSQL(tableName string) (string, []any) {
	return "SELECT 1 FROM " + db.Quote("sqlite_master") + " WHERE " + db.Quote("type") + "='table' AND " + db.Quote("name") + "=?", []any{tableName}
}

func (db *SQLite3) IndexCheckSQL(tableName, indexName string) (string, []any) {
	return "SELECT 1 FROM " + db.Quote("sqlite_master") + " WHERE " + db.Quote("type") + "='index' AND " + db.Quote("tbl_name") + "=? AND " + db.Quote("name") + "=?", []any{tableName, indexName}
}

func (db *SQLite3) ColumnCheckSQL(tableName, columnName string) (string, []any) {
	safeTable := strings.ReplaceAll(tableName, "'", "''")
	return "SELECT 1 FROM pragma_table_info('" + safeTable + "') WHERE name = ?", []any{columnName}
}

func (db *SQLite3) DropIndexSQL(tableName string, index *Index) string {
	return fmt.Sprintf("DROP INDEX %v", db.Quote(index.XName(tableName)))
}

func (db *SQLite3) GetDBName(_ context.Context, _ *sql.DB) (string, error) {
	return SQLite, nil
}

func (db *SQLite3) Lock(_ context.Context, _ *sql.Conn, _ string, _ int) error {
	return nil
}

func (db *SQLite3) Unlock(_ context.Context, _ *sql.Conn, _ string) error {
	return nil
}
