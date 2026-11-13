package ualert

import (
	"testing"
	"time"

	"github.com/stretchr/testify/require"
	"gopkg.in/ini.v1"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/sqlstore/migrator"
	"github.com/grafana/grafana/pkg/services/sqlstore/sqlutil"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/util/xorm"
)

// setupGuidMigrationTestDB creates a fresh test database and runs only the base table
// migrations (not the GUID migration itself), so that tests can seed rows representing
// pre-existing/corrupted data before exercising AddAlertRuleGuidMigration.
func setupGuidMigrationTestDB(t *testing.T) *xorm.Engine {
	t.Helper()
	dbType := sqlutil.GetTestDBType()
	testDB, err := sqlutil.GetTestDB(dbType)
	require.NoError(t, err)
	t.Cleanup(testDB.Cleanup)

	x, err := xorm.NewEngine(testDB.DriverName, testDB.ConnStr)
	require.NoError(t, err)
	t.Cleanup(func() {
		if err := x.Close(); err != nil {
			t.Logf("failed to close xorm engine: %v", err)
		}
	})

	err = migrator.NewDialect(x.DriverName()).CleanDB(x)
	require.NoError(t, err)

	mg := migrator.NewMigrator(x, &setting.Cfg{
		Logger: log.New("alertguidmigration.test"),
		Raw:    ini.Empty(),
	})
	mg.AddCreateMigration()
	AddTablesMigrations(mg)
	err = mg.Start(false, 0)
	require.NoError(t, err)

	return x
}

func runGuidMigration(t *testing.T, x *xorm.Engine) error {
	t.Helper()
	mg := migrator.NewMigrator(x, &setting.Cfg{
		Logger: log.New("alertguidmigration.test"),
		Raw:    ini.Empty(),
		UnifiedAlerting: setting.UnifiedAlertingSettings{
			RuleVersionRecordLimit: 100,
		},
	})
	AddAlertRuleGuidMigration(mg)
	return mg.Start(false, 0)
}

func newTestAlertRule(uid string, orgID int64) *alertRule {
	now := time.Now().UTC()
	return &alertRule{
		OrgID:           orgID,
		Title:           "rule-" + uid,
		Condition:       "A",
		Data:            []alertQuery{},
		IntervalSeconds: 60,
		Version:         1,
		UID:             uid,
		NamespaceUID:    "ns",
		RuleGroup:       "group",
		RuleGroupIndex:  1,
		NoDataState:     "NoData",
		ExecErrState:    "Alerting",
		For:             duration(0),
		Updated:         now,
		Annotations:     map[string]string{},
		Labels:          map[string]string{},
		IsPaused:        false,
	}
}

// newOrphanedAlertRuleVersion builds an alert_rule_version row that does not correspond to
// any alert_rule row (simulating a historical version left behind after its rule was
// deleted, or a row created by a prior buggy migration/code path). Its rule_guid is left as
// the zero value, which xorm/the column default will persist as an empty string, exactly
// matching the real-world data reported in grafana/grafana#103076.
func newOrphanedAlertRuleVersion(ruleUID string, orgID, version int64) *alertRuleVersion {
	return &alertRuleVersion{
		RuleOrgID:        orgID,
		RuleUID:          ruleUID,
		RuleNamespaceUID: "ns",
		RuleGroup:        "group",
		RuleGroupIndex:   1,
		ParentVersion:    0,
		RestoredFrom:     0,
		Version:          version,
		Created:          time.Now().UTC(),
		Title:            "deleted-rule",
		Condition:        "A",
		Data:             []alertQuery{},
		IntervalSeconds:  60,
		NoDataState:      "NoData",
		ExecErrState:     "Alerting",
		For:              duration(0),
		Annotations:      map[string]string{},
		Labels:           map[string]string{},
		IsPaused:         false,
	}
}

