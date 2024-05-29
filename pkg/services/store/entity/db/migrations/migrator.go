package migrations

import (
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/sqlstore/migrator"
	"github.com/grafana/grafana/pkg/services/store/entity/db"
)

func MigrateEntityStore(db db.EntityDBInterface, features featuremgmt.FeatureToggles) error {
	// Skip if feature flag is not enabled
	if !features.IsEnabledGlobally(featuremgmt.FlagUnifiedStorage) {
		return nil
	}

	engine, err := db.GetEngine()
	if err != nil {
		return err
	}

	mg := migrator.NewScopedMigrator(engine, db.GetCfg(), "entity")
	mg.AddCreateMigration()

	initEntityTables(mg)

	// since it's a new feature enable migration locking by default
	return mg.Start(true, 0)
}
