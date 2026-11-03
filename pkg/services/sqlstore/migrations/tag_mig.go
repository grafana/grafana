package migrations

import . "github.com/grafana/grafana/pkg/services/sqlstore/migrator"

func addTagMigration(mg *Migrator) {
	tagTable := Table{
		Name: "tag",
		Columns: []*Column{
			{Name: "id", Type: DB_BigInt, IsPrimaryKey: true, IsAutoIncrement: true},
			{Name: "key", Type: DB_NVarchar, Length: 100, Nullable: false},
			{Name: "value", Type: DB_NVarchar, Length: 100, Nullable: false},
		},
		Indices: []*Index{
			{Cols: []string{"key", "value"}, Type: UniqueIndex},
		},
	}

	// create table
	mg.AddMigration("create tag table", NewAddTableMigration(tagTable))

	// create indices
	mg.AddMigration("add index tag.key_value", NewAddIndexMigration(tagTable, tagTable.Indices[0]))

	// Widen tag.value so alerting state-history tags (grafana_folder holds the
	// rule folder's full path, which has no upstream length limit) are not
	// rejected by enforcing databases. SQLite ignores VARCHAR widths and
	// Postgres widening is metadata-only, so only MySQL needs an explicit
	// MODIFY. 512 keeps the unique (key, value) index within InnoDB's 3072
	// byte key limit: (100 + 512) * 4 = 2448 bytes.
	mg.AddMigration("Increase tag value column to length 512", NewRawSQLMigration("").
		Postgres("ALTER TABLE tag ALTER COLUMN value TYPE VARCHAR(512);").
		Mysql("ALTER TABLE tag MODIFY value VARCHAR(512) NOT NULL;"))
}
