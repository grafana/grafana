package migrations

import . "github.com/grafana/grafana/pkg/services/sqlstore/migrator"

func addDashboardHistoryMigration(mg *Migrator) {
        var dashboardHistoryV1 = Table{
                Name: "dashboard_history",
                Columns: []*Column{
                        {Name: "id", Type: DB_BigInt, IsPrimaryKey: true, IsAutoIncrement: true},
                        {Name: "dashboard_version", Type: DB_Int, Nullable: false},
                        {Name: "dashboard_id", Type: DB_Int, Nullable: false},
                        {Name: "data", Type: DB_Text, Nullable: false},
                        {Name: "updated_by", Type: DB_Int, Nullable: false},
                },
                Indices: []*Index{
                        {Cols: []string{"dashboard_id"}},
                },
        }

        mg.AddMigration("create dashboard_history table", NewAddTableMigration(dashboardHistoryV1))

        //-------  indexes ------------------
        mg.AddMigration("add index dashboard_history.dashboard_id", NewAddIndexMigration(dashboardHistoryV1, dashboardHistoryV1.Indices[0]))
}
