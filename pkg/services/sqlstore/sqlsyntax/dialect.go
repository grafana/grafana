package sqlsyntax

type Dialect interface {
	DBType() string
	TableCheckSql(tableName string) (string, []interface{})
}

type Sqlite3 struct {
}

type Mysql struct {
}

func (db *Sqlite3) DBType() string {
	return "sqlite3"
}

func (db *Mysql) DBType() string {
	return "mysql"
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
