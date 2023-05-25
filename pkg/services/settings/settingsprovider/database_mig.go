package settingsprovider

import "github.com/grafana/grafana/pkg/services/sqlstore/migrator"

func AddMigration(mg *migrator.Migrator) {
	var sessionV1 = migrator.Table{
		Name: "setting",
		Columns: []*migrator.Column{
			{Name: "section", Type: migrator.DB_NVarchar, Length: 100, Nullable: false},
			{Name: "key", Type: migrator.DB_NVarchar, Length: 100, Nullable: false},
			{Name: "value", Type: migrator.DB_Text, Nullable: false},
		},
		Indices: []*migrator.Index{
			{Cols: []string{"section", "key"}, Type: migrator.UniqueIndex},
		},
	}

	mg.AddMigration("create settings table", migrator.NewAddTableMigration(sessionV1))
	mg.AddMigration("add unique index settings.section_key", migrator.NewAddIndexMigration(sessionV1, sessionV1.Indices[0]))
}