func TestAlertRuleGuidMigration_DeduplicatesEmptyRuleGuids(t *testing.T) {
	x := setupGuidMigrationTestDB(t)

	// A rule that still exists: its alert_rule_version row should get a real, matching GUID.
	activeRule := newTestAlertRule("active-uid", 1)
	_, err := x.Table("alert_rule").Insert(activeRule)
	require.NoError(t, err)
	activeVersion := activeRule.makeVersion()
	_, err = x.Table("alert_rule_version").Insert(activeVersion)
	require.NoError(t, err)

	// Several orphaned alert_rule_version rows (no matching alert_rule) that all share the
	// same version number. Before the fix, the join-based UPDATE in setRuleGuidMigration
	// leaves rule_guid as the column default ('') for all of them, which collides on the
	// (rule_guid, version) unique index added later in this same migration set - this is
	// exactly the failure reported in grafana/grafana#103076.
	const orphanCount = 6
	for i := 0; i < orphanCount; i++ {
		// Each orphan simulates a distinct deleted rule, so rule_uid must be distinct per row
		// (otherwise it would collide with the pre-existing (rule_org_id, rule_uid, version)
		// unique index), while version intentionally repeats across them.
		ruleUID := "deleted-rule-uid-" + string(rune('a'+i))
		orphan := newOrphanedAlertRuleVersion(ruleUID, 1, 1)
		_, err := x.Table("alert_rule_version").Insert(orphan)
		require.NoError(t, err)
	}

	var totalBefore int64
	totalBefore, err = x.Table("alert_rule_version").Count()
	require.NoError(t, err)
	require.EqualValues(t, orphanCount+1, totalBefore)

	err = runGuidMigration(t, x)
	require.NoError(t, err, "migration must succeed even when duplicate empty rule_guid rows are present")

	// No historical rows should have been deleted.
	var totalAfter int64
	totalAfter, err = x.Table("alert_rule_version").Count()
	require.NoError(t, err)
	require.EqualValues(t, totalBefore, totalAfter, "deduplication must not delete any alert_rule_version rows")

	// No row should still have an empty rule_guid.
	emptyCount, err := x.Table("alert_rule_version").Where("rule_guid = ''").Count()
	require.NoError(t, err)
	require.Zero(t, emptyCount, "all rows must be assigned a non-empty rule_guid")

	// Every rule_guid must now be unique.
	var guids []string
	err = x.Table("alert_rule_version").Cols("rule_guid").Find(&guids)
	require.NoError(t, err)
	require.Len(t, guids, int(totalAfter))
	seen := map[string]bool{}
	for _, g := range guids {
		require.NotEmpty(t, g)
		require.False(t, seen[g], "duplicate rule_guid found: %s", g)
		seen[g] = true
	}

	// The matched row's GUID must equal the one that was propagated from alert_rule, not a
	// synthetic one from the dedup step.
	var activeRuleGuid string
	_, err = x.Table("alert_rule").Where("uid = ?", activeRule.UID).Cols("guid").Get(&activeRuleGuid)
	require.NoError(t, err)
	require.NotEmpty(t, activeRuleGuid)

	var activeVersionGuid string
	found, err := x.Table("alert_rule_version").Where("rule_uid = ?", activeRule.UID).Cols("rule_guid").Get(&activeVersionGuid)
	require.NoError(t, err)
	require.True(t, found)
	require.Equal(t, activeRuleGuid, activeVersionGuid)

	// The unique index should now actually be enforced: inserting a second row that collides
	// on (rule_guid, version) must fail.
	_, err = x.Exec(
		`INSERT INTO alert_rule_version (rule_org_id, rule_uid, rule_namespace_uid, rule_group, rule_guid, parent_version, restored_from, version, created, title, condition, data, interval_seconds, no_data_state, exec_err_state)
		 VALUES (1, 'some-other-uid', 'ns', 'group', ?, 0, 0, 1, ?, 't', 'A', '[]', 60, 'NoData', 'Alerting')`,
		activeVersionGuid, time.Now().UTC(),
	)
	require.Error(t, err, "unique index on (rule_guid, version) should reject duplicates after migration")
}

