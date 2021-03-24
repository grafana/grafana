package notifier

import "github.com/grafana/grafana/pkg/services/sqlstore/migrator"

func alertmanagerConfigurationMigration(mg *migrator.Migrator) {
	alertConfiguration := migrator.Table{
		Name: "alert_configuration",
		Columns: []*migrator.Column{
			{Name: "id", Type: migrator.DB_BigInt, IsPrimaryKey: true, IsAutoIncrement: true},
			{Name: "alertmanager_configuration", Type: migrator.DB_Text, Nullable: false},
			{Name: "configuration_version", Type: migrator.DB_NVarchar, Length: 3}, // In a format of vXX e.g. v1, v2, v10, etc
			{Name: "created_at", Type: migrator.DB_Int, Nullable: false},
		},
	}

	mg.AddMigration("create_alert_configuration_table", migrator.NewAddTableMigration(alertConfiguration))
}
