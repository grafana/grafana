package migrations

import (
	. "github.com/grafana/grafana/pkg/services/sqlstore/migrator"
)

func addActiveNodeMigration(mg *Migrator) {
	active_node := Table{
		Name: "active_node",
		Columns: []*Column{
			{Name: "id", Type: DB_BigInt, IsPrimaryKey: true, IsAutoIncrement: true},
			{Name: "node_id", Type: DB_Varchar, Length: 128, Nullable: false},
			{Name: "heartbeat", Type: DB_BigInt, Nullable: false},
			{Name: "part_id", Type: DB_Int, Nullable: false},
			{Name: "alert_run_type", Type: DB_Varchar, Length: 32, Nullable: false},
			{Name: "alert_status", Type: DB_Varchar, Length: 32, Nullable: false},
		},
		Indices: []*Index{
			//{Cols: []string{"heartbeat", "part_id", "alert_run_type", "alert_status"}, Type: UniqueIndex},
			{Cols: []string{"node_id", "heartbeat", "alert_run_type"}, Type: UniqueIndex},
			{Cols: []string{"heartbeat", "part_id", "alert_run_type"}, Type: UniqueIndex},
		},
	}
	mg.AddMigration("create active_node table", NewAddTableMigration(active_node))
	mg.AddMigration("add unique index active_node.node_id_heartbeat_runtype", NewAddIndexMigration(active_node, active_node.Indices[0]))
	mg.AddMigration("add unique index active_node.heartbeat_partid_runtype", NewAddIndexMigration(active_node, active_node.Indices[1]))
}
