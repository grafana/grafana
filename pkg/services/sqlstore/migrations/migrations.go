package migrations

import . "github.com/grafana/grafana/pkg/services/sqlstore/migrator"

// --- Migration Guide line ---
// 1. Never change a migration that is committed and pushed to master
// 2. Always add new migrations (to change or undo previous migrations)
// 3. Some migraitons are not yet written (rename column, table, drop table, index etc)

func AddMigrations(mg *Migrator) {
	addMigrationLogMigrations(mg)
	addUserMigrations(mg)
	addStarMigrations(mg)
	addOrgMigrations(mg)
	addDashboardMigration(mg)
	addDataSourceMigration(mg)
	addApiKeyMigrations(mg)
}

func addMigrationLogMigrations(mg *Migrator) {
	migrationLogV1 := Table{
		Name: "migration_log",
		Columns: []*Column{
			&Column{Name: "id", Type: DB_BigInt, IsPrimaryKey: true, IsAutoIncrement: true},
			&Column{Name: "migration_id", Type: DB_NVarchar, Length: 255},
			&Column{Name: "sql", Type: DB_Text},
			&Column{Name: "success", Type: DB_Bool},
			&Column{Name: "error", Type: DB_Text},
			&Column{Name: "timestamp", Type: DB_DateTime},
		},
	}

	mg.AddMigration("create migration_log table", NewAddTableMigration(migrationLogV1))
}

func addStarMigrations(mg *Migrator) {
	starV1 := Table{
		Name: "star",
		Columns: []*Column{
			&Column{Name: "id", Type: DB_BigInt, IsPrimaryKey: true, IsAutoIncrement: true},
			&Column{Name: "user_id", Type: DB_BigInt, Nullable: false},
			&Column{Name: "dashboard_id", Type: DB_BigInt, Nullable: false},
		},
		Indices: []*Index{
			&Index{Cols: []string{"user_id", "dashboard_id"}, Type: UniqueIndex},
		},
	}

	mg.AddMigration("create star table", NewAddTableMigration(starV1))
	mg.AddMigration("add unique index star.user_id_dashboard_id", NewAddIndexMigration(starV1, starV1.Indices[0]))
}
