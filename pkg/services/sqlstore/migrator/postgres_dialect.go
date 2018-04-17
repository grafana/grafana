package migrator

import (
	"fmt"
	"strconv"
	"strings"

	"github.com/go-xorm/xorm"
)

type Postgres struct {
	BaseDialect
}

func NewPostgresDialect(engine *xorm.Engine) *Postgres {
	d := Postgres{}
	d.BaseDialect.dialect = &d
	d.BaseDialect.engine = engine
	d.BaseDialect.driverName = POSTGRES
	return &d
}

func (db *Postgres) SupportEngine() bool {
	return false
}

func (db *Postgres) Quote(name string) string {
	return "\"" + name + "\""
}

func (b *Postgres) LikeStr() string {
	return "ILIKE"
}

func (db *Postgres) AutoIncrStr() string {
	return ""
}

func (db *Postgres) BooleanStr(value bool) string {
	return strconv.FormatBool(value)
}

func (b *Postgres) Default(col *Column) string {
	if col.Type == DB_Bool {
		if col.Default == "0" {
			return "FALSE"
		}
		return "TRUE"
	}
	return col.Default
}

func (db *Postgres) SqlType(c *Column) string {
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

func (db *Postgres) TableCheckSql(tableName string) (string, []interface{}) {
	args := []interface{}{"grafana", tableName}
	sql := "SELECT table_name FROM information_schema.tables WHERE table_schema=? and table_name=?"
	return sql, args
}

func (db *Postgres) DropIndexSql(tableName string, index *Index) string {
	quote := db.Quote
	idxName := index.XName(tableName)
	return fmt.Sprintf("DROP INDEX %v", quote(idxName))
}

func (db *Postgres) UpdateTableSql(tableName string, columns []*Column) string {
	var statements = []string{}

	for _, col := range columns {
		statements = append(statements, "ALTER "+db.Quote(col.Name)+" TYPE "+db.SqlType(col))
	}

	return "ALTER TABLE " + db.Quote(tableName) + " " + strings.Join(statements, ", ") + ";"
}

func (db *Postgres) CleanDB() error {
	sess := db.engine.NewSession()
	defer sess.Close()

	if _, err := sess.Exec("DROP SCHEMA public CASCADE;"); err != nil {
		return fmt.Errorf("Failed to drop schema public")
	}

	if _, err := sess.Exec("CREATE SCHEMA public;"); err != nil {
		return fmt.Errorf("Failed to create schema public")
	}

	return nil
}
