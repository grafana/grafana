package migrator

import (
	"fmt"

	"github.com/go-xorm/xorm"
	"github.com/mattn/go-sqlite3"
)

type Sqlite3 struct {
	BaseDialect
}

func NewSqlite3Dialect(engine *xorm.Engine) *Sqlite3 {
	d := Sqlite3{}
	d.BaseDialect.dialect = &d
	d.BaseDialect.engine = engine
	d.BaseDialect.driverName = SQLITE
	return &d
}

func (db *Sqlite3) SupportEngine() bool {
	return false
}

func (db *Sqlite3) Quote(name string) string {
	return "`" + name + "`"
}

func (db *Sqlite3) AutoIncrStr() string {
	return "AUTOINCREMENT"
}

func (db *Sqlite3) BooleanStr(value bool) string {
	if value {
		return "1"
	}
	return "0"
}

func (db *Sqlite3) DateTimeFunc(value string) string {
	return "datetime(" + value + ")"
}

func (db *Sqlite3) SqlType(c *Column) string {
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

func (db *Sqlite3) IndexCheckSql(tableName, indexName string) (string, []interface{}) {
	args := []interface{}{tableName, indexName}
	sql := "SELECT 1 FROM " + db.Quote("sqlite_master") + " WHERE " + db.Quote("type") + "='index' AND " + db.Quote("tbl_name") + "=? AND " + db.Quote("name") + "=?"
	return sql, args
}

func (db *Sqlite3) DropIndexSql(tableName string, index *Index) string {
	quote := db.Quote
	//var unique string
	idxName := index.XName(tableName)
	return fmt.Sprintf("DROP INDEX %v", quote(idxName))
}

func (db *Sqlite3) CleanDB() error {
	return nil
}

func (db *Sqlite3) isThisError(err error, errcode int) bool {
	if driverErr, ok := err.(sqlite3.Error); ok {
		if int(driverErr.ExtendedCode) == errcode {
			return true
		}
	}

	return false
}

func (db *Sqlite3) IsUniqueConstraintViolation(err error) bool {
	return db.isThisError(err, int(sqlite3.ErrConstraintUnique))
}

func (db *Sqlite3) IsDeadlock(err error) bool {
	return false // No deadlock
}
