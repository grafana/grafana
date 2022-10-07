package accesscontrol

import "github.com/grafana/grafana/pkg/services/sqlstore/migrator"

const migSQLITERoleNameNullable = `ALTER TABLE seed_assignment ADD COLUMN tmp_role_name VARCHAR(190) DEFAULT NULL;
UPDATE seed_assignment SET tmp_role_name = role_name;
ALTER TABLE seed_assignment DROP COLUMN role_name;
ALTER TABLE seed_assignment RENAME COLUMN tmp_role_name TO role_name;`

func AddSeedAssignmentMigrations(mg *migrator.Migrator) {
	seedAssignmentTable := migrator.Table{Name: "seed_assignment"}

	mg.AddMigration("add action column to seed_assignment",
		migrator.NewAddColumnMigration(seedAssignmentTable,
			&migrator.Column{Name: "action", Type: migrator.DB_Varchar, Length: 190, Nullable: true}))

	mg.AddMigration("add scope column to seed_assignment",
		migrator.NewAddColumnMigration(seedAssignmentTable,
			&migrator.Column{Name: "scope", Type: migrator.DB_Varchar, Length: 190, Nullable: true}))

	mg.AddMigration("remove unique index builtin_role_role_name before nullable update",
		migrator.NewDropIndexMigration(seedAssignmentTable,
			&migrator.Index{Cols: []string{"builtin_role", "role_name"}, Type: migrator.UniqueIndex}))

	mg.AddMigration("update seed_assignment role_name column to nullable",
		migrator.NewRawSQLMigration("").
			SQLite(migSQLITERoleNameNullable).
			Postgres("ALTER TABLE `seed_assignment` ALTER COLUMN role_name DROP NOT NULL;").
			Mysql("ALTER TABLE seed_assignment MODIFY role_name VARCHAR(190) DEFAULT NULL;"))

	mg.AddMigration("add unique index builtin_role_name back",
		migrator.NewAddIndexMigration(seedAssignmentTable,
			&migrator.Index{Cols: []string{"builtin_role", "role_name"}, Type: migrator.UniqueIndex}))

	mg.AddMigration("add unique index builtin_role_action_scope",
		migrator.NewAddIndexMigration(seedAssignmentTable,
			&migrator.Index{Cols: []string{"builtin_role", "action", "scope"}, Type: migrator.UniqueIndex}))
}