// TestAlertRuleGuidMigration_OrphanedRuleKeepsOneSharedGuidAcrossVersions guards against
// regressing to a per-row GUID assignment: rule_guid is used elsewhere (e.g. to group all
// versions of a rule, or to delete a trashed rule's versions by GUID) as the stable
// identifier for one logical rule across all of its version rows. A deleted rule that left
// behind several historical version rows (version 1, 2, 3, ...) must have all of them end up
// sharing the SAME synthetic GUID, not each getting an independent one - otherwise its
// version history would be incorrectly split into several unrelated "rules".
func TestAlertRuleGuidMigration_OrphanedRuleKeepsOneSharedGuidAcrossVersions(t *testing.T) {
	x := setupGuidMigrationTestDB(t)

	const orphanRuleUID = "deleted-rule-with-history"
	const orphanVersions = 3
	for v := int64(1); v <= orphanVersions; v++ {
		orphan := newOrphanedAlertRuleVersion(orphanRuleUID, 1, v)
		_, err := x.Table("alert_rule_version").Insert(orphan)
		require.NoError(t, err)
	}

	// A second, unrelated deleted rule, to make sure its group gets a different GUID than the
	// first one.
	const otherOrphanRuleUID = "another-deleted-rule"
	otherOrphan := newOrphanedAlertRuleVersion(otherOrphanRuleUID, 1, 1)
	_, err := x.Table("alert_rule_version").Insert(otherOrphan)
	require.NoError(t, err)

	err = runGuidMigration(t, x)
	require.NoError(t, err)

	var guidsForFirstRule []string
	err = x.Table("alert_rule_version").Where("rule_org_id = ? AND rule_uid = ?", 1, orphanRuleUID).Cols("rule_guid").Find(&guidsForFirstRule)
	require.NoError(t, err)
	require.Len(t, guidsForFirstRule, orphanVersions)
	for _, g := range guidsForFirstRule {
		require.NotEmpty(t, g)
		require.Equal(t, guidsForFirstRule[0], g, "all versions of the same orphaned rule must share one GUID")
	}

	var otherGuid string
	found, err := x.Table("alert_rule_version").Where("rule_org_id = ? AND rule_uid = ?", 1, otherOrphanRuleUID).Cols("rule_guid").Get(&otherGuid)
	require.NoError(t, err)
	require.True(t, found)
	require.NotEmpty(t, otherGuid)
	require.NotEqual(t, guidsForFirstRule[0], otherGuid, "distinct orphaned rules must get distinct GUIDs")
}

// TestAlertRuleGuidMigration_GroupsByOrgIdAndRuleUidTogether ensures the grouping key used to
// assign shared synthetic GUIDs is the full (rule_org_id, rule_uid) pair, not rule_uid alone:
// two different orgs can legitimately have rules with the same rule_uid value, and those must
// not be merged into a single synthetic GUID.
func TestAlertRuleGuidMigration_GroupsByOrgIdAndRuleUidTogether(t *testing.T) {
	x := setupGuidMigrationTestDB(t)

	const sharedRuleUID = "same-uid-different-orgs"
	orgOneOrphan := newOrphanedAlertRuleVersion(sharedRuleUID, 1, 1)
	_, err := x.Table("alert_rule_version").Insert(orgOneOrphan)
	require.NoError(t, err)

	orgTwoOrphan := newOrphanedAlertRuleVersion(sharedRuleUID, 2, 1)
	_, err = x.Table("alert_rule_version").Insert(orgTwoOrphan)
	require.NoError(t, err)

	err = runGuidMigration(t, x)
	require.NoError(t, err)

	var orgOneGuid, orgTwoGuid string
	found, err := x.Table("alert_rule_version").Where("rule_org_id = ? AND rule_uid = ?", 1, sharedRuleUID).Cols("rule_guid").Get(&orgOneGuid)
	require.NoError(t, err)
	require.True(t, found)
	found, err = x.Table("alert_rule_version").Where("rule_org_id = ? AND rule_uid = ?", 2, sharedRuleUID).Cols("rule_guid").Get(&orgTwoGuid)
	require.NoError(t, err)
	require.True(t, found)

	require.NotEmpty(t, orgOneGuid)
	require.NotEmpty(t, orgTwoGuid)
	require.NotEqual(t, orgOneGuid, orgTwoGuid, "rows with the same rule_uid but different rule_org_id must not share a synthetic GUID")
}

