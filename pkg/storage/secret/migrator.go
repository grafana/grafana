package secret

import (
	"fmt"

	"xorm.io/xorm"

	"github.com/grafana/grafana/pkg/services/sqlstore/migrator"
	"github.com/grafana/grafana/pkg/setting"
)

const (
	TableNameSecureValue = "secret_secure_value"
)

func migrateSecretSQL(engine *xorm.Engine, cfg *setting.Cfg) error {
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
			{Name: "external_id", Type: migrator.DB_Text, Nullable: false},
		},
		Indices: []*migrator.Index{
			{Cols: []string{"namespace", "name"}, Type: migrator.UniqueIndex},
		},
	})

	tables = append(tables, migrator.Table{
		Name: "secret_keeper",
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
