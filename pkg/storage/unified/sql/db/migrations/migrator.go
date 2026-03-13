package migrations

import (
	"context"

	"github.com/grafana/grafana/pkg/setting"
	storagemigrator "github.com/grafana/grafana/pkg/storage/sqlutil/migrator"
)

func MigrateResourceStore(ctx context.Context, handle storagemigrator.Handle, cfg *setting.Cfg) error {
	mg := storagemigrator.NewScopedMigrator(handle, "resource")
	mg.AddCreateMigration()

	initResourceTables(mg)

	sec := cfg.Raw.Section("database")
	return mg.RunMigrations(
		ctx,
		sec.Key("migration_locking").MustBool(true),
		sec.Key("locking_attempt_timeout_sec").MustInt(),
	)
}
