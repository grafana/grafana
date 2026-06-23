package migrations

import (
	. "github.com/grafana/grafana/pkg/services/sqlstore/migrator"
)

func addPasskeyCredentialMigrations(mg *Migrator) {
	passkeyCredV1 := Table{
		Name: "user_passkey_credential",
		Columns: []*Column{
			{Name: "id", Type: DB_BigInt, IsPrimaryKey: true, IsAutoIncrement: true},
			{Name: "user_id", Type: DB_BigInt, Nullable: false},
			{Name: "credential_id", Type: DB_Blob, Nullable: false},
			// credential_id_hash holds the SHA-256 hex of credential_id; we unique-index the hash
			// instead of the blob to stay within MySQL's index length limit on binary columns.
			{Name: "credential_id_hash", Type: DB_NVarchar, Length: 64, Nullable: false},
			{Name: "public_key", Type: DB_Blob, Nullable: false},
			{Name: "aaguid", Type: DB_Blob, Nullable: true},
			{Name: "sign_count", Type: DB_BigInt, Nullable: false},
			{Name: "backup_eligible", Type: DB_Bool, Nullable: false},
			{Name: "transports", Type: DB_NVarchar, Length: 255, Nullable: true},
			{Name: "attestation_type", Type: DB_NVarchar, Length: 255, Nullable: true},
			{Name: "name", Type: DB_NVarchar, Length: 190, Nullable: false},
			{Name: "created", Type: DB_DateTime, Nullable: false},
			{Name: "last_used", Type: DB_DateTime, Nullable: true},
		},
		Indices: []*Index{
			{Cols: []string{"credential_id_hash"}, Type: UniqueIndex},
			{Cols: []string{"user_id"}, Type: IndexType},
		},
	}

	mg.AddMigration("create user_passkey_credential table", NewAddTableMigration(passkeyCredV1))
	addTableIndicesMigrations(mg, "v1", passkeyCredV1)
}
