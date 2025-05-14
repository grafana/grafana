package migrator

import (
	"fmt"
	"strings"

	"xorm.io/xorm"
)

const (
	Postgres = "postgres"
	SQLite   = "sqlite3"
	MySQL    = "mysql"
	MSSQL    = "mssql"
	Spanner  = "spanner"
)

type Migration interface {
	SQL(dialect Dialect) string
	Id() string
	SetId(string)
	GetCondition() MigrationCondition
	// SkipMigrationLog is used by dashboard alert migration to Grafana 8 Alerts
	// for skipping recording it in the migration_log so that it can run several times.
	// For all the other migrations it should be false.
	SkipMigrationLog() bool
}

type CodeMigration interface {
	Migration
	Exec(sess *xorm.Session, migrator *Migrator) error
}

type SQLType string

type ColumnType string

const (
	DB_TYPE_STRING ColumnType = "String"
)

type Table struct {
	Name        string
	Columns     []*Column
	PrimaryKeys []string
	Indices     []*Index
}

const (
	IndexType = iota + 1
	UniqueIndex
)

type Index struct {
	Name string
	Type int
	Cols []string
}

func (index *Index) XName(tableName string) string {
	if index.Name == "" {
		index.Name = strings.Join(index.Cols, "_")
	}

	if !strings.HasPrefix(index.Name, "UQE_") &&
		!strings.HasPrefix(index.Name, "IDX_") {
		if index.Type == UniqueIndex {
			return fmt.Sprintf("UQE_%v_%v", tableName, index.Name)
		}
		return fmt.Sprintf("IDX_%v_%v", tableName, index.Name)
	}
	return index.Name
}

var (
	DB_Bit       = "BIT"
	DB_TinyInt   = "TINYINT"
	DB_SmallInt  = "SMALLINT"
	DB_MediumInt = "MEDIUMINT"
	DB_Int       = "INT"
	DB_Integer   = "INTEGER"
	DB_BigInt    = "BIGINT"

	DB_Set = "SET"

	DB_Char       = "CHAR"
	DB_Varchar    = "VARCHAR"
	DB_NVarchar   = "NVARCHAR"
	DB_TinyText   = "TINYTEXT"
	DB_Text       = "TEXT"
	DB_MediumText = "MEDIUMTEXT"
	DB_LongText   = "LONGTEXT"
	DB_Uuid       = "UUID"

	DB_Date       = "DATE"
	DB_DateTime   = "DATETIME"
	DB_Time       = "TIME"
	DB_TimeStamp  = "TIMESTAMP"
	DB_TimeStampz = "TIMESTAMPZ"

	DB_Decimal = "DECIMAL"
	DB_Numeric = "NUMERIC"

	DB_Real   = "REAL"
	DB_Float  = "FLOAT"
	DB_Double = "DOUBLE"

	DB_Binary     = "BINARY"
	DB_VarBinary  = "VARBINARY"
	DB_TinyBlob   = "TINYBLOB"
	DB_Blob       = "BLOB"
	DB_MediumBlob = "MEDIUMBLOB"
	DB_LongBlob   = "LONGBLOB"
	DB_Bytea      = "BYTEA"

	DB_Bool = "BOOL"

	DB_Serial    = "SERIAL"
	DB_BigSerial = "BIGSERIAL"
)
