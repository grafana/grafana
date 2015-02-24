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
	mg.AddMigration("create migration_log table", new(AddTableMigration).
		Name("migration_log").WithColumns(
		&Column{Name: "id", Type: DB_BigInt, IsPrimaryKey: true, IsAutoIncrement: true},
		&Column{Name: "migration_id", Type: DB_NVarchar, Length: 255},
		&Column{Name: "sql", Type: DB_Text},
		&Column{Name: "success", Type: DB_Bool},
		&Column{Name: "error", Type: DB_Text},
		&Column{Name: "timestamp", Type: DB_DateTime},
	))
}

func addStarMigrations(mg *Migrator) {
	mg.AddMigration("create star table", new(AddTableMigration).
		Name("star").WithColumns(
		&Column{Name: "id", Type: DB_BigInt, IsPrimaryKey: true, IsAutoIncrement: true},
		&Column{Name: "user_id", Type: DB_BigInt, Nullable: false},
		&Column{Name: "dashboard_id", Type: DB_BigInt, Nullable: false},
	))

	mg.AddMigration("add unique index star.user_id_dashboard_id", new(AddIndexMigration).
		Table("star").Columns("user_id", "dashboard_id").Unique())
}
