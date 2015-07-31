package migrations

import . "github.com/grafana/grafana/pkg/services/sqlstore/migrator"

func addAlertSchedulerValueMigration(mg *Migrator) {

	var alertSchedV1 = Table{
		Name: "alert_scheduler_value",
		Columns: []*Column{
			{Name: "id", Type: DB_Varchar, Length: 255, IsPrimaryKey: true},
			{Name: "value", Type: DB_Varchar, Length: 255, Nullable: false},
		},
	}
	mg.AddMigration("create alert_scheduler_value table v1", NewAddTableMigration(alertSchedV1))

}
