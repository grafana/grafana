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

	// Only in development for now!!!  When we are ready, we can drop entity and use this
	if cfg.Env == setting.Dev {
		m2 := migrator.NewScopedMigrator(engine, cfg, "resource")
		m2.AddCreateMigration()
		initResourceTables(m2)
		err := m2.Start(true, 0)
		if err != nil {
			return err
		}
	}

	// since it's a new feature enable migration locking by default
	return mg.Start(true, 0)
}
