package migrations

import (
	"strconv"

	"github.com/go-xorm/core"
)

type Postgres struct {
	BaseDialect
}

func NewPostgresDialect() *Postgres {
	d := Postgres{}
	d.BaseDialect.dialect = &d
	d.BaseDialect.driverName = POSTGRES
	return &d
}

func (db *Postgres) Quote(name string) string {
	return "\"" + name + "\""
}

func (db *Postgres) QuoteStr() string {
	return "\""
}

func (db *Postgres) AutoIncrStr() string {
	return ""
}

func (db *Postgres) SqlType(c *Column) string {
	var res string
	switch t := c.Type; t {
	case DB_TinyInt:
		res = DB_SmallInt
		return res
	case DB_MediumInt, core.Int, core.Integer:
		if c.IsAutoIncrement {
			return DB_Serial
		}
		return DB_Integer
	case DB_Serial, core.BigSerial:
		c.IsAutoIncrement = true
		c.Nullable = false
		res = t
	case DB_Binary, core.VarBinary:
		return DB_Bytea
	case DB_DateTime:
		res = DB_TimeStamp
	case DB_TimeStampz:
		return "timestamp with time zone"
	case DB_Float:
		res = DB_Real
	case DB_TinyText, core.MediumText, core.LongText:
		res = DB_Text
	case DB_NVarchar:
		res = DB_Varchar
	case DB_Uuid:
		res = DB_Uuid
	case DB_Blob, core.TinyBlob, core.MediumBlob, core.LongBlob:
		return DB_Bytea
	case DB_Double:
		return "DOUBLE PRECISION"
	default:
		if c.IsAutoIncrement {
			return DB_Serial
		}
		res = t
	}

	var hasLen1 bool = (c.Length > 0)
	var hasLen2 bool = (c.Length2 > 0)
	if hasLen2 {
		res += "(" + strconv.Itoa(c.Length) + "," + strconv.Itoa(c.Length2) + ")"
	} else if hasLen1 {
		res += "(" + strconv.Itoa(c.Length) + ")"
	}
	return res
}

func (db *Postgres) TableCheckSql(tableName string) (string, []interface{}) {
	args := []interface{}{"grafana", tableName}
	sql := "SELECT `TABLE_NAME` from `INFORMATION_SCHEMA`.`TABLES` WHERE `TABLE_SCHEMA`=? and `TABLE_NAME`=?"
	return sql, args
}