// TestAlertRuleGuidMigration_DedupRunsEvenIfPopulateStepAlreadySucceeded guards against the bug
// flagged in grafana/grafana#137398: each migration step is recorded in migration_log and
// skipped on any future run once it has succeeded. If the dedup logic were appended to the
// "populate rule guid in alert rule table" step's Exec (as it originally was) instead of living
// in its own step, a database that already ran that step successfully in the past - before the
// dedup fix existed - would never execute the new dedup code on a later Grafana upgrade, and
// would keep failing on the unique-index migration with the same duplicate-key error. This test
// simulates exactly that: it marks "populate rule guid in alert rule table" as already
// successfully run (without ever having deduplicated anything), then runs the full migration set
// and verifies the separate "deduplicate empty rule_guid values in alert_rule_version table"
// step still executes and fixes the data.
func TestAlertRuleGuidMigration_DedupRunsEvenIfPopulateStepAlreadySucceeded(t *testing.T) {
	x := setupGuidMigrationTestDB(t)

	// Several orphaned alert_rule_version rows sharing the same version number, exactly as in
	// TestAlertRuleGuidMigration_DeduplicatesEmptyRuleGuids.
	const orphanCount = 6
	for i := 0; i < orphanCount; i++ {
		ruleUID := "deleted-rule-uid-" + string(rune('a'+i))
		orphan := newOrphanedAlertRuleVersion(ruleUID, 1, 1)
		_, err := x.Table("alert_rule_version").Insert(orphan)
		require.NoError(t, err)
	}

	// Add the rule_guid/guid columns that "populate rule guid in alert rule table" expects to
	// already exist, since we're about to mark it as already-succeeded without actually running
	// it through the migrator (which would otherwise add these columns itself).
	_, err := x.Exec("ALTER TABLE alert_rule ADD COLUMN guid VARCHAR(36) NOT NULL DEFAULT ''")
	require.NoError(t, err)
	_, err = x.Exec("ALTER TABLE alert_rule_version ADD COLUMN rule_guid VARCHAR(36) NOT NULL DEFAULT ''")
	require.NoError(t, err)

	// Simulate a database that already ran every step up to and including "populate rule guid in
	// alert rule table" successfully in the past, before the dedup step existed, and before the
	// later unique index was added (that step hasn't run on this simulated DB, which is exactly
	// why it's still possible for duplicate empty rule_guid rows to be sitting in the table).
	alreadyRun := []string{
		"add guid column to alert_rule table",
		"add rule_guid column to alert_rule_version table",
		"cleanup alert_rule_version table",
		"populate rule guid in alert rule table",
	}
	for _, id := range alreadyRun {
		_, err = x.Table("migration_log").Insert(&migrator.MigrationLog{
			MigrationID: id,
			Success:     true,
			Timestamp:   time.Now(),
		})
		require.NoError(t, err)
	}

	err = runGuidMigration(t, x)
	require.NoError(t, err, "migration must succeed even though the populate step was already marked done without ever deduplicating")

	emptyCount, err := x.Table("alert_rule_version").Where("rule_guid = ''").Count()
	require.NoError(t, err)
	require.Zero(t, emptyCount, "dedup step must still run and fix empty rule_guid rows even when the populate step was already logged as successful")

	var guids []string
	err = x.Table("alert_rule_version").Cols("rule_guid").Find(&guids)
	require.NoError(t, err)
	require.Len(t, guids, orphanCount)
	seen := map[string]bool{}
	for _, g := range guids {
		require.NotEmpty(t, g)
		require.False(t, seen[g], "duplicate rule_guid found: %s", g)
		seen[g] = true
	}
}

func TestAlertRuleGuidMigration_NoDuplicates_IsNoOp(t *testing.T) {
	x := setupGuidMigrationTestDB(t)

	activeRule := newTestAlertRule("only-uid", 1)
	_, err := x.Table("alert_rule").Insert(activeRule)
	require.NoError(t, err)
	activeVersion := activeRule.makeVersion()
	_, err = x.Table("alert_rule_version").Insert(activeVersion)
	require.NoError(t, err)

	err = runGuidMigration(t, x)
	require.NoError(t, err)

	var guid string
	found, err := x.Table("alert_rule_version").Where("rule_uid = ?", activeRule.UID).Cols("rule_guid").Get(&guid)
	require.NoError(t, err)
	require.True(t, found)
	require.NotEmpty(t, guid)
}
