package migrator

import (
	"strconv"
	"strings"

	"github.com/VividCortex/mysqlerr"
	"github.com/go-sql-driver/mysql"
	"github.com/grafana/grafana/pkg/util/errutil"
	"xorm.io/xorm"
)

type Mysql struct {
	BaseDialect
}

func NewMysqlDialect(engine *xorm.Engine) *Mysql {
	d := Mysql{}
	d.BaseDialect.dialect = &d
	d.BaseDialect.engine = engine
	d.BaseDialect.driverName = MYSQL
	return &d
}

func (db *Mysql) SupportEngine() bool {
	return true
}

func (db *Mysql) Quote(name string) string {
	return "`" + name + "`"
}

func (db *Mysql) AutoIncrStr() string {
	return "AUTO_INCREMENT"
}

func (db *Mysql) BooleanStr(value bool) string {
	if value {
		return "1"
	}
	return "0"
}

func (db *Mysql) SqlType(c *Column) string {
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
		res += " CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci"
	}

	return res
}

func (db *Mysql) UpdateTableSql(tableName string, columns []*Column) string {
	var statements = []string{}

	statements = append(statements, "DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci")

	for _, col := range columns {
		statements = append(statements, "MODIFY "+col.StringNoPk(db))
	}

	return "ALTER TABLE " + db.Quote(tableName) + " " + strings.Join(statements, ", ") + ";"
}

func (db *Mysql) IndexCheckSql(tableName, indexName string) (string, []interface{}) {
	args := []interface{}{tableName, indexName}
	sql := "SELECT 1 FROM " + db.Quote("INFORMATION_SCHEMA") + "." + db.Quote("STATISTICS") + " WHERE " + db.Quote("TABLE_SCHEMA") + " = DATABASE() AND " + db.Quote("TABLE_NAME") + "=? AND " + db.Quote("INDEX_NAME") + "=?"
	return sql, args
}

func (db *Mysql) ColumnCheckSql(tableName, columnName string) (string, []interface{}) {
	args := []interface{}{tableName, columnName}
	sql := "SELECT 1 FROM " + db.Quote("INFORMATION_SCHEMA") + "." + db.Quote("COLUMNS") + " WHERE " + db.Quote("TABLE_SCHEMA") + " = DATABASE() AND " + db.Quote("TABLE_NAME") + "=? AND " + db.Quote("COLUMN_NAME") + "=?"
	return sql, args
}

func (db *Mysql) CleanDB() error {
	tables, err := db.engine.DBMetas()
	if err != nil {
		return err
	}
	sess := db.engine.NewSession()
	defer sess.Close()

	for _, table := range tables {
		if _, err := sess.Exec("set foreign_key_checks = 0"); err != nil {
			return errutil.Wrap("failed to disable foreign key checks", err)
		}
		if _, err := sess.Exec("drop table " + table.Name + " ;"); err != nil {
			return errutil.Wrapf(err, "failed to delete table %q", table.Name)
		}
		if _, err := sess.Exec("set foreign_key_checks = 1"); err != nil {
			return errutil.Wrap("failed to disable foreign key checks", err)
		}
	}

	return nil
}

func (db *Mysql) isThisError(err error, errcode uint16) bool {
	if driverErr, ok := err.(*mysql.MySQLError); ok {
		if driverErr.Number == errcode {
			return true
		}
	}

	return false
}

func (db *Mysql) IsUniqueConstraintViolation(err error) bool {
	return db.isThisError(err, mysqlerr.ER_DUP_ENTRY)
}

func (db *Mysql) ErrorMessage(err error) string {
	if driverErr, ok := err.(*mysql.MySQLError); ok {
		return driverErr.Message
	}
	return ""
}

func (db *Mysql) IsDeadlock(err error) bool {
	return db.isThisError(err, mysqlerr.ER_LOCK_DEADLOCK)
}
