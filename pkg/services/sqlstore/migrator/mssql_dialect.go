package migrator

import (
	"fmt"
	"strconv"
	"strings"

	"github.com/go-xorm/xorm"
)

type Mssql struct {
	BaseDialect
}

func NewMssqlDialect(engine *xorm.Engine) *Mssql {
	d := Mssql{}
	d.BaseDialect.dialect = &d
	d.BaseDialect.engine = engine
	d.BaseDialect.driverName = MSSQL
	return &d
}

func (db *Mssql) SqlType(c *Column) string {
	var res string
	switch c.Type {
	case DB_Bool:
		res = DB_Bit
		if strings.EqualFold(c.Default, "true") {
			c.Default = "1"
		} else {
			c.Default = "0"
		}
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
	case DB_Bytea, DB_Blob, DB_Binary, DB_TinyBlob, DB_MediumBlob, DB_LongBlob:
		res = DB_VarBinary
		if c.Length == 0 {
			c.Length = 50
		}
	case DB_TimeStamp:
		res = DB_DateTime
	case DB_TimeStampz:
		res = "DATETIMEOFFSET"
		c.Length = 7
	case DB_MediumInt, DB_Integer, DB_Int:
		res = DB_Int
		c.Length = 0
	case DB_Text, DB_MediumText, DB_TinyText, DB_LongText:
		res = DB_Varchar + "(MAX)"
	case DB_Double:
		res = DB_Real
	case DB_Uuid:
		res = DB_Varchar
		c.Length = 40
	case DB_TinyInt:
		res = DB_TinyInt
		c.Length = 0
	default:
		res = c.Type
	}

	if res == DB_Int {
		return DB_Int
	}

	hasLen1 := (c.Length > 0)
	hasLen2 := (c.Length2 > 0)

	if hasLen2 {
		res += "(" + strconv.Itoa(c.Length) + "," + strconv.Itoa(c.Length2) + ")"
	} else if hasLen1 {
		res += "(" + strconv.Itoa(c.Length) + ")"
	}
	return res
}

func (db *Mssql) Quote(name string) string {
	return "\"" + name + "\""
}

func (db *Mssql) QuoteStr() string {
	return "\""
}

func (db *Mssql) SupportEngine() bool {
	return false
}

func (db *Mssql) AutoIncrStr() string {
	return "IDENTITY"
}

func (db *Mssql) BooleanStr(value bool) string {
	if value {
		return "1"
	}
	return "0"
}

func (db *Mssql) TableCheckSql(tableName string) (string, []interface{}) {
	args := []interface{}{}
	sql := "select * from sysobjects where id = object_id(N'" + tableName + "') and OBJECTPROPERTY(id, N'IsUserTable') = 1"
	return sql, args
}

func (db *Mssql) CreateTableSql(table *Table) string {
	var sql string

	sql = "IF NOT EXISTS (SELECT [name] FROM sys.tables WHERE [name] = '" + table.Name + "' ) CREATE TABLE "

	sql += db.QuoteStr() + table.Name + db.QuoteStr() + " ("

	pkList := table.PrimaryKeys

	for _, col := range table.Columns {
		if col.IsPrimaryKey && len(pkList) == 1 {
			sql += col.String(db)
		} else {
			sql += col.StringNoPk(db)
		}
		sql = strings.TrimSpace(sql)
		sql += ", "
	}

	if len(pkList) > 1 {
		sql += "PRIMARY KEY ( "
		sql += strings.Join(pkList, ",")
		sql += " ), "
	}

	sql = sql[:len(sql)-2] + ")"
	sql += ";"
	return sql
}

func (db *Mssql) RenameTable(oldName string, newName string) string {
	q := db.dialect.Quote
	return fmt.Sprintf("exec sp_rename %s, %s", q(oldName), q(newName))
}

func (db *Mssql) CopyTableData(sourceTable string, targetTable string, sourceCols []string, targetCols []string) string {
	sourceColsSql := db.QuoteColList(sourceCols)
	targetColsSql := db.QuoteColList(targetCols)

	quote := db.dialect.Quote
	return fmt.Sprintf("SET IDENTITY_INSERT %s ON ; INSERT INTO %s (%s) SELECT %s FROM %s ; SET IDENTITY_INSERT %s OFF",
		quote(targetTable), quote(targetTable), targetColsSql, sourceColsSql, quote(sourceTable), quote(targetTable))
}

func (db *Mssql) AddColumnSql(tableName string, col *Column) string {
	return fmt.Sprintf("ALTER TABLE %s ADD %s", db.dialect.Quote(tableName), col.StringNoPk(db.dialect))
}

func (db *Mssql) CreateIndexSql(tableName string, index *Index) string {
	idx := db.BaseDialect.CreateIndexSql(tableName, index)
	// mssql includes nulls in the index checks. Others do not.
	if len(index.NullableCols) == 0 {
		return idx
	}
	idx = strings.TrimSuffix(idx, ";")
	wheres := []string{}
	for _, nc := range index.NullableCols {
		wheres = append(wheres, fmt.Sprintf("%s IS NOT NULL", db.Quote(nc)))
	}
	idx += " WHERE " + strings.Join(wheres, " AND ") + ";"
	return idx
}

func (db *Mssql) PreInsertId(table string, sess *xorm.Session) error {
	_, err := sess.Exec(fmt.Sprintf("SET IDENTITY_INSERT %s ON", db.Quote(table)))
	return err
}

func (db *Mssql) PostInsertId(table string, sess *xorm.Session) error {
	_, err := sess.Exec(fmt.Sprintf("SET IDENTITY_INSERT %s OFF", db.Quote(table)))
	return err
}

func (db *Mssql) Limit(limit int64) string {
	return db.LimitOffset(limit, 0)
}

func (db *Mssql) LimitOffset(limit int64, offset int64) string {
	// really rather hacky, but works in sql server 2012+.
	// alternatively, a bunch of queries would need to be reworked to support TOP N
	return fmt.Sprintf(" OFFSET %d ROWS FETCH NEXT %d ROWS ONLY", offset, limit)
}
