package migrations

import (
	"fmt"

	"github.com/grafana/grafana/pkg/services/sqlstore/migrator"
)

func initSecureFieldTables(mg *migrator.Migrator) string {
	marker := "Initialize secure field tables"
	mg.AddMigration(marker, &migrator.RawSQLMigration{})

	tables := []migrator.Table{}

	// Write only table -- any updates will create a new GUID, and eventually delete the old value
	tables = append(tables, migrator.Table{
		Name: "secure_field",
		Columns: []*migrator.Column{
			// This GUID will be shown to anyone who can see the resource
			{Name: "guid", Type: migrator.DB_NVarchar, Length: 36, Nullable: false, IsPrimaryKey: true},

			// K8s Identity group+(version)+namespace+resource+name
			// Used for access control
			{Name: "group", Type: migrator.DB_NVarchar, Length: 190, Nullable: false},
			{Name: "resource", Type: migrator.DB_NVarchar, Length: 190, Nullable: false},
			{Name: "namespace", Type: migrator.DB_NVarchar, Length: 63, Nullable: false},
			{Name: "name", Type: migrator.DB_NVarchar, Length: 190, Nullable: false},

			// The secure field name, this will also be included in
			{Name: "field", Type: migrator.DB_NVarchar, Length: 36, Nullable: false},

			// Encrypted secret value empty when the value is actually managed in a 3rd party system (enterprise only)
			{Name: "salt", Type: migrator.DB_NVarchar, Length: 36, Nullable: true},
			{Name: "encrypted", Type: migrator.DB_Text, Nullable: true},

			// ??? hash the raw value (+namespace for salt?) to help identify secrete reuse ????
			{Name: "hash", Type: migrator.DB_NVarchar, Length: 40, Nullable: true},

			// For enterprise, join in the ref table ???
			{Name: "ref", Type: migrator.DB_NVarchar, Length: 40, Nullable: true},

			// snowflake for when the values were created
			{Name: "created", Type: migrator.DB_BigInt, Nullable: false},
		},
		Indices: []*migrator.Index{
			{Cols: []string{"namespace", "group", "resource", "name", "field"}, Type: migrator.UniqueIndex},
			{Cols: []string{"ref"}, Type: migrator.IndexType},
			{Cols: []string{"hash"}, Type: migrator.IndexType},
		},
	})

	// Enterprise only???? ability to share secrets between resources
	tables = append(tables, migrator.Table{
		Name: "secure_field_ref",
		Columns: []*migrator.Column{
			{Name: "guid", Type: migrator.DB_NVarchar, Length: 36, Nullable: false, IsPrimaryKey: true},

			// Encrypted secret value
			{Name: "value", Type: migrator.DB_Text, Nullable: true},

			// A secure hash with salt that can help identity secret field reuse
			{Name: "hash", Type: migrator.DB_NVarchar, Length: 40, Nullable: true},

			// ??? The key inside some upstream system?  (eg vault/etc)
			{Name: "origin", Type: migrator.DB_NVarchar, Length: 40, Nullable: true},

			{Name: "created", Type: migrator.DB_DateTime, Nullable: false},
			{Name: "updated", Type: migrator.DB_DateTime, Nullable: false},
		},
		Indices: []*migrator.Index{
			{Cols: []string{"origin"}, Type: migrator.IndexType},
			{Cols: []string{"hash"}, Type: migrator.IndexType},
		},
	})

	// Initialize all tables
	for t := range tables {
		mg.AddMigration("drop table "+tables[t].Name, migrator.NewDropTableMigration(tables[t].Name))
		mg.AddMigration("create table "+tables[t].Name, migrator.NewAddTableMigration(tables[t]))
		for i := range tables[t].Indices {
			mg.AddMigration(fmt.Sprintf("create table %s, index: %d", tables[t].Name, i), migrator.NewAddIndexMigration(tables[t], tables[t].Indices[i]))
		}
	}

	return marker
}
