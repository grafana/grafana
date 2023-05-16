package migrations

import (
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/services/sqlstore/migrator"
	"github.com/grafana/grafana/pkg/setting"
)

func CheckEntityStoreMigrations(
	sql *sqlstore.SQLStore, // also db.DB
	features featuremgmt.FeatureToggles) error {

	// Skip if feature flag is not enabled
	if !features.IsEnabled(featuremgmt.FlagEntityStore) {
		return nil
	}

	// !!! This should not run in production!
	// The object store SQL schema is still in active development and this
	// will only be called when the feature toggle is enabled
	// this check should not be necessary, but is added as an extra check
	if setting.Env == setting.Prod {
		return nil
	}

	migrator := migrator.NewMigrator("entity", sql.GetEngine(), sql.Cfg)
	initEntityTables(migrator)

	return migrator.Start(
		features.IsEnabled(featuremgmt.FlagMigrationLocking),
		sql.GetMigrationLockAttemptTimeout())
}
