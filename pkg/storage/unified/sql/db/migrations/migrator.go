package migrations

import (
	"context"

	"xorm.io/xorm"

	"github.com/grafana/grafana/pkg/services/sqlstore/migrator"
	"github.com/grafana/grafana/pkg/setting"
)

func MigrateResourceStore(_ context.Context, engine *xorm.Engine, cfg *setting.Cfg) error {
	// TODO: use the context.Context

	mg := migrator.NewScopedMigrator(engine, cfg, "resource")
	mg.AddCreateMigration()

	initResourceTables(mg)
	initSecureFieldTables(mg)

	// since it's a new feature enable migration locking by default
	return mg.Start(true, 0)
}
