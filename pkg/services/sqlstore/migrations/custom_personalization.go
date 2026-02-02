package migrations

import (
	. "github.com/grafana/grafana/pkg/services/sqlstore/migrator"
)

func addCustomPersonalizationMigrations(mg *Migrator) {
	customPersonalizationTableV1 := Table{
		Name: "custom_personalization",
		Columns: []*Column{
			{Name: "id", Type: DB_BigInt, IsPrimaryKey: true, IsAutoIncrement: true},
			{Name: "org_id", Type: DB_BigInt, Nullable: false},
			{Name: "user_id", Type: DB_BigInt, Nullable: false},
			{Name: "dash_uid", Type: DB_NVarchar, Length: 190, Nullable: false},
			{Name: "data", Type: DB_Text, Nullable: true},
		},
		Indices: []*Index{
			{Cols: []string{"org_id", "user_id", "dash_uid"}, Type: UniqueIndex},
		},
	}
	mg.AddMigration("create custom_personalization table v1", NewAddTableMigration(customPersonalizationTableV1))
}
