package migrations

// // create table
// 	mg.AddMigration("create alert table v1", NewAddTableMigration(alertV1))
//
// 	alert_heartbeat := Table{
// 		Name: "alert_heartbeat",
// 		Columns: []*Column{
// 			{Name: "id", Type: DB_BigInt, IsPrimaryKey: true, IsAutoIncrement: true},
// 			{Name: "server_id", Type: DB_NVarchar, Length: 50, Nullable: false},
// 			{Name: "created", Type: DB_DateTime, Nullable: false},
// 			{Name: "updated", Type: DB_DateTime, Nullable: false},
// 		},
// 	}
//
// 	mg.AddMigration("create alert_heartbeat table v1", NewAddTableMigration(alert_heartbeat))
//
//
