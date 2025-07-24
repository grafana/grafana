package migrations

import . "github.com/grafana/grafana/pkg/services/sqlstore/migrator"

func addSettingPrimaryKeyMigration(mg *Migrator) {
	// Add primary key to setting table on (section, key) columns
	// This converts the existing unique constraint to a primary key
	// Only run if the unique index exists (which means the table exists but doesn't have primary key)
	migration := NewRawSQLMigration("").
		Mysql(`
			ALTER TABLE setting 
			DROP INDEX UQE_setting_section_key,
			ADD PRIMARY KEY (section, ` + "`key`" + `);
		`).
		Postgres(`
			ALTER TABLE setting 
			DROP CONSTRAINT UQE_setting_section_key,
			ADD PRIMARY KEY (section, key);
		`).
		SQLite(`
			-- For SQLite we need to recreate the table with primary key
			CREATE TABLE setting_new (
				section varchar(100) NOT NULL,
				` + "`key`" + ` varchar(100) NOT NULL,
				value text NOT NULL,
				encrypted_value text,
				PRIMARY KEY (section, ` + "`key`" + `)
			);
			INSERT INTO setting_new SELECT section, ` + "`key`" + `, value, encrypted_value FROM setting;
			DROP TABLE setting;
			ALTER TABLE setting_new RENAME TO setting;
		`)

	// Set condition to check if the unique index exists (which means the table exists but doesn't have primary key)
	migration.Condition = &IfIndexExistsCondition{TableName: "setting", IndexName: "UQE_setting_section_key"}

	mg.AddMigration("add primary key to setting table", migration)
}
