package migrations

import (
	"github.com/grafana/grafana/pkg/services/libraryelements/model"
	"github.com/grafana/grafana/pkg/services/sqlstore/migrator"
)

// addLibraryElementsMigrations defines database migrations for library elements.
func addLibraryElementsMigrations(mg *migrator.Migrator) {
	libraryElementsV1 := migrator.Table{
		Name: "library_element",
		Columns: []*migrator.Column{
			{Name: "id", Type: migrator.DB_BigInt, IsPrimaryKey: true, IsAutoIncrement: true},
			{Name: "org_id", Type: migrator.DB_BigInt, Nullable: false},
			{Name: "folder_id", Type: migrator.DB_BigInt, Nullable: false},
			{Name: "uid", Type: migrator.DB_NVarchar, Length: 40, Nullable: false},
			{Name: "name", Type: migrator.DB_NVarchar, Length: 150, Nullable: false},
			{Name: "kind", Type: migrator.DB_BigInt, Nullable: false},
			{Name: "type", Type: migrator.DB_NVarchar, Length: 40, Nullable: false},
			{Name: "description", Type: migrator.DB_NVarchar, Length: 255, Nullable: false},
			{Name: "model", Type: migrator.DB_Text, Nullable: false},
			{Name: "created", Type: migrator.DB_DateTime, Nullable: false},
			{Name: "created_by", Type: migrator.DB_BigInt, Nullable: false},
			{Name: "updated", Type: migrator.DB_DateTime, Nullable: false},
			{Name: "updated_by", Type: migrator.DB_BigInt, Nullable: false},
			{Name: "version", Type: migrator.DB_BigInt, Nullable: false},
		},
		Indices: []*migrator.Index{
			{Cols: []string{"org_id", "folder_id", "name", "kind"}, Type: migrator.UniqueIndex},
		},
	}

	mg.AddMigration("create library_element table v1", migrator.NewAddTableMigration(libraryElementsV1))
	mg.AddMigration("add index library_element org_id-folder_id-name-kind", migrator.NewAddIndexMigration(libraryElementsV1, libraryElementsV1.Indices[0]))

	libraryElementConnectionV1 := migrator.Table{
		Name: model.LibraryElementConnectionTableName,
		Columns: []*migrator.Column{
			{Name: "id", Type: migrator.DB_BigInt, IsPrimaryKey: true, IsAutoIncrement: true},
			{Name: "element_id", Type: migrator.DB_BigInt, Nullable: false},
			{Name: "kind", Type: migrator.DB_BigInt, Nullable: false},
			{Name: "connection_id", Type: migrator.DB_BigInt, Nullable: false},
			{Name: "created", Type: migrator.DB_DateTime, Nullable: false},
			{Name: "created_by", Type: migrator.DB_BigInt, Nullable: false},
		},
		Indices: []*migrator.Index{
			{Cols: []string{"element_id", "kind", "connection_id"}, Type: migrator.UniqueIndex},
		},
	}

	mg.AddMigration("create "+model.LibraryElementConnectionTableName+" table v1", migrator.NewAddTableMigration(libraryElementConnectionV1))
	mg.AddMigration("add index "+model.LibraryElementConnectionTableName+" element_id-kind-connection_id", migrator.NewAddIndexMigration(libraryElementConnectionV1, libraryElementConnectionV1.Indices[0]))

	mg.AddMigration("add unique index library_element org_id_uid", migrator.NewAddIndexMigration(libraryElementsV1, &migrator.Index{
		Cols: []string{"org_id", "uid"}, Type: migrator.UniqueIndex,
	}))

	mg.AddMigration("increase max description length to 2048", migrator.NewTableCharsetMigration("library_element", []*migrator.Column{
		{Name: "description", Type: migrator.DB_NVarchar, Length: 2048, Nullable: false},
	}))

	mg.AddMigration("alter library_element model to mediumtext", migrator.NewRawSQLMigration("").
		Mysql("ALTER TABLE library_element MODIFY model MEDIUMTEXT NOT NULL;"))
}
