package migrations

import (
	. "github.com/grafana/grafana/pkg/services/sqlstore/migrator"
)

// addColorshapesMigrations creates the storage for the apps/colorshapes learning app.
// It is a plain app-owned table, not unified storage — see apps/colorshapes/plan.md.
func addColorshapesMigrations(mg *Migrator) {
	colorshapeHitV1 := Table{
		Name: "colorshape_hit",
		Columns: []*Column{
			{Name: "id", Type: DB_BigInt, Nullable: false, IsPrimaryKey: true, IsAutoIncrement: true},
			{Name: "created_at", Type: DB_BigInt, Nullable: false},
			{Name: "source_ip", Type: DB_NVarchar, Length: 64, Nullable: false},
			{Name: "color", Type: DB_NVarchar, Length: 64, Nullable: false},
			{Name: "shape", Type: DB_NVarchar, Length: 64, Nullable: false},
			{Name: "created_by", Type: DB_NVarchar, Length: 64, Nullable: false},
		},
		Indices: []*Index{
			{Cols: []string{"created_at"}},
		},
	}

	mg.AddMigration("create colorshape_hit table v1", NewAddTableMigration(colorshapeHitV1))
	mg.AddMigration("add index colorshape_hit.created_at", NewAddIndexMigration(colorshapeHitV1, colorshapeHitV1.Indices[0]))
	eventV1 := Table{
		Name: "error_tracking_event",
		Columns: []*Column{
			{Name: "id", Type: DB_BigInt, Nullable: false, IsPrimaryKey: true, IsAutoIncrement: true},
			{Name: "event_id", Type: DB_NVarchar, Length: 64, Nullable: false},
			{Name: "project_id", Type: DB_NVarchar, Length: 64, Nullable: false},
			{Name: "message", Type: DB_MediumText, Nullable: false},
			{Name: "occurred_at", Type: DB_BigInt, Nullable: false},
			{Name: "raw_event", Type: DB_MediumText, Nullable: false},
		},
		Indices: []*Index{
			{Cols: []string{"project_id", "event_id"}, Type: UniqueIndex},
			{Cols: []string{"occurred_at"}},
		},
	}
	mg.AddMigration("create error_tracking_event table v1", NewAddTableMigration(eventV1))
	mg.AddMigration("add unique index error_tracking_event.project_id-event_id", NewAddIndexMigration(eventV1, eventV1.Indices[0]))
	mg.AddMigration("add index error_tracking_event.occurred_at", NewAddIndexMigration(eventV1, eventV1.Indices[1]))
}
