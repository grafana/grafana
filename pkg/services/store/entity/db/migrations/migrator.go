package migrations

import (
	"context"
	"fmt"

	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/sqlstore/migrator"
	"github.com/grafana/grafana/pkg/services/sqlstore/session"
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

	marker := initEntityTables(mg)

	// While this feature is under development, we can completly wipe and recreate
	// The initial plan is to keep the source of truth in existing SQL tables, and mirrot it
	// to a kubernetes model.  Once the kubernetes model needs to be preserved,
	// this code should be removed
	exists, err := engine.IsTableExist("entity_migration_log")
	if err != nil {
		return err
	}
	if exists {
		log, err := mg.GetMigrationLog()
		if err != nil {
			return err
		}
		_, found := log[marker]
		if !found && len(log) > 0 {
			// Remove the migration log (and potential other orphan tables)
			tables := []string{"entity_migration_log"}

			ctx := context.Background()
			sess, err := db.GetSession()
			if err != nil {
				return err
			}

			err = sess.WithTransaction(ctx, func(tx *session.SessionTx) error {
				for _, t := range tables {
					_, err := tx.Exec(ctx, fmt.Sprintf("DROP TABLE IF EXISTS %s", t))
					if err != nil {
						return err
					}
				}
				return nil
			})
			if err != nil {
				return err
			}

			// remove old entries from in-memory log
			for id := range log {
				mg.RemoveMigrationLogs(id)
			}
		}
	}

	return mg.Start(
		features.IsEnabledGlobally(featuremgmt.FlagMigrationLocking),
		0)
}
