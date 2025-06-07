package migrations

import (
	dashboardFolderMigrations "github.com/grafana/grafana/pkg/services/dashboards/database/migrations"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/sqlstore/migrations/accesscontrol"
	"github.com/grafana/grafana/pkg/services/sqlstore/migrations/anonservice"
	"github.com/grafana/grafana/pkg/services/sqlstore/migrations/externalsession"
	"github.com/grafana/grafana/pkg/services/sqlstore/migrations/signingkeys"
	"github.com/grafana/grafana/pkg/services/sqlstore/migrations/ssosettings"
	"github.com/grafana/grafana/pkg/services/sqlstore/migrations/ualert"
	. "github.com/grafana/grafana/pkg/services/sqlstore/migrator"
)

// --- Migration Guide line ---
// 1. Never change a migration that is committed and pushed to main
// 2. Always add new migrations (to change or undo previous migrations)
// 3. Some migrations are not yet written (rename column, table, drop table, index etc)
// 4. Putting migrations behind feature flags is no longer recommended as broken
//    migrations may not be caught by integration tests unless feature flags are
//    specifically added

type OSSMigrations struct {
	features featuremgmt.FeatureToggles
}

func ProvideOSSMigrations(features featuremgmt.FeatureToggles) *OSSMigrations {
	return &OSSMigrations{features}
}

func (oss *OSSMigrations) AddMigration(mg *Migrator) {
	mg.AddCreateMigration()
	addUserMigrations(mg)
	addTempUserMigrations(mg)
	addStarMigrations(mg)
	addOrgMigrations(mg)
	addDashboardMigration(mg) // Do NOT add more migrations to this function.
	addDashboardUIDStarMigrations(mg)
	addDataSourceMigration(mg)
	addApiKeyMigrations(mg)
	addDashboardSnapshotMigrations(mg)
	addQuotaMigration(mg)
	addAppSettingsMigration(mg)
	addSessionMigration(mg)
	addPlaylistMigrations(mg)
	addPreferencesMigrations(mg)
	addAlertMigrations(mg)
	addAnnotationMig(mg)
	addTestDataMigrations(mg)
	addDashboardVersionMigration(mg)
	addTeamMigrations(mg)
	addDashboardACLMigrations(mg) // Do NOT add more migrations to this function.
	addTagMigration(mg)
	addLoginAttemptMigrations(mg)
	addUserAuthMigrations(mg)
	addServerlockMigrations(mg)
	addUserAuthTokenMigrations(mg)
	addCacheMigration(mg)
	addShortURLMigrations(mg)
	ualert.AddTablesMigrations(mg)
	addLibraryElementsMigrations(mg)

	ualert.FixEarlyMigration(mg)
	addSecretsMigration(mg)
	addKVStoreMigrations(mg)
	ualert.AddDashboardUIDPanelIDMigration(mg)
	accesscontrol.AddMigration(mg)
	addQueryHistoryMigrations(mg)

	accesscontrol.AddDisabledMigrator(mg)
	accesscontrol.AddTeamMembershipMigrations(mg)
	accesscontrol.AddDashboardPermissionsMigrator(mg)
	accesscontrol.AddAlertingPermissionsMigrator(mg)

	addQueryHistoryStarMigrations(mg)

	addCorrelationsMigrations(mg)

	addEntityEventsTableMigration(mg)

	addPublicDashboardMigration(mg)
	addDbFileStorageMigration(mg)

	accesscontrol.AddManagedPermissionsMigration(mg, accesscontrol.ManagedPermissionsMigrationID)
	accesscontrol.AddManagedFolderAlertActionsMigration(mg)
	accesscontrol.AddActionNameMigrator(mg)
	addPlaylistUIDMigration(mg)

	ualert.UpdateRuleGroupIndexMigration(mg)
	accesscontrol.AddManagedFolderAlertActionsRepeatMigration(mg)
	accesscontrol.AddAdminOnlyMigration(mg)
	accesscontrol.AddSeedAssignmentMigrations(mg)
	accesscontrol.AddManagedFolderAlertActionsRepeatFixedMigration(mg)
	accesscontrol.AddManagedFolderLibraryPanelActionsMigration(mg)

	AddExternalAlertmanagerToDatasourceMigration(mg)

	addFolderMigrations(mg)

	anonservice.AddMigration(mg)
	signingkeys.AddMigration(mg)

	ualert.MigrationServiceMigration(mg)
	ualert.CreatedFoldersMigration(mg)

	dashboardFolderMigrations.AddDashboardFolderMigrations(mg)

	ssosettings.AddMigration(mg)

	ualert.CreateOrgMigratedKVStoreEntries(mg)

	// https://github.com/grafana/identity-access-team/issues/546: tracks removal of the feature toggle from the annotation permission migration
	if oss.features != nil && oss.features.IsEnabledGlobally(featuremgmt.FlagAnnotationPermissionUpdate) {
		accesscontrol.AddManagedDashboardAnnotationActionsMigration(mg)
	}

	addCloudMigrationsMigrations(mg)

	addKVStoreMySQLValueTypeLongTextMigration(mg)

	ualert.AddRuleNotificationSettingsColumns(mg)

	accesscontrol.AddAlertingScopeRemovalMigration(mg)

	accesscontrol.AddManagedFolderAlertingSilencesActionsMigrator(mg)

	ualert.AddRecordingRuleColumns(mg)

	ualert.AddStateResolvedAtColumns(mg)

	ualert.AddReceiverActionScopesMigration(mg)

	ualert.AddRuleMetadata(mg)

	accesscontrol.AddOrphanedMigrations(mg)

	accesscontrol.AddActionSetPermissionsMigrator(mg)

	externalsession.AddMigration(mg)

	accesscontrol.AddReceiverCreateScopeMigration(mg)

	ualert.AddAlertRuleUpdatedByMigration(mg)

	ualert.AddAlertRuleStateTable(mg)

	ualert.AddAlertRuleGuidMigration(mg)

	ualert.AddAlertRuleKeepFiringFor(mg)

	ualert.AddAlertRuleMissingSeriesEvalsToResolve(mg)

	accesscontrol.AddDatasourceDrilldownRemovalMigration(mg)

	ualert.DropTitleUniqueIndexMigration(mg)

	ualert.AddStateFiredAtColumn(mg)
}
