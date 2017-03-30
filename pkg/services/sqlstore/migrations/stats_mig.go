package migrations

import . "github.com/grafana/grafana/pkg/services/sqlstore/migrator"

func addStatsMigrations(mg *Migrator) {
	statTable := Table{
		Name: "stat",
		Columns: []*Column{
			{Name: "id", Type: DB_Int, IsPrimaryKey: true, IsAutoIncrement: true},
			{Name: "metric", Type: DB_Varchar, Length: 20, Nullable: false},
			{Name: "type", Type: DB_Int, Nullable: false},
		},
		Indices: []*Index{
			{Cols: []string{"metric"}, Type: UniqueIndex},
		},
	}

	// create table
	mg.AddMigration("create stat table", NewAddTableMigration(statTable))

	// create indices
	mg.AddMigration("add index stat.metric", NewAddIndexMigration(statTable, statTable.Indices[0]))

	statValue := Table{
		Name: "stat_value",
		Columns: []*Column{
			{Name: "id", Type: DB_Int, IsPrimaryKey: true, IsAutoIncrement: true},
			{Name: "value", Type: DB_Double, Nullable: false},
			{Name: "time", Type: DB_DateTime, Nullable: false},
		},
	}

	// create table
	mg.AddMigration("create stat_value table", NewAddTableMigration(statValue))
}
