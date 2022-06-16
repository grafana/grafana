package migrations

import . "github.com/grafana/grafana/pkg/services/sqlstore/migrator"

func addEntityEventsTableMigration(mg *Migrator) {
	entityEventsTable := Table{
		Name: "entity_event",
		Columns: []*Column{
			{Name: "id", Type: DB_BigInt, Nullable: false, IsPrimaryKey: true, IsAutoIncrement: true},
			{Name: "entity_id", Type: DB_NVarchar, Length: 1024, Nullable: false},
			{Name: "event_type", Type: DB_NVarchar, Length: 8, Nullable: false},
			{Name: "created", Type: DB_BigInt, Nullable: false},
		},
		Indices: []*Index{},
	}

	mg.AddMigration("create entity_events table", NewAddTableMigration(entityEventsTable))
}
