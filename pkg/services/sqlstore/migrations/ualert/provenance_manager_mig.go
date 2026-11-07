package ualert

import "github.com/grafana/grafana/pkg/services/sqlstore/migrator"

// AddManagerPropertiesColumnsToProvenanceType adds manager_kind and manager_identity
// columns to the provenance_type table to support the ManagerProperties concept
// used by app-platform APIs, while preserving the existing provenance column for
// backwards compatibility with legacy readers.
func AddManagerPropertiesColumnsToProvenanceType(mg *migrator.Migrator) {
	mg.AddMigration("add manager_kind column to provenance_type table", migrator.NewAddColumnMigration(migrator.Table{Name: "provenance_type"}, &migrator.Column{
		Name: "manager_kind", Type: migrator.DB_NVarchar, Length: DefaultFieldMaxLength, Nullable: true,
	}))
	mg.AddMigration("add manager_identity column to provenance_type table", migrator.NewAddColumnMigration(migrator.Table{Name: "provenance_type"}, &migrator.Column{
		Name: "manager_identity", Type: migrator.DB_NVarchar, Length: DefaultFieldMaxLength, Nullable: true,
	}))
}

// AddSourceURLColumnToProvenanceType adds the optional source URL stored with a
// provisioned object's provenance. Legacy provenance writes do not include this column.
func AddSourceURLColumnToProvenanceType(mg *migrator.Migrator) {
	mg.AddMigration("add source_url column to provenance_type table", migrator.NewAddColumnMigration(migrator.Table{Name: "provenance_type"}, &migrator.Column{
		Name: "source_url", Type: migrator.DB_Text, Nullable: true,
	}))
}
