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
}
