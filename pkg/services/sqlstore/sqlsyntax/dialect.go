package sqlsyntax

type Dialect interface {
	DBType() string
	TableCheckSql(tableName string) (string, []interface{})
}

type Sqlite3 struct {
}

func (db *Sqlite3) DBType() string {
	return "sqlite3"
}

func (db *Sqlite3) TableCheckSql(tableName string) (string, []interface{}) {
	args := []interface{}{tableName}
	return "SELECT name FROM sqlite_master WHERE type='table' and name = ?", args
}
