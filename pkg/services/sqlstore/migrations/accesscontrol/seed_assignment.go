package accesscontrol

import (
	"github.com/grafana/grafana/pkg/util/xorm"

	"github.com/grafana/grafana/pkg/services/sqlstore/migrator"
)

const PreventSeedingOnCallAccessID = "prevent seeding OnCall access"

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

	mg.AddMigration("add primary key to seed_assigment", &seedAssignmentPrimaryKeyMigrator{})

	mg.AddMigration("add origin column to seed_assignment",
		migrator.NewAddColumnMigration(seedAssignmentTable,
			&migrator.Column{Name: "origin", Type: migrator.DB_Varchar, Length: 190, Nullable: true}))

	mg.AddMigration("add origin to plugin seed_assignment", &seedAssignmentOnCallMigrator{})
	mg.AddMigration(PreventSeedingOnCallAccessID, &SeedAssignmentOnCallAccessMigrator{})
}

type seedAssignmentPrimaryKeyMigrator struct {
	migrator.MigrationBase
}

func (m *seedAssignmentPrimaryKeyMigrator) SQL(dialect migrator.Dialect) string {
	return CodeMigrationSQL
}

func (m *seedAssignmentPrimaryKeyMigrator) Exec(sess *xorm.Session, mig *migrator.Migrator) error {
	driver := mig.Dialect.DriverName()

	switch driver {
	case migrator.MySQL:
		_, err := sess.Exec("ALTER TABLE seed_assignment ADD id INT NOT NULL AUTO_INCREMENT FIRST, ADD PRIMARY KEY (id)")
		return err
	case migrator.Postgres:
		_, err := sess.Exec("ALTER TABLE seed_assignment ADD COLUMN id SERIAL PRIMARY KEY")
		return err
	}

	// sqlite does not allow to add constraint after a table is created
	// We need to create a new table with desired columns, move data to new table, delete old table and rename new table to old

	// create temp table
	_, err := sess.Exec(`
		CREATE TABLE seed_assignment_temp (
		    id INTEGER PRIMARY KEY AUTOINCREMENT,
			builtin_role TEXT,
			action TEXT,
			scope TEXT,
			role_name TEXT
		);
	`)
	if err != nil {
		return err
	}

	// copy data to temp table
	_, err = sess.Exec("INSERT INTO seed_assignment_temp (builtin_role, action, scope, role_name) SELECT * FROM seed_assignment;")
	if err != nil {
		return err
	}

	// drop indices on old table
	_, err = sess.Exec("DROP INDEX UQE_seed_assignment_builtin_role_action_scope;")
	if err != nil {
		return err
	}
	_, err = sess.Exec("DROP INDEX UQE_seed_assignment_builtin_role_role_name;")
	if err != nil {
		return err
	}

	// drop old table
	_, err = sess.Exec("DROP TABLE seed_assignment;")
	if err != nil {
		return err
	}

	// rename temp table to old name
	_, err = sess.Exec("ALTER TABLE seed_assignment_temp RENAME TO seed_assignment;")
	if err != nil {
		return err
	}

	// recreate indexes on new table
	_, err = sess.Exec("CREATE UNIQUE INDEX UQE_seed_assignment_builtin_role_action_scope ON seed_assignment (builtin_role, action, scope);")
	if err != nil {
		return err
	}
	_, err = sess.Exec("CREATE UNIQUE INDEX UQE_seed_assignment_builtin_role_role_name ON seed_assignment (builtin_role, role_name);")
	if err != nil {
		return err
	}

	return nil
}

type seedAssignmentOnCallMigrator struct {
	migrator.MigrationBase
}

func (m *seedAssignmentOnCallMigrator) SQL(dialect migrator.Dialect) string {
	return CodeMigrationSQL
}

func (m *seedAssignmentOnCallMigrator) Exec(sess *xorm.Session, mig *migrator.Migrator) error {
	_, err := sess.Exec(
		`UPDATE seed_assignment SET origin = ? WHERE action LIKE ? OR scope = ?`,
		"grafana-oncall-app",
		"grafana-oncall-app%",
		"plugins:id:grafana-oncall-app",
	)
	return err
}

type SeedAssignmentOnCallAccessMigrator struct {
	migrator.MigrationBase
}

func (m *SeedAssignmentOnCallAccessMigrator) SQL(dialect migrator.Dialect) string {
	return CodeMigrationSQL
}

func (m *SeedAssignmentOnCallAccessMigrator) Exec(sess *xorm.Session, mig *migrator.Migrator) error {
	// Check if the migration is necessary
	hasEntry := 0
	if _, err := sess.SQL(`SELECT 1 FROM seed_assignment LIMIT 1`).Get(&hasEntry); err != nil {
		return err
	}
	if hasEntry == 0 {
		// Skip migration the seed assignment table has not been populated
		// Hence the oncall access permission can be granted without any risk
		return nil
	}

	// Check if the permission has not already been seeded
	// This is the case for instances that activated the accessControlOnCall feature already.
	type SeedAssignment struct {
		BuiltinRole, Action, Scope, Origin string
	}
	assigns := []SeedAssignment{}
	err := sess.SQL(`SELECT builtin_role, action, scope, origin FROM seed_assignment WHERE action = ? AND scope = ?`,
		"plugins.app:access", "plugins:id:grafana-oncall-app").
		Find(&assigns)
	if err != nil {
		return err
	}

	basicRoles := map[string]bool{"Viewer": true, "Editor": true, "Admin": true, "Grafana Admin": true}
	for i := range assigns {
		delete(basicRoles, assigns[i].BuiltinRole)
	}
	if len(basicRoles) == 0 {
		return nil
	}

	// By default, basic roles have access to all app plugins; no need for extra permission.
	// Mark OnCall Access permission as already seeded to prevent it from being added to basic roles.
	toSeed := []SeedAssignment{}
	for br := range basicRoles {
		toSeed = append(toSeed, SeedAssignment{
			BuiltinRole: br,
			Action:      "plugins.app:access",
			Scope:       "plugins:id:grafana-oncall-app",
			Origin:      "grafana-oncall-app",
		})
	}
	_, err = sess.Table("seed_assignment").InsertMulti(&toSeed)
	return err
}
