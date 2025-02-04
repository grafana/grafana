package migrator

import (
	"fmt"

	"xorm.io/xorm"

	"github.com/grafana/grafana/pkg/services/sqlstore/migrator"
	"github.com/grafana/grafana/pkg/setting"
)

const (
	TableNameSecureValue    = "secret_secure_value"
	TableNameKeeper         = "secret_keeper"
	TableNameDataKey        = "secret_data_key"
	TableNameEncryptedValue = "secret_encrypted_value"
)

func MigrateSecretSQL(engine *xorm.Engine, cfg *setting.Cfg) error {
	mg := migrator.NewScopedMigrator(engine, cfg, "secret")
	mg.AddCreateMigration()

	initSecretStore(mg)

	// since it's a new feature enable migration locking by default
	return mg.Start(true, 0)
}

func initSecretStore(mg *migrator.Migrator) string {
	marker := "Initialize secrets tables"
	mg.AddMigration(marker, &migrator.RawSQLMigration{})

	tables := []migrator.Table{}

	tables = append(tables, migrator.Table{
		Name: TableNameSecureValue,
		Columns: []*migrator.Column{
			// Kubernetes Metadata
			{Name: "guid", Type: migrator.DB_NVarchar, Length: 36, IsPrimaryKey: true},    // Fixed size of a UUID.
			{Name: "name", Type: migrator.DB_NVarchar, Length: 253, Nullable: false},      // Limit enforced by K8s.
			{Name: "namespace", Type: migrator.DB_NVarchar, Length: 253, Nullable: false}, // Limit enforced by K8s.
			{Name: "annotations", Type: migrator.DB_Text, Nullable: true},
			{Name: "labels", Type: migrator.DB_Text, Nullable: true},
			{Name: "created", Type: migrator.DB_BigInt, Nullable: false},
			{Name: "created_by", Type: migrator.DB_Text, Nullable: false},
			{Name: "updated", Type: migrator.DB_BigInt, Nullable: false}, // Used as RV (ResourceVersion)
			{Name: "updated_by", Type: migrator.DB_Text, Nullable: false},

			// Spec
			{Name: "title", Type: migrator.DB_Text, Nullable: false},
			{Name: "keeper", Type: migrator.DB_Text, Nullable: false},
			{Name: "audiences", Type: migrator.DB_Text, Nullable: false},
			{Name: "ref", Type: migrator.DB_Text, Nullable: true}, // Reference to third-party storage secret path.
			{Name: "external_id", Type: migrator.DB_Text, Nullable: false},
		},
		Indices: []*migrator.Index{
			{Cols: []string{"namespace", "name"}, Type: migrator.UniqueIndex},
		},
	})

	tables = append(tables, migrator.Table{
		Name: TableNameKeeper,
		Columns: []*migrator.Column{
			// Kubernetes Metadata
			{Name: "guid", Type: migrator.DB_NVarchar, Length: 36, IsPrimaryKey: true},    // Fixed size of a UUID.
			{Name: "name", Type: migrator.DB_NVarchar, Length: 253, Nullable: false},      // Limit enforced by K8s.
			{Name: "namespace", Type: migrator.DB_NVarchar, Length: 253, Nullable: false}, // Limit enforced by K8s.
			{Name: "annotations", Type: migrator.DB_Text, Nullable: true},
			{Name: "labels", Type: migrator.DB_Text, Nullable: true},
			{Name: "created", Type: migrator.DB_BigInt, Nullable: false},
			{Name: "created_by", Type: migrator.DB_Text, Nullable: false},
			{Name: "updated", Type: migrator.DB_BigInt, Nullable: false}, // Used as RV (ResourceVersion)
			{Name: "updated_by", Type: migrator.DB_Text, Nullable: false},

			// Spec
			{Name: "title", Type: migrator.DB_Text, Nullable: false},
			{Name: "type", Type: migrator.DB_Text, Nullable: false},
			// Each keeper has a different payload so we store the whole thing as a blob.
			{Name: "payload", Type: migrator.DB_Text, Nullable: true},
		},
		Indices: []*migrator.Index{
			{Cols: []string{"namespace", "name"}, Type: migrator.UniqueIndex},
		},
	})

	// TODO -- document how the seemingly arbitrary column lengths were chosen
	// The answer for now is that they come from the legacy secrets service, but it would be good to know that they will still work in the new service
	tables = append(tables, migrator.Table{
		Name: TableNameDataKey,
		Columns: []*migrator.Column{
			{Name: "uid", Type: migrator.DB_NVarchar, Length: 100, IsPrimaryKey: true},
			{Name: "namespace", Type: migrator.DB_NVarchar, Length: 253, Nullable: false}, // in this table, it isn't used by k8s, but we will track it for added security
			{Name: "label", Type: migrator.DB_NVarchar, Length: 100, IsPrimaryKey: false},
			{Name: "active", Type: migrator.DB_Bool},
			{Name: "scope", Type: migrator.DB_NVarchar, Length: 30, Nullable: false},
			{Name: "provider", Type: migrator.DB_NVarchar, Length: 50, Nullable: false},
			{Name: "encrypted_data", Type: migrator.DB_Blob, Nullable: false},
			{Name: "created", Type: migrator.DB_DateTime, Nullable: false},
			{Name: "updated", Type: migrator.DB_DateTime, Nullable: false},
		},
		Indices: []*migrator.Index{},
	})

	tables = append(tables, migrator.Table{
		Name: TableNameEncryptedValue,
		Columns: []*migrator.Column{
			{Name: "uid", Type: migrator.DB_NVarchar, Length: 36, IsPrimaryKey: true}, // Fixed size of a UUID.
			{Name: "encrypted_data", Type: migrator.DB_Blob, Nullable: false},
			{Name: "created", Type: migrator.DB_BigInt, Nullable: false},
			{Name: "updated", Type: migrator.DB_BigInt, Nullable: false},
		},
		Indices: []*migrator.Index{},
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
