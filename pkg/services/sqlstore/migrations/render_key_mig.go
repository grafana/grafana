package migrations

import "github.com/grafana/grafana/pkg/services/sqlstore/migrator"

func addCreateRenderKeyTableMigration(mg *migrator.Migrator) {
	renderKey := migrator.Table{
		Name: "render_key",
		Columns: []*migrator.Column{
			{Name: "id", Type: migrator.DB_BigInt, IsPrimaryKey: true, IsAutoIncrement: true},
			{Name: "user_id", Type: migrator.DB_BigInt, Nullable: false},
			{Name: "org_id", Type: migrator.DB_BigInt, Nullable: false},
			{Name: "org_role", Type: migrator.DB_NVarchar, Length: 20, Nullable: false},
			{Name: "key", Type: migrator.DB_NVarchar, Length: 40, Nullable: false},
			{Name: "refreshed", Type: migrator.DB_DateTime, Nullable: false},
			{Name: "created", Type: migrator.DB_DateTime, Nullable: false},
		},
		Indices: []*migrator.Index{
			{Cols: []string{"key", "refreshed"}},
			{Cols: []string{"org_id", "user_id", "org_role", "refreshed"}},
		},
	}

	mg.AddMigration("create render_key table", migrator.NewAddTableMigration(renderKey))
	mg.AddMigration("add renderKey index for render_key table", migrator.NewAddIndexMigration(renderKey, renderKey.Indices[0]))
	mg.AddMigration("add user ref index for render_key table", migrator.NewAddIndexMigration(renderKey, renderKey.Indices[1]))
}
