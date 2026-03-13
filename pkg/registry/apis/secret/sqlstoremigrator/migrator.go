package migrator

import (
	"fmt"

	"github.com/grafana/grafana/pkg/registry"
	"github.com/grafana/grafana/pkg/registry/apis/secret/contracts"
	secretmigrator "github.com/grafana/grafana/pkg/storage/secret/migrator"
	sqlstoremigrator "github.com/grafana/grafana/pkg/services/sqlstore/migrator"
)

type secretDBMigrator struct{}

func New() registry.DatabaseMigrator {
	return &secretDBMigrator{}
}

func (*secretDBMigrator) AddMigration(mg *sqlstoremigrator.Migrator) {
	mg.AddCreateMigration()

	mg.AddMigration("Initialize secrets tables", &sqlstoremigrator.RawSQLMigration{})

	tables := make([]sqlstoremigrator.Table, 0, 4)

	secureValueTable := sqlstoremigrator.Table{
		Name: secretmigrator.TableNameSecureValue,
		Columns: []*sqlstoremigrator.Column{
			{Name: "guid", Type: sqlstoremigrator.DB_NVarchar, Length: 36, IsPrimaryKey: true},
			{Name: "name", Type: sqlstoremigrator.DB_NVarchar, Length: 253, Nullable: false},
			{Name: "namespace", Type: sqlstoremigrator.DB_NVarchar, Length: 253, Nullable: false},
			{Name: "annotations", Type: sqlstoremigrator.DB_Text, Nullable: true},
			{Name: "labels", Type: sqlstoremigrator.DB_Text, Nullable: true},
			{Name: "created", Type: sqlstoremigrator.DB_BigInt, Nullable: false},
			{Name: "created_by", Type: sqlstoremigrator.DB_Text, Nullable: false},
			{Name: "updated", Type: sqlstoremigrator.DB_BigInt, Nullable: false},
			{Name: "updated_by", Type: sqlstoremigrator.DB_Text, Nullable: false},
			{Name: "external_id", Type: sqlstoremigrator.DB_Text, Nullable: false},
			{Name: "active", Type: sqlstoremigrator.DB_Bool, Nullable: false},
			{Name: "version", Type: sqlstoremigrator.DB_BigInt, Nullable: false},
			{Name: "description", Type: sqlstoremigrator.DB_NVarchar, Length: 253, Nullable: false},
			{Name: "keeper", Type: sqlstoremigrator.DB_NVarchar, Length: 253, Nullable: true},
			{Name: "decrypters", Type: sqlstoremigrator.DB_Text, Nullable: true},
			{Name: "ref", Type: sqlstoremigrator.DB_NVarchar, Length: 1024, Nullable: true},
		},
		Indices: []*sqlstoremigrator.Index{
			{Cols: []string{"namespace", "name", "version", "active"}, Type: sqlstoremigrator.UniqueIndex},
			{Cols: []string{"namespace", "name", "version"}, Type: sqlstoremigrator.UniqueIndex},
		},
	}
	tables = append(tables, secureValueTable)

	keeperTable := sqlstoremigrator.Table{
		Name: secretmigrator.TableNameKeeper,
		Columns: []*sqlstoremigrator.Column{
			{Name: "guid", Type: sqlstoremigrator.DB_NVarchar, Length: 36, IsPrimaryKey: true},
			{Name: "name", Type: sqlstoremigrator.DB_NVarchar, Length: 253, Nullable: false},
			{Name: "namespace", Type: sqlstoremigrator.DB_NVarchar, Length: 253, Nullable: false},
			{Name: "annotations", Type: sqlstoremigrator.DB_Text, Nullable: true},
			{Name: "labels", Type: sqlstoremigrator.DB_Text, Nullable: true},
			{Name: "created", Type: sqlstoremigrator.DB_BigInt, Nullable: false},
			{Name: "created_by", Type: sqlstoremigrator.DB_Text, Nullable: false},
			{Name: "updated", Type: sqlstoremigrator.DB_BigInt, Nullable: false},
			{Name: "updated_by", Type: sqlstoremigrator.DB_Text, Nullable: false},
			{Name: "description", Type: sqlstoremigrator.DB_NVarchar, Length: 253, Nullable: false},
			{Name: "type", Type: sqlstoremigrator.DB_Text, Nullable: false},
			{Name: "payload", Type: sqlstoremigrator.DB_Text, Nullable: true},
		},
		Indices: []*sqlstoremigrator.Index{
			{Cols: []string{"namespace", "name"}, Type: sqlstoremigrator.UniqueIndex},
		},
	}
	tables = append(tables, keeperTable)

	dataKeyTable := sqlstoremigrator.Table{
		Name: secretmigrator.TableNameDataKey,
		Columns: []*sqlstoremigrator.Column{
			{Name: "uid", Type: sqlstoremigrator.DB_NVarchar, Length: 100, IsPrimaryKey: true},
			{Name: "namespace", Type: sqlstoremigrator.DB_NVarchar, Length: 253, Nullable: false},
			{Name: "label", Type: sqlstoremigrator.DB_NVarchar, Length: 100, IsPrimaryKey: false},
			{Name: "active", Type: sqlstoremigrator.DB_Bool, Nullable: false},
			{Name: "provider", Type: sqlstoremigrator.DB_NVarchar, Length: 50, Nullable: false},
			{Name: "encrypted_data", Type: sqlstoremigrator.DB_Blob, Nullable: false},
			{Name: "created", Type: sqlstoremigrator.DB_DateTime, Nullable: false},
			{Name: "updated", Type: sqlstoremigrator.DB_DateTime, Nullable: false},
		},
	}
	tables = append(tables, dataKeyTable)

	encryptedValueTable := sqlstoremigrator.Table{
		Name: secretmigrator.TableNameEncryptedValue,
		Columns: []*sqlstoremigrator.Column{
			{Name: "namespace", Type: sqlstoremigrator.DB_NVarchar, Length: 253, Nullable: false},
			{Name: "name", Type: sqlstoremigrator.DB_NVarchar, Length: 253, Nullable: false},
			{Name: "version", Type: sqlstoremigrator.DB_BigInt, Nullable: false},
			{Name: "encrypted_data", Type: sqlstoremigrator.DB_Blob, Nullable: false},
			{Name: "created", Type: sqlstoremigrator.DB_BigInt, Nullable: false},
			{Name: "updated", Type: sqlstoremigrator.DB_BigInt, Nullable: false},
		},
		Indices: []*sqlstoremigrator.Index{
			{Cols: []string{"namespace", "name", "version"}, Type: sqlstoremigrator.UniqueIndex},
		},
	}
	tables = append(tables, encryptedValueTable)

	for t := range tables {
		mg.AddMigration("drop table "+tables[t].Name, sqlstoremigrator.NewDropTableMigration(tables[t].Name))
		mg.AddMigration("create table "+tables[t].Name, sqlstoremigrator.NewAddTableMigration(tables[t]))
		for i := range tables[t].Indices {
			mg.AddMigration(fmt.Sprintf("create table %s, index: %d", tables[t].Name, i), sqlstoremigrator.NewAddIndexMigration(tables[t], tables[t].Indices[i]))
		}
	}

	mg.AddMigration("create index for list on "+secretmigrator.TableNameSecureValue, sqlstoremigrator.NewAddIndexMigration(secureValueTable, &sqlstoremigrator.Index{
		Cols: []string{"namespace", "active", "updated"},
		Type: sqlstoremigrator.IndexType,
	}))
	mg.AddMigration("create index for list and read current on "+secretmigrator.TableNameDataKey, sqlstoremigrator.NewAddIndexMigration(dataKeyTable, &sqlstoremigrator.Index{
		Cols: []string{"namespace", "label", "active"},
		Type: sqlstoremigrator.IndexType,
	}))

	mg.AddMigration("add owner_reference_api_group column to "+secretmigrator.TableNameSecureValue, sqlstoremigrator.NewAddColumnMigration(secureValueTable, &sqlstoremigrator.Column{Name: "owner_reference_api_group", Type: sqlstoremigrator.DB_NVarchar, Length: 253, Nullable: true}))
	mg.AddMigration("add owner_reference_api_version column to "+secretmigrator.TableNameSecureValue, sqlstoremigrator.NewAddColumnMigration(secureValueTable, &sqlstoremigrator.Column{Name: "owner_reference_api_version", Type: sqlstoremigrator.DB_NVarchar, Length: 253, Nullable: true}))
	mg.AddMigration("add owner_reference_kind column to "+secretmigrator.TableNameSecureValue, sqlstoremigrator.NewAddColumnMigration(secureValueTable, &sqlstoremigrator.Column{Name: "owner_reference_kind", Type: sqlstoremigrator.DB_NVarchar, Length: 253, Nullable: true}))
	mg.AddMigration("add owner_reference_name column to "+secretmigrator.TableNameSecureValue, sqlstoremigrator.NewAddColumnMigration(secureValueTable, &sqlstoremigrator.Column{Name: "owner_reference_name", Type: sqlstoremigrator.DB_NVarchar, Length: 253, Nullable: true}))
	mg.AddMigration("add lease_token column to "+secretmigrator.TableNameSecureValue, sqlstoremigrator.NewAddColumnMigration(secureValueTable, &sqlstoremigrator.Column{Name: "lease_token", Type: sqlstoremigrator.DB_NVarchar, Length: 36, Nullable: true}))
	mg.AddMigration("add lease_token index to "+secretmigrator.TableNameSecureValue, sqlstoremigrator.NewAddIndexMigration(secureValueTable, &sqlstoremigrator.Index{Cols: []string{"lease_token"}}))
	mg.AddMigration("add lease_created column to "+secretmigrator.TableNameSecureValue, sqlstoremigrator.NewAddColumnMigration(secureValueTable, &sqlstoremigrator.Column{Name: "lease_created", Type: sqlstoremigrator.DB_BigInt, Nullable: false, Default: "0"}))
	mg.AddMigration("add lease_created index to "+secretmigrator.TableNameSecureValue, sqlstoremigrator.NewAddIndexMigration(secureValueTable, &sqlstoremigrator.Index{Cols: []string{"lease_created"}}))
	mg.AddMigration("add data_key_id column to "+secretmigrator.TableNameEncryptedValue, sqlstoremigrator.NewAddColumnMigration(encryptedValueTable, &sqlstoremigrator.Column{Name: "data_key_id", Type: sqlstoremigrator.DB_NVarchar, Length: 100, Nullable: false, Default: "''"}))
	mg.AddMigration("add data_key_id index to "+secretmigrator.TableNameEncryptedValue, sqlstoremigrator.NewAddIndexMigration(encryptedValueTable, &sqlstoremigrator.Index{Cols: []string{"data_key_id"}}))
	mg.AddMigration("add active column to "+secretmigrator.TableNameKeeper, sqlstoremigrator.NewAddColumnMigration(keeperTable, &sqlstoremigrator.Column{Name: "active", Type: sqlstoremigrator.DB_Bool, Nullable: false, Default: "false"}))
	mg.AddMigration("add active column index to "+secretmigrator.TableNameKeeper, sqlstoremigrator.NewAddIndexMigration(keeperTable, &sqlstoremigrator.Index{Cols: []string{"namespace", "name", "active"}}))
	mg.AddMigration("set secret_secure_value.keeper to 'system' where keeper is null in "+secretmigrator.TableNameSecureValue, sqlstoremigrator.NewRawSQLMigration(
		fmt.Sprintf("UPDATE %s SET keeper = '%s' WHERE keeper IS NULL", secretmigrator.TableNameSecureValue, contracts.SystemKeeperName),
	))

	encryptedValueTableUniqueKey := sqlstoremigrator.Index{Cols: []string{"namespace", "name", "version"}, Type: sqlstoremigrator.UniqueIndex}
	updatedEncryptedValueTable := sqlstoremigrator.Table{
		Name: secretmigrator.TableNameEncryptedValue,
		Columns: []*sqlstoremigrator.Column{
			{Name: "namespace", Type: sqlstoremigrator.DB_NVarchar, Length: 253, Nullable: false, IsPrimaryKey: true},
			{Name: "name", Type: sqlstoremigrator.DB_NVarchar, Length: 253, Nullable: false, IsPrimaryKey: true},
			{Name: "version", Type: sqlstoremigrator.DB_BigInt, Nullable: false, IsPrimaryKey: true},
			{Name: "encrypted_data", Type: sqlstoremigrator.DB_Blob, Nullable: false},
			{Name: "created", Type: sqlstoremigrator.DB_BigInt, Nullable: false},
			{Name: "updated", Type: sqlstoremigrator.DB_BigInt, Nullable: false},
			{Name: "data_key_id", Type: sqlstoremigrator.DB_NVarchar, Length: 100, Nullable: false, Default: "''"},
		},
		PrimaryKeys: []string{"namespace", "name", "version"},
		Indices: []*sqlstoremigrator.Index{
			{Cols: []string{"data_key_id"}},
		},
	}
	sqlstoremigrator.ConvertUniqueKeyToPrimaryKey(mg, encryptedValueTableUniqueKey, updatedEncryptedValueTable)
}
