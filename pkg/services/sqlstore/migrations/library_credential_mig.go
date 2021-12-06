package migrations

import (
	. "github.com/grafana/grafana/pkg/services/sqlstore/migrator"
)

func addLibraryCredentialMigrations(mg *Migrator) {
	libraryCredentialsV1 := Table{
		Name: "library_credential",
		Columns: []*Column{
			{Name: "id", Type: DB_BigInt, Nullable: false, IsPrimaryKey: true, IsAutoIncrement: true},
			{Name: "org_id", Type: DB_BigInt, Nullable: false},
			{Name: "uid", Type: DB_NVarchar, Length: 40, Nullable: false},
			{Name: "type", Type: DB_NVarchar, Length: 255, Nullable: false},
			{Name: "name", Type: DB_NVarchar, Length: 190, Nullable: false},
			{Name: "json_data", Type: DB_Text, Nullable: true},
			{Name: "secure_json_data", Type: DB_Text, Nullable: true},
			{Name: "created", Type: DB_DateTime, Nullable: false},
			{Name: "updated", Type: DB_DateTime, Nullable: false},
		},
		Indices: []*Index{
			{Cols: []string{"org_id", "uid"}, Type: UniqueIndex},
		},
	}

	mg.AddMigration("create library_credential table v1", NewAddTableMigration(libraryCredentialsV1))

	mg.AddMigration("add index library_credential.org_id-uid", NewAddIndexMigration(libraryCredentialsV1, libraryCredentialsV1.Indices[0]))
}
