package migrations

import . "github.com/grafana/grafana/pkg/services/sqlstore/migrator"

// commented out because of the deadcode CI check
// func addStatsMigrations(mg *Migrator) {
//	statTable := Table{
//		Name: "stat",
//		Columns: []*Column{
//			{Name: "id", Type: DB_Int, IsPrimaryKey: true, IsAutoIncrement: true},
//			{Name: "metric", Type: DB_Varchar, Length: 20, Nullable: false},
//			{Name: "type", Type: DB_Int, Nullable: false},
//		},
//		Indices: []*Index{
//			{Cols: []string{"metric"}, Type: UniqueIndex},
//		},
//	}
//
//	// create table
//	mg.AddMigration("create stat table", NewAddTableMigration(statTable))
//
//	// create indices
//	mg.AddMigration("add index stat.metric", NewAddIndexMigration(statTable, statTable.Indices[0]))
//
//	statValue := Table{
//		Name: "stat_value",
//		Columns: []*Column{
//			{Name: "id", Type: DB_Int, IsPrimaryKey: true, IsAutoIncrement: true},
//			{Name: "value", Type: DB_Double, Nullable: false},
//			{Name: "time", Type: DB_DateTime, Nullable: false},
//		},
//	}
//
//	// create table
//	mg.AddMigration("create stat_value table", NewAddTableMigration(statValue))
// }

func addTestDataMigrations(mg *Migrator) {
	testData := Table{
		Name: "test_data",
		Columns: []*Column{
			{Name: "id", Type: DB_Int, IsPrimaryKey: true, IsAutoIncrement: true},
			{Name: "metric1", Type: DB_Varchar, Length: 20, Nullable: true},
			{Name: "metric2", Type: DB_NVarchar, Length: 150, Nullable: true},
			{Name: "value_big_int", Type: DB_BigInt, Nullable: true},
			{Name: "value_double", Type: DB_Double, Nullable: true},
			{Name: "value_float", Type: DB_Float, Nullable: true},
			{Name: "value_int", Type: DB_Int, Nullable: true},
			{Name: "time_epoch", Type: DB_BigInt, Nullable: false},
			{Name: "time_date_time", Type: DB_DateTime, Nullable: false},
			{Name: "time_time_stamp", Type: DB_TimeStamp, Nullable: false},
		},
	}

	// create table
	mg.AddMigration("create test_data table", NewAddTableMigration(testData))
}
