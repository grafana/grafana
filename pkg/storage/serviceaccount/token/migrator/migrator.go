package migrator

import (
	"context"
	"fmt"

	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/registry"
	"github.com/grafana/grafana/pkg/services/sqlstore/migrator"
	"github.com/grafana/grafana/pkg/storage/serviceaccount/token/contracts"
	"github.com/grafana/grafana/pkg/util/xorm"
)

const TableNameToken = "serviceaccount_token"

type TokenDB struct {
	engine *xorm.Engine
}

func New() registry.DatabaseMigrator {
	return &TokenDB{}
}

func NewWithEngine(db db.DB) contracts.TokenDBMigrator {
	return &TokenDB{engine: db.GetEngine()}
}

func (db *TokenDB) RunMigrations(ctx context.Context, lockDatabase bool) error {
	mg := migrator.NewScopedMigrator(db.engine, nil, "serviceaccount_token")
	db.AddMigration(mg)
	return mg.RunMigrations(ctx, lockDatabase, 0)
}

func (*TokenDB) AddMigration(mg *migrator.Migrator) {
	mg.AddCreateMigration()
	mg.AddMigration("Initialize service account token table", &migrator.RawSQLMigration{})

	table := migrator.Table{
		Name: TableNameToken,
		Columns: []*migrator.Column{
			{Name: "id", Type: migrator.DB_NVarchar, Length: 36, IsPrimaryKey: true},
			{Name: "namespace", Type: migrator.DB_NVarchar, Length: 253, Nullable: false},
			{Name: "name", Type: migrator.DB_NVarchar, Length: 190, Nullable: false},
			{Name: "key", Type: migrator.DB_Varchar, Length: 190, Nullable: false},
			{Name: "created", Type: migrator.DB_DateTime, Nullable: false},
			{Name: "updated", Type: migrator.DB_DateTime, Nullable: false},
			{Name: "last_used_at", Type: migrator.DB_DateTime, Nullable: true},
			{Name: "service_account_name", Type: migrator.DB_NVarchar, Length: 253, Nullable: false},
			{Name: "is_revoked", Type: migrator.DB_Bool, Nullable: true, Default: "0"},
			{Name: "expires", Type: migrator.DB_BigInt, Nullable: true},
		},
		Indices: []*migrator.Index{
			{Cols: []string{"key"}, Type: migrator.UniqueIndex},
			{Cols: []string{"namespace", "service_account_name", "name"}, Type: migrator.UniqueIndex},
			{Cols: []string{"namespace", "service_account_name"}, Type: migrator.IndexType},
		},
	}

	mg.AddMigration("drop table "+TableNameToken, migrator.NewDropTableMigration(TableNameToken))
	mg.AddMigration("create table "+TableNameToken, migrator.NewAddTableMigration(table))
	for i, index := range table.Indices {
		mg.AddMigration(fmt.Sprintf("create table %s, index: %d", TableNameToken, i), migrator.NewAddIndexMigration(table, index))
	}
}
