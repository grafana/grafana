package migrations

var migrationList []*migration

func init() {
	new(migrationBuilder).
		// ------------------------------
		desc("Create account table").
		sqlite(`
		  CREATE TABLE account (
		  	id INTEGER PRIMARY KEY AUTOINCREMENT
			)
		`).
		mysql(`
		  CREATE TABLE account (
		  	id BIGINT NOT NULL AUTO_INCREMENT, PRIMARY KEY (id)
		  )
		`).
		verifyTable("account").add()
	// ------------------------------
	//		desc("Add name column to account table").
	// table("account").addColumn("name").colType(DB_TYPE_STRING)
	// sqlite("ALTER TABLE account ADD COLUMN name TEXT").
	// mysql("ALTER TABLE account ADD COLUMN name NVARCHAR(255)").
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
