package ualert

import (
	"testing"

	"github.com/google/uuid"
	"github.com/stretchr/testify/require"
	"gopkg.in/ini.v1"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/sqlstore/migrations"
	"github.com/grafana/grafana/pkg/services/sqlstore/migrator"
	"github.com/grafana/grafana/pkg/services/sqlstore/sqlutil"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/util/xorm"
)

func setupTestDB(t *testing.T) (*xorm.Engine, *migrator.Migrator) {
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
		Logger: log.New("guid-migration.test"),
		Raw:    ini.Empty(),
	})
	ossMigrations := &migrations.OSSMigrations{}
	ossMigrations.AddMigration(mg)

	err = mg.Start(false, 0)
	require.NoError(t, err)

	return x, mg
}

func TestFixEmptyGuidMigration(t *testing.T) {
	x, mg := setupTestDB(t)

	sess := x.NewSession()
	defer sess.Close()

	// First, remove the unique index on guid so we can insert empty GUIDs
	// (the migration already created the index during setupTestDB)
	_, err := sess.Exec(`DROP INDEX IF EXISTS UQE_alert_rule_guid`)
	require.NoError(t, err)

	// Insert alert rules with empty GUIDs to simulate the bug
	_, err = sess.Exec(`INSERT INTO alert_rule (org_id, uid, title, condition, data, namespace_uid, rule_group, no_data_state, exec_err_state, "for", interval_seconds, version, updated, guid)
		VALUES (1, 'uid1', 'rule1', 'A', '[]', 'ns1', 'group1', 'NoData', 'Error', 0, 60, 1, '2026-01-01 00:00:00', '')`)
	require.NoError(t, err)

	_, err = sess.Exec(`INSERT INTO alert_rule (org_id, uid, title, condition, data, namespace_uid, rule_group, no_data_state, exec_err_state, "for", interval_seconds, version, updated, guid)
		VALUES (1, 'uid2', 'rule2', 'A', '[]', 'ns1', 'group1', 'NoData', 'Error', 0, 60, 1, '2026-01-01 00:00:00', '')`)
	require.NoError(t, err)

	// Insert alert_rule_version rows with empty rule_guid
	_, err = sess.Exec(`INSERT INTO alert_rule_version (rule_org_id, rule_uid, rule_namespace_uid, rule_group, title, condition, data, no_data_state, exec_err_state, "for", interval_seconds, version, created, rule_guid)
		VALUES (1, 'uid1', 'ns1', 'group1', 'rule1', 'A', '[]', 'NoData', 'Error', 0, 60, 1, '2026-01-01 00:00:00', '')`)
	require.NoError(t, err)

	_, err = sess.Exec(`INSERT INTO alert_rule_version (rule_org_id, rule_uid, rule_namespace_uid, rule_group, title, condition, data, no_data_state, exec_err_state, "for", interval_seconds, version, created, rule_guid)
		VALUES (1, 'uid2', 'ns1', 'group1', 'rule2', 'A', '[]', 'NoData', 'Error', 0, 60, 1, '2026-01-01 00:00:00', '')`)
	require.NoError(t, err)

	// Verify we have empty GUIDs
	var emptyCount int64
	_, err = sess.SQL("SELECT COUNT(*) FROM alert_rule WHERE guid = ''").Get(&emptyCount)
	require.NoError(t, err)
	require.Equal(t, int64(2), emptyCount, "should have 2 alert rules with empty guid")

	var emptyVersionCount int64
	_, err = sess.SQL("SELECT COUNT(*) FROM alert_rule_version WHERE rule_guid = ''").Get(&emptyVersionCount)
	require.NoError(t, err)
	require.Equal(t, int64(2), emptyVersionCount, "should have 2 alert rule versions with empty rule_guid")

	// Run the fixup migration
	mig := fixEmptyGuidMigration{}
	err = mig.Exec(sess, mg)
	require.NoError(t, err)

	// Verify no empty GUIDs remain in alert_rule
	_, err = sess.SQL("SELECT COUNT(*) FROM alert_rule WHERE guid = ''").Get(&emptyCount)
	require.NoError(t, err)
	require.Equal(t, int64(0), emptyCount, "should have 0 alert rules with empty guid after fix")

	// Verify no empty rule_guids remain in alert_rule_version
	_, err = sess.SQL("SELECT COUNT(*) FROM alert_rule_version WHERE rule_guid = ''").Get(&emptyVersionCount)
	require.NoError(t, err)
	require.Equal(t, int64(0), emptyVersionCount, "should have 0 alert rule versions with empty rule_guid after fix")

	// Verify all GUIDs are valid UUIDs
	var guids []string
	err = sess.SQL("SELECT guid FROM alert_rule").Find(&guids)
	require.NoError(t, err)
	require.Len(t, guids, 2)
	for _, g := range guids {
		_, err := uuid.Parse(g)
		require.NoError(t, err, "guid should be a valid UUID: %s", g)
	}

	// Verify all GUIDs are unique
	require.NotEqual(t, guids[0], guids[1], "GUIDs should be unique")

	// Verify alert_rule_version.rule_guid matches alert_rule.guid
	type ruleGuidPair struct {
		Guid     string `xorm:"guid"`
		RuleGuid string `xorm:"rule_guid"`
	}
	var pairs []ruleGuidPair
	err = sess.SQL(`SELECT ar.guid, arv.rule_guid
		FROM alert_rule ar
		JOIN alert_rule_version arv ON ar.uid = arv.rule_uid AND ar.org_id = arv.rule_org_id`).Find(&pairs)
	require.NoError(t, err)
	require.Len(t, pairs, 2)
	for _, p := range pairs {
		require.Equal(t, p.Guid, p.RuleGuid, "alert_rule.guid should match alert_rule_version.rule_guid")
	}
}

func TestFixEmptyGuidMigration_NoEmptyGuids(t *testing.T) {
	x, mg := setupTestDB(t)

	sess := x.NewSession()
	defer sess.Close()

	// Insert alert rules WITH valid GUIDs — no fix needed
	guid1 := uuid.NewString()
	guid2 := uuid.NewString()

	_, err := sess.Exec(`INSERT INTO alert_rule (org_id, uid, title, condition, data, namespace_uid, rule_group, no_data_state, exec_err_state, "for", interval_seconds, version, updated, guid)
		VALUES (1, 'uid1', 'rule1', 'A', '[]', 'ns1', 'group1', 'NoData', 'Error', 0, 60, 1, '2026-01-01 00:00:00', ?)`, guid1)
	require.NoError(t, err)

	_, err = sess.Exec(`INSERT INTO alert_rule (org_id, uid, title, condition, data, namespace_uid, rule_group, no_data_state, exec_err_state, "for", interval_seconds, version, updated, guid)
		VALUES (1, 'uid2', 'rule2', 'A', '[]', 'ns1', 'group1', 'NoData', 'Error', 0, 60, 1, '2026-01-01 00:00:00', ?)`, guid2)
	require.NoError(t, err)

	// Run the fixup migration — should be a no-op
	mig := fixEmptyGuidMigration{}
	err = mig.Exec(sess, mg)
	require.NoError(t, err)

	// Verify GUIDs are unchanged
	var guids []string
	err = sess.SQL("SELECT guid FROM alert_rule ORDER BY uid").Find(&guids)
	require.NoError(t, err)
	require.Equal(t, guid1, guids[0])
	require.Equal(t, guid2, guids[1])
}
