package migrator

import (
	"context"
	"fmt"

	"github.com/grafana/grafana/pkg/registry/apis/secret/contracts"
	"github.com/grafana/grafana/pkg/services/sqlstore/session"
	storagemigrator "github.com/grafana/grafana/pkg/storage/sqlutil/migrator"
)

const (
	TableNameKeeper         = "secret_keeper"
	TableNameSecureValue    = "secret_secure_value"
	TableNameDataKey        = "secret_data_key"
	TableNameEncryptedValue = "secret_encrypted_value"
)

type sqlSessionProvider interface {
	GetSqlxSession() *session.SessionDB
}

type SecretDB struct {
	db *session.SessionDB
}

func NewWithDB(db sqlSessionProvider) contracts.SecretDBMigrator {
	return &SecretDB{db: db.GetSqlxSession()}
}

func (db *SecretDB) RunMigrations(ctx context.Context, lockDatabase bool) error {
	mg := storagemigrator.NewScopedMigrator(db.db, "secret")
	AddMigrations(mg)
	return mg.RunMigrations(ctx, lockDatabase, 0)
}

func AddMigrations(mg *storagemigrator.Migrator) {
	mg.AddCreateMigration()
	mg.AddMigration("Initialize secrets tables", &storagemigrator.RawSQLMigration{})

	tables := make([]storagemigrator.Table, 0, 4)

	secureValueTable := storagemigrator.Table{
		Name: TableNameSecureValue,
		Columns: []*storagemigrator.Column{
			{Name: "guid", Type: storagemigrator.DB_NVarchar, Length: 36, IsPrimaryKey: true},
			{Name: "name", Type: storagemigrator.DB_NVarchar, Length: 253, Nullable: false},
			{Name: "namespace", Type: storagemigrator.DB_NVarchar, Length: 253, Nullable: false},
			{Name: "annotations", Type: storagemigrator.DB_Text, Nullable: true},
			{Name: "labels", Type: storagemigrator.DB_Text, Nullable: true},
			{Name: "created", Type: storagemigrator.DB_BigInt, Nullable: false},
			{Name: "created_by", Type: storagemigrator.DB_Text, Nullable: false},
			{Name: "updated", Type: storagemigrator.DB_BigInt, Nullable: false},
			{Name: "updated_by", Type: storagemigrator.DB_Text, Nullable: false},
			{Name: "external_id", Type: storagemigrator.DB_Text, Nullable: false},
			{Name: "active", Type: storagemigrator.DB_Bool, Nullable: false},
			{Name: "version", Type: storagemigrator.DB_BigInt, Nullable: false},
			{Name: "description", Type: storagemigrator.DB_NVarchar, Length: 253, Nullable: false},
			{Name: "keeper", Type: storagemigrator.DB_NVarchar, Length: 253, Nullable: true},
			{Name: "decrypters", Type: storagemigrator.DB_Text, Nullable: true},
			{Name: "ref", Type: storagemigrator.DB_NVarchar, Length: 1024, Nullable: true},
		},
		Indices: []*storagemigrator.Index{
			{Cols: []string{"namespace", "name", "version", "active"}, Type: storagemigrator.UniqueIndex},
			{Cols: []string{"namespace", "name", "version"}, Type: storagemigrator.UniqueIndex},
		},
	}
	tables = append(tables, secureValueTable)

	keeperTable := storagemigrator.Table{
		Name: TableNameKeeper,
		Columns: []*storagemigrator.Column{
			{Name: "guid", Type: storagemigrator.DB_NVarchar, Length: 36, IsPrimaryKey: true},
			{Name: "name", Type: storagemigrator.DB_NVarchar, Length: 253, Nullable: false},
			{Name: "namespace", Type: storagemigrator.DB_NVarchar, Length: 253, Nullable: false},
			{Name: "annotations", Type: storagemigrator.DB_Text, Nullable: true},
			{Name: "labels", Type: storagemigrator.DB_Text, Nullable: true},
			{Name: "created", Type: storagemigrator.DB_BigInt, Nullable: false},
			{Name: "created_by", Type: storagemigrator.DB_Text, Nullable: false},
			{Name: "updated", Type: storagemigrator.DB_BigInt, Nullable: false},
			{Name: "updated_by", Type: storagemigrator.DB_Text, Nullable: false},
			{Name: "description", Type: storagemigrator.DB_NVarchar, Length: 253, Nullable: false},
			{Name: "type", Type: storagemigrator.DB_Text, Nullable: false},
			{Name: "payload", Type: storagemigrator.DB_Text, Nullable: true},
		},
		Indices: []*storagemigrator.Index{
			{Cols: []string{"namespace", "name"}, Type: storagemigrator.UniqueIndex},
		},
	}
	tables = append(tables, keeperTable)

	dataKeyTable := storagemigrator.Table{
		Name: TableNameDataKey,
		Columns: []*storagemigrator.Column{
			{Name: "uid", Type: storagemigrator.DB_NVarchar, Length: 100, IsPrimaryKey: true},
			{Name: "namespace", Type: storagemigrator.DB_NVarchar, Length: 253, Nullable: false},
			{Name: "label", Type: storagemigrator.DB_NVarchar, Length: 100, IsPrimaryKey: false},
			{Name: "active", Type: storagemigrator.DB_Bool, Nullable: false},
			{Name: "provider", Type: storagemigrator.DB_NVarchar, Length: 50, Nullable: false},
			{Name: "encrypted_data", Type: storagemigrator.DB_Blob, Nullable: false},
			{Name: "created", Type: storagemigrator.DB_DateTime, Nullable: false},
			{Name: "updated", Type: storagemigrator.DB_DateTime, Nullable: false},
		},
	}
	tables = append(tables, dataKeyTable)

	encryptedValueTable := storagemigrator.Table{
		Name: TableNameEncryptedValue,
		Columns: []*storagemigrator.Column{
			{Name: "namespace", Type: storagemigrator.DB_NVarchar, Length: 253, Nullable: false},
			{Name: "name", Type: storagemigrator.DB_NVarchar, Length: 253, Nullable: false},
			{Name: "version", Type: storagemigrator.DB_BigInt, Nullable: false},
			{Name: "encrypted_data", Type: storagemigrator.DB_Blob, Nullable: false},
			{Name: "created", Type: storagemigrator.DB_BigInt, Nullable: false},
			{Name: "updated", Type: storagemigrator.DB_BigInt, Nullable: false},
		},
		Indices: []*storagemigrator.Index{
			{Cols: []string{"namespace", "name", "version"}, Type: storagemigrator.UniqueIndex},
		},
	}
	tables = append(tables, encryptedValueTable)

	for t := range tables {
		mg.AddMigration("drop table "+tables[t].Name, storagemigrator.NewDropTableMigration(tables[t].Name))
		mg.AddMigration("create table "+tables[t].Name, storagemigrator.NewAddTableMigration(tables[t]))
		for i := range tables[t].Indices {
			mg.AddMigration(fmt.Sprintf("create table %s, index: %d", tables[t].Name, i), storagemigrator.NewAddIndexMigration(tables[t], tables[t].Indices[i]))
		}
	}

	mg.AddMigration("create index for list on "+TableNameSecureValue, storagemigrator.NewAddIndexMigration(secureValueTable, &storagemigrator.Index{
		Cols: []string{"namespace", "active", "updated"},
		Type: storagemigrator.IndexType,
	}))
	mg.AddMigration("create index for list and read current on "+TableNameDataKey, storagemigrator.NewAddIndexMigration(dataKeyTable, &storagemigrator.Index{
		Cols: []string{"namespace", "label", "active"},
		Type: storagemigrator.IndexType,
	}))

	mg.AddMigration("add owner_reference_api_group column to "+TableNameSecureValue, storagemigrator.NewAddColumnMigration(secureValueTable, &storagemigrator.Column{
		Name:     "owner_reference_api_group",
		Type:     storagemigrator.DB_NVarchar,
		Length:   253,
		Nullable: true,
	}))
	mg.AddMigration("add owner_reference_api_version column to "+TableNameSecureValue, storagemigrator.NewAddColumnMigration(secureValueTable, &storagemigrator.Column{
		Name:     "owner_reference_api_version",
		Type:     storagemigrator.DB_NVarchar,
		Length:   253,
		Nullable: true,
	}))
	mg.AddMigration("add owner_reference_kind column to "+TableNameSecureValue, storagemigrator.NewAddColumnMigration(secureValueTable, &storagemigrator.Column{
		Name:     "owner_reference_kind",
		Type:     storagemigrator.DB_NVarchar,
		Length:   253,
		Nullable: true,
	}))
	mg.AddMigration("add owner_reference_name column to "+TableNameSecureValue, storagemigrator.NewAddColumnMigration(secureValueTable, &storagemigrator.Column{
		Name:     "owner_reference_name",
		Type:     storagemigrator.DB_NVarchar,
		Length:   253,
		Nullable: true,
	}))
	mg.AddMigration("add lease_token column to "+TableNameSecureValue, storagemigrator.NewAddColumnMigration(secureValueTable, &storagemigrator.Column{
		Name:     "lease_token",
		Type:     storagemigrator.DB_NVarchar,
		Length:   36,
		Nullable: true,
	}))
	mg.AddMigration("add lease_token index to "+TableNameSecureValue, storagemigrator.NewAddIndexMigration(secureValueTable, &storagemigrator.Index{
		Cols: []string{"lease_token"},
	}))
	mg.AddMigration("add lease_created column to "+TableNameSecureValue, storagemigrator.NewAddColumnMigration(secureValueTable, &storagemigrator.Column{
		Name:     "lease_created",
		Type:     storagemigrator.DB_BigInt,
		Nullable: false,
		Default:  "0",
	}))
	mg.AddMigration("add lease_created index to "+TableNameSecureValue, storagemigrator.NewAddIndexMigration(secureValueTable, &storagemigrator.Index{
		Cols: []string{"lease_created"},
	}))
	mg.AddMigration("add data_key_id column to "+TableNameEncryptedValue, storagemigrator.NewAddColumnMigration(encryptedValueTable, &storagemigrator.Column{
		Name:     "data_key_id",
		Type:     storagemigrator.DB_NVarchar,
		Length:   100,
		Nullable: false,
		Default:  "''",
	}))
	mg.AddMigration("add data_key_id index to "+TableNameEncryptedValue, storagemigrator.NewAddIndexMigration(encryptedValueTable, &storagemigrator.Index{
		Cols: []string{"data_key_id"},
	}))
	mg.AddMigration("add active column to "+TableNameKeeper, storagemigrator.NewAddColumnMigration(keeperTable, &storagemigrator.Column{
		Name:     "active",
		Type:     storagemigrator.DB_Bool,
		Nullable: false,
		Default:  "false",
	}))
	mg.AddMigration("add active column index to "+TableNameKeeper, storagemigrator.NewAddIndexMigration(keeperTable, &storagemigrator.Index{
		Cols: []string{"namespace", "name", "active"},
	}))
	mg.AddMigration("set secret_secure_value.keeper to 'system' where keeper is null in "+TableNameSecureValue, storagemigrator.NewRawSQLMigration(
		fmt.Sprintf("UPDATE %s SET keeper = '%s' WHERE keeper IS NULL", TableNameSecureValue, contracts.SystemKeeperName),
	))

	encryptedValueTableUniqueKey := storagemigrator.Index{Cols: []string{"namespace", "name", "version"}, Type: storagemigrator.UniqueIndex}
	updatedEncryptedValueTable := storagemigrator.Table{
		Name: TableNameEncryptedValue,
		Columns: []*storagemigrator.Column{
			{Name: "namespace", Type: storagemigrator.DB_NVarchar, Length: 253, Nullable: false, IsPrimaryKey: true},
			{Name: "name", Type: storagemigrator.DB_NVarchar, Length: 253, Nullable: false, IsPrimaryKey: true},
			{Name: "version", Type: storagemigrator.DB_BigInt, Nullable: false, IsPrimaryKey: true},
			{Name: "encrypted_data", Type: storagemigrator.DB_Blob, Nullable: false},
			{Name: "created", Type: storagemigrator.DB_BigInt, Nullable: false},
			{Name: "updated", Type: storagemigrator.DB_BigInt, Nullable: false},
			{Name: "data_key_id", Type: storagemigrator.DB_NVarchar, Length: 100, Nullable: false, Default: "''"},
		},
		PrimaryKeys: []string{"namespace", "name", "version"},
		Indices: []*storagemigrator.Index{
			{Cols: []string{"data_key_id"}},
		},
	}
	storagemigrator.ConvertUniqueKeyToPrimaryKey(mg, encryptedValueTableUniqueKey, updatedEncryptedValueTable)
}
