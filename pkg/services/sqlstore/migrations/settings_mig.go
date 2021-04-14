package migrations

import . "github.com/grafana/grafana/pkg/services/sqlstore/migrator"

func addSettingsMigration(mg *Migrator) {
	var sessionV1 = Table{
		Name: "setting",
		Columns: []*Column{
			{Name: "section", Type: DB_NVarchar, Length: 100, Nullable: false},
			{Name: "key", Type: DB_NVarchar, Length: 100, Nullable: false},
			{Name: "value", Type: DB_Text, Nullable: false},
		},
		Indices: []*Index{
			{Cols: []string{"section", "key"}, Type: UniqueIndex},
		},
	}

	mg.AddMigration("create settings table", NewAddTableMigration(sessionV1))
	mg.AddMigration("add unique index settings.section_key", NewAddIndexMigration(sessionV1, sessionV1.Indices[0]))
}
