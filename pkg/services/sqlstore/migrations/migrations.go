package migrations

var migrationList []*migration

func init() {
	new(migrationBuilder).
		desc("Create account table").
		sqlite(`
		  CREATE TABLE account (
		  	id INTEGER PRIMARY KEY
			)
		`).
		verifyTable("account")
}

type SchemaVersion struct {
	Version int
}

type SchemaLog struct {
	Id      int64
	Version int64
	Desc    string
	Info    string
	Error   bool
}
