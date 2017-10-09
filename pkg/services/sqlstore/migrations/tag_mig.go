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
}
