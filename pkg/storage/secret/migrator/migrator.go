package migrator

import (
	"fmt"

	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/registry"
	"github.com/grafana/grafana/pkg/registry/apis/secret/contracts"
	"github.com/grafana/grafana/pkg/services/sqlstore/migrator"
	"github.com/grafana/grafana/pkg/util/xorm"
)

const (
	TableNameSecureValue       = "secret_secure_value"
	TableNameSecureValueOutbox = "secret_secure_value_outbox"
	TableNameKeeper            = "secret_keeper"
	TableNameDataKey           = "secret_data_key"
	TableNameEncryptedValue    = "secret_encrypted_value"
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

func (db *SecretDB) RunMigrations() error {
	mg := migrator.NewScopedMigrator(db.engine, nil, "secret")

	db.AddMigration(mg)

	return mg.Start(true, 0)
}

func (*SecretDB) AddMigration(mg *migrator.Migrator) {
	mg.AddCreateMigration()

	mg.AddMigration("Initialize secrets tables", &migrator.RawSQLMigration{})

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

			// Kubernetes Status
			{Name: "status_phase", Type: migrator.DB_Text, Nullable: false},
			{Name: "status_message", Type: migrator.DB_Text, Nullable: true},

			// Spec
			{Name: "description", Type: migrator.DB_NVarchar, Length: 253, Nullable: false}, // Chosen arbitrarily, but should be enough.
			{Name: "keeper", Type: migrator.DB_NVarchar, Length: 253, Nullable: true},       // Keeper name, if not set, use default keeper.
			{Name: "decrypters", Type: migrator.DB_Text, Nullable: true},
			{Name: "ref", Type: migrator.DB_NVarchar, Length: 1024, Nullable: true}, // Reference to third-party storage secret path.Chosen arbitrarily, but should be enough.
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
			{Name: "description", Type: migrator.DB_NVarchar, Length: 253, Nullable: false}, // Chosen arbitrarily, but should be enough.
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
			{Name: "namespace", Type: migrator.DB_NVarchar, Length: 253, Nullable: false}, // Limit enforced by K8s.
			{Name: "label", Type: migrator.DB_NVarchar, Length: 100, IsPrimaryKey: false},
			{Name: "active", Type: migrator.DB_Bool, Nullable: false},
			{Name: "provider", Type: migrator.DB_NVarchar, Length: 50, Nullable: false},
			{Name: "encrypted_data", Type: migrator.DB_Blob, Nullable: false},
			{Name: "created", Type: migrator.DB_DateTime, Nullable: false},
			{Name: "updated", Type: migrator.DB_DateTime, Nullable: false},
		},
		Indices: []*migrator.Index{}, // TODO: add indexes based on the queries we make.
	})

	tables = append(tables, migrator.Table{
		Name: TableNameEncryptedValue,
		Columns: []*migrator.Column{
			{Name: "namespace", Type: migrator.DB_NVarchar, Length: 253, Nullable: false}, // Limit enforced by K8s.
			{Name: "uid", Type: migrator.DB_NVarchar, Length: 36, IsPrimaryKey: true},     // Fixed size of a UUID.
			{Name: "encrypted_data", Type: migrator.DB_Blob, Nullable: false},
			{Name: "created", Type: migrator.DB_BigInt, Nullable: false},
			{Name: "updated", Type: migrator.DB_BigInt, Nullable: false},
		},
		Indices: []*migrator.Index{}, // TODO: add indexes based on the queries we make.
	})

	tables = append(tables, migrator.Table{
		Name: TableNameSecureValueOutbox,
		Columns: []*migrator.Column{
			{Name: "uid", Type: migrator.DB_NVarchar, Length: 36, IsPrimaryKey: true}, // Fixed size of a UUID.
			{Name: "message_type", Type: migrator.DB_NVarchar, Length: 16, Nullable: false},
			{Name: "name", Type: migrator.DB_NVarchar, Length: 253, Nullable: false},      // Limit enforced by K8s.
			{Name: "namespace", Type: migrator.DB_NVarchar, Length: 253, Nullable: false}, // Limit enforced by K8s.
			{Name: "encrypted_secret", Type: migrator.DB_Blob, Nullable: true},
			{Name: "keeper_name", Type: migrator.DB_NVarchar, Length: 253, Nullable: true}, // Keeper name, if not set, use default keeper.
			{Name: "external_id", Type: migrator.DB_NVarchar, Length: 36, Nullable: true},  // Fixed size of a UUID.
			{Name: "created", Type: migrator.DB_BigInt, Nullable: false},
		},
		Indices: []*migrator.Index{
			// There's only one operation per secret in the queue at all times,
			// meaning the namespace + name combination should be unique
			{Cols: []string{"namespace", "name"}, Type: migrator.UniqueIndex},
			// Used for sorting
			{Cols: []string{"created"}, Type: migrator.IndexType},
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
}
