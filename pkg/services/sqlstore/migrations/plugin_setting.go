package migrations

import . "github.com/grafana/grafana/pkg/services/sqlstore/migrator"

func addAppSettingsMigration(mg *Migrator) {
	pluginSettingTable := Table{
		Name: "plugin_setting",
		Columns: []*Column{
			{Name: "id", Type: DB_BigInt, IsPrimaryKey: true, IsAutoIncrement: true},
			{Name: "org_id", Type: DB_BigInt, Nullable: true},
			{Name: "plugin_id", Type: DB_NVarchar, Length: 190, Nullable: false},
			{Name: "enabled", Type: DB_Bool, Nullable: false},
			{Name: "pinned", Type: DB_Bool, Nullable: false},
			{Name: "json_data", Type: DB_Text, Nullable: true},
			{Name: "secure_json_data", Type: DB_Text, Nullable: true},
			{Name: "created", Type: DB_DateTime, Nullable: false},
			{Name: "updated", Type: DB_DateTime, Nullable: false},
		},
		Indices: []*Index{
			{Cols: []string{"org_id", "plugin_id"}, Type: UniqueIndex},
		},
	}

	mg.AddMigration("create plugin_setting table", NewAddTableMigration(pluginSettingTable))

	//-------  indexes ------------------
	addTableIndicesMigrations(mg, "v1", pluginSettingTable)

	// add column to store installed version
	mg.AddMigration("Add column plugin_version to plugin_settings", NewAddColumnMigration(pluginSettingTable, &Column{
		Name: "plugin_version", Type: DB_NVarchar, Nullable: true, Length: 50,
	}))

	mg.AddMigration("Update plugin_setting table charset", NewTableCharsetMigration("plugin_setting", []*Column{
		{Name: "plugin_id", Type: DB_NVarchar, Length: 190, Nullable: false},
		{Name: "json_data", Type: DB_Text, Nullable: true},
		{Name: "secure_json_data", Type: DB_Text, Nullable: true},
		{Name: "plugin_version", Type: DB_NVarchar, Nullable: true, Length: 50},
	}))

	// set org_id default value to 1 and not null
	mg.AddMigration("update NULL org_id to 1", NewRawSQLMigration("UPDATE plugin_setting SET org_id=1 where org_id IS NULL;"))

	mg.AddMigration("make org_id NOT NULL and DEFAULT VALUE 1", NewRawSQLMigration("").
		Mysql("ALTER TABLE plugin_setting MODIFY COLUMN org_id BIGINT NOT NULL DEFAULT 1;").
		Postgres(`
			ALTER TABLE plugin_setting
				ALTER COLUMN org_id SET NOT NULL,
				ALTER COLUMN org_id SET DEFAULT 1;
		`).
		SQLite(`
			CREATE TABLE "plugin_setting_new" (
			"id" INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
			"org_id" INTEGER NOT NULL DEFAULT 1,
			"plugin_id" TEXT NOT NULL,
			"enabled" INTEGER NOT NULL,
			"pinned" INTEGER NOT NULL,
			"json_data" TEXT NULL,
			"secure_json_data" TEXT NULL,
			"created" DATETIME NOT NULL,
			"updated" DATETIME NOT NULL,
			"plugin_version" TEXT NULL);
			INSERT INTO "plugin_setting_new" SELECT
				"id",
				COALESCE("org_id", 1),
				"plugin_id",
				"enabled",
				"pinned",
				"json_data",
				"secure_json_data",
				"created",
				"updated",
				"plugin_version"
			FROM "plugin_setting";
			DROP TABLE "plugin_setting";
			ALTER TABLE "plugin_setting_new" RENAME TO "plugin_setting";
			CREATE UNIQUE INDEX "UQE_plugin_setting_org_id_plugin_id" ON "plugin_setting" ("org_id","plugin_id");
		`),
	)
}
