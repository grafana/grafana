package ssosettings

import "github.com/grafana/grafana/pkg/services/sqlstore/migrator"

func AddMigration(mg *migrator.Migrator) {
	var ssoSettingV1 = migrator.Table{
		Name: "sso_setting",
		Columns: []*migrator.Column{
			{Name: "id", Type: migrator.DB_NVarchar, Length: 40, IsPrimaryKey: true}, // Store uuidv4
			{Name: "provider", Type: migrator.DB_NVarchar, Length: 255, Nullable: false},
			{Name: "settings", Type: migrator.DB_Text, Nullable: false},
			{Name: "created", Type: migrator.DB_DateTime, Nullable: false},
			{Name: "updated", Type: migrator.DB_DateTime, Nullable: false},
			{Name: "is_deleted", Type: migrator.DB_Bool, Nullable: false, Default: "0"},
		},
	}

	mg.AddMigration("create sso_setting table", migrator.NewAddTableMigration(ssoSettingV1))
}
