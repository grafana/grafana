package migrations

import (
	"xorm.io/xorm"

	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/sqlstore/migrator"
	"github.com/grafana/grafana/pkg/setting"
)

func MigrateEntityStore(engine *xorm.Engine, cfg *setting.Cfg, features featuremgmt.FeatureToggles) error {
	// Skip if feature flag is not enabled
	if !features.IsEnabledGlobally(featuremgmt.FlagUnifiedStorage) {
		return nil
	}

	mg := migrator.NewScopedMigrator(engine, cfg, "entity")
	mg.AddCreateMigration()

	initEntityTables(mg)

	// since it's a new feature enable migration locking by default
	return mg.Start(true, 0)
}
