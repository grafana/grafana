package secret

import (
	"context"
	"fmt"

	"xorm.io/xorm"

	"github.com/grafana/grafana/pkg/services/sqlstore/migrator"
	"github.com/grafana/grafana/pkg/setting"
)

func migrateSecretSQL(_ context.Context, engine *xorm.Engine, cfg *setting.Cfg) error {
	mg := migrator.NewScopedMigrator(engine, cfg, "secure")
	mg.AddCreateMigration()

	initSecretStore(mg)

	// since it's a new feature enable migration locking by default
	return mg.Start(true, 0)
}

func initSecretStore(mg *migrator.Migrator) string {
	marker := "Initialize secure values tables"
	mg.AddMigration(marker, &migrator.RawSQLMigration{})

	tables := []migrator.Table{}
	tables = append(tables, migrator.Table{
		Name: "secure_value",
		Columns: []*migrator.Column{
			{Name: "uid", Type: migrator.DB_NVarchar, Length: 36, IsPrimaryKey: true},
			{Name: "namespace", Type: migrator.DB_NVarchar, Length: 36, Nullable: false},
			{Name: "name", Type: migrator.DB_NVarchar, Length: 128, Nullable: false},
			{Name: "title", Type: migrator.DB_NVarchar, Length: 128, Nullable: false},
			{Name: "manager", Type: migrator.DB_NVarchar, Length: 128, Nullable: false},
			{Name: "path", Type: migrator.DB_NVarchar, Length: 256, Nullable: false},

			{Name: "encrypted_provider", Type: migrator.DB_NVarchar, Length: 36, Nullable: false},
			{Name: "encrypted_kid", Type: migrator.DB_NVarchar, Length: 36, Nullable: false},
			{Name: "encrypted_salt", Type: migrator.DB_NVarchar, Length: 36, Nullable: false},
			{Name: "encrypted_value", Type: migrator.DB_NVarchar, Length: 256, Nullable: false},
			{Name: "encrypted_time", Type: migrator.DB_BigInt, Nullable: false}, // may change with rotation

			// Who made this when
			{Name: "created", Type: migrator.DB_BigInt, Nullable: false},
			{Name: "created_by", Type: migrator.DB_NVarchar, Length: 128, Nullable: false},
			{Name: "updated", Type: migrator.DB_BigInt, Nullable: false}, // Used as RV
			{Name: "updated_by", Type: migrator.DB_NVarchar, Length: 128, Nullable: false},

			// JSON map[string]string
			{Name: "annotations", Type: migrator.DB_Text, Nullable: true},
			// JSON map[string]string
			{Name: "labels", Type: migrator.DB_Text, Nullable: true},
			// JSON []string
			{Name: "apis", Type: migrator.DB_Text, Nullable: true},
		},
		Indices: []*migrator.Index{
			{Cols: []string{"namespace", "name"}, Type: migrator.UniqueIndex},
			{Cols: []string{"manager", "encrypted_kid"}, Type: migrator.IndexType}, // Used to find retired keys
		},
	})

	tables = append(tables, migrator.Table{
		Name: "secure_value_history",
		Columns: []*migrator.Column{
			{Name: "namespace", Type: migrator.DB_NVarchar, Length: 36, Nullable: false},
			{Name: "name", Type: migrator.DB_NVarchar, Length: 128, Nullable: false},
			{Name: "ts", Type: migrator.DB_BigInt, Nullable: false},
			{Name: "action", Type: migrator.DB_NVarchar, Length: 36, Nullable: false},    // CREATE, UPDATE, DELETE
			{Name: "identity", Type: migrator.DB_NVarchar, Length: 128, Nullable: false}, // WHO
			{Name: "details", Type: migrator.DB_Text, Nullable: false},                   // description
		},
		Indices: []*migrator.Index{
			{Cols: []string{"namespace", "name"}, Type: migrator.IndexType},
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
