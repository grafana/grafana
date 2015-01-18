package migrations

import "fmt"

type Dialect interface {
	DriverName() string
	ToDBTypeSql(columnType ColumnType, length int) string
	TableCheckSql(tableName string) (string, []interface{})
}

type Sqlite3 struct {
}

type Mysql struct {
}

func (db *Sqlite3) DriverName() string {
	return SQLITE
}

func (db *Mysql) DriverName() string {
	return MYSQL
}

func (db *Sqlite3) ToDBTypeSql(columnType ColumnType, length int) string {
	switch columnType {
	case DB_TYPE_STRING:
		return "TEXT"
	}

	panic("Unsupported db type")
}

func (db *Mysql) ToDBTypeSql(columnType ColumnType, length int) string {
	switch columnType {
	case DB_TYPE_STRING:
		return fmt.Sprintf("NVARCHAR(%d)", length)
	}

	panic("Unsupported db type")
}

func (db *Sqlite3) TableCheckSql(tableName string) (string, []interface{}) {
	args := []interface{}{tableName}
	return "SELECT name FROM sqlite_master WHERE type='table' and name = ?", args
}

func (db *Mysql) TableCheckSql(tableName string) (string, []interface{}) {
	args := []interface{}{"grafana", tableName}
	sql := "SELECT `TABLE_NAME` from `INFORMATION_SCHEMA`.`TABLES` WHERE `TABLE_SCHEMA`=? and `TABLE_NAME`=?"
	return sql, args
}
