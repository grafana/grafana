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
	TableNameKeeper = "secret_keeper"
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

	// Initialize all tables
	for t := range tables {
		mg.AddMigration("drop table "+tables[t].Name, migrator.NewDropTableMigration(tables[t].Name))
		mg.AddMigration("create table "+tables[t].Name, migrator.NewAddTableMigration(tables[t]))
		for i := range tables[t].Indices {
			mg.AddMigration(fmt.Sprintf("create table %s, index: %d", tables[t].Name, i), migrator.NewAddIndexMigration(tables[t], tables[t].Indices[i]))
		}
	}
}
