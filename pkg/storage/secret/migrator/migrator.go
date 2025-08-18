package migrator

import (
	"context"
	"fmt"

	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/registry"
	"github.com/grafana/grafana/pkg/registry/apis/secret/contracts"
	"github.com/grafana/grafana/pkg/services/sqlstore/migrator"
	"github.com/grafana/grafana/pkg/util/xorm"
)

const (
	TableNameKeeper         = "secret_keeper"
	TableNameSecureValue    = "secret_secure_value"
	TableNameDataKey        = "secret_data_key"
	TableNameEncryptedValue = "secret_encrypted_value"
)

type SecretDB struct {
	engine *xorm.Engine
}

func New() registry.DatabaseMigrator {
	return &SecretDB{}
}

func NewWithEngine(db db.DB) contracts.SecretDBMigrator {
	return &SecretDB{engine: db.GetEngine()}
}

func (db *SecretDB) RunMigrations(ctx context.Context, lockDatabase bool) error {
	mg := migrator.NewScopedMigrator(db.engine, nil, "secret")

	db.AddMigration(mg)

	return mg.RunMigrations(ctx, lockDatabase, 0)
}

func (*SecretDB) AddMigration(mg *migrator.Migrator) {
	mg.AddCreateMigration()

	mg.AddMigration("Initialize secrets tables", &migrator.RawSQLMigration{})

	tables := []migrator.Table{}

	secureValueTable := migrator.Table{
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

			// Kubernetes Status
			{Name: "external_id", Type: migrator.DB_Text, Nullable: false},
			{Name: "active", Type: migrator.DB_Bool, Nullable: false},
			{Name: "version", Type: migrator.DB_BigInt, Nullable: false},

			// Spec
			{Name: "description", Type: migrator.DB_NVarchar, Length: 253, Nullable: false}, // Chosen arbitrarily, but should be enough.
			{Name: "keeper", Type: migrator.DB_NVarchar, Length: 253, Nullable: true},       // Keeper name, if not set, use default keeper.
			{Name: "decrypters", Type: migrator.DB_Text, Nullable: true},
			{Name: "ref", Type: migrator.DB_NVarchar, Length: 1024, Nullable: true}, // Reference to third-party storage secret path.Chosen arbitrarily, but should be enough.
		},
		Indices: []*migrator.Index{
			{Cols: []string{"namespace", "name", "version", "active"}, Type: migrator.UniqueIndex},
			{Cols: []string{"namespace", "name", "version"}, Type: migrator.UniqueIndex},
		},
	}
	tables = append(tables, secureValueTable)

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
			{Name: "description", Type: migrator.DB_NVarchar, Length: 253, Nullable: false}, // Chosen arbitrarily, but should be enough.
			{Name: "type", Type: migrator.DB_Text, Nullable: false},
			// Each keeper has a different payload so we store the whole thing as a blob.
			{Name: "payload", Type: migrator.DB_Text, Nullable: true},
		},
		Indices: []*migrator.Index{
			{Cols: []string{"namespace", "name"}, Type: migrator.UniqueIndex},
		},
	})

	dataKeyTable := migrator.Table{
		Name: TableNameDataKey,
		Columns: []*migrator.Column{
			{Name: "uid", Type: migrator.DB_NVarchar, Length: 100, IsPrimaryKey: true},    // Arbitrarily chosen.
			{Name: "namespace", Type: migrator.DB_NVarchar, Length: 253, Nullable: false}, // Limit enforced by K8s.
			{Name: "label", Type: migrator.DB_NVarchar, Length: 100, IsPrimaryKey: false}, // Arbitrarily chosen.
			{Name: "active", Type: migrator.DB_Bool, Nullable: false},
			{Name: "provider", Type: migrator.DB_NVarchar, Length: 50, Nullable: false}, // Arbitrarily chosen.
			{Name: "encrypted_data", Type: migrator.DB_Blob, Nullable: false},
			{Name: "created", Type: migrator.DB_DateTime, Nullable: false},
			{Name: "updated", Type: migrator.DB_DateTime, Nullable: false},
		},
		Indices: []*migrator.Index{},
	}
	tables = append(tables, dataKeyTable)

	encryptedValueTable := migrator.Table{
		Name: TableNameEncryptedValue,
		Columns: []*migrator.Column{
			{Name: "namespace", Type: migrator.DB_NVarchar, Length: 253, Nullable: false}, // Limit enforced by K8s.
			{Name: "name", Type: migrator.DB_NVarchar, Length: 253, Nullable: false},
			{Name: "version", Type: migrator.DB_BigInt, Nullable: false},
			{Name: "encrypted_data", Type: migrator.DB_Blob, Nullable: false},
			{Name: "created", Type: migrator.DB_BigInt, Nullable: false},
			{Name: "updated", Type: migrator.DB_BigInt, Nullable: false},
		},
		Indices: []*migrator.Index{
			{Cols: []string{"namespace", "name", "version"}, Type: migrator.UniqueIndex},
		},
	}
	tables = append(tables, encryptedValueTable)

	// Initialize all tables
	for t := range tables {
		mg.AddMigration("drop table "+tables[t].Name, migrator.NewDropTableMigration(tables[t].Name))
		mg.AddMigration("create table "+tables[t].Name, migrator.NewAddTableMigration(tables[t]))
		for i := range tables[t].Indices {
			mg.AddMigration(fmt.Sprintf("create table %s, index: %d", tables[t].Name, i), migrator.NewAddIndexMigration(tables[t], tables[t].Indices[i]))
		}
	}

	mg.AddMigration("create index for list on "+TableNameSecureValue, migrator.NewAddIndexMigration(secureValueTable, &migrator.Index{
		Cols: []string{"namespace", "active", "updated"},
		Type: migrator.IndexType,
	}))

	mg.AddMigration("create index for list and read current on "+TableNameDataKey, migrator.NewAddIndexMigration(dataKeyTable, &migrator.Index{
		Cols: []string{"namespace", "label", "active"},
		Type: migrator.IndexType,
	}))

	// Owner Reference columns
	mg.AddMigration("add owner_reference_api_group column to "+TableNameSecureValue, migrator.NewAddColumnMigration(secureValueTable, &migrator.Column{
		Name:     "owner_reference_api_group",
		Type:     migrator.DB_NVarchar,
		Length:   253, // Limit enforced by K8s.
		Nullable: true,
	}))

	mg.AddMigration("add owner_reference_api_version column to "+TableNameSecureValue, migrator.NewAddColumnMigration(secureValueTable, &migrator.Column{
		Name:     "owner_reference_api_version",
		Type:     migrator.DB_NVarchar,
		Length:   253, // Limit enforced by K8s.
		Nullable: true,
	}))

	mg.AddMigration("add owner_reference_kind column to "+TableNameSecureValue, migrator.NewAddColumnMigration(secureValueTable, &migrator.Column{
		Name:     "owner_reference_kind",
		Type:     migrator.DB_NVarchar,
		Length:   253, // Limit enforced by K8s.
		Nullable: true,
	}))

	mg.AddMigration("add owner_reference_name column to "+TableNameSecureValue, migrator.NewAddColumnMigration(secureValueTable, &migrator.Column{
		Name:     "owner_reference_name",
		Type:     migrator.DB_NVarchar,
		Length:   253, // Limit enforced by K8s.
		Nullable: true,
	}))
}
