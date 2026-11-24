package store_test

import (
	"bytes"
	"context"
	"fmt"
	"strings"
	"testing"
	"time"

	"github.com/golang/snappy"
	"github.com/grafana/grafana/pkg/util/testutil"
	"github.com/stretchr/testify/require"
	"google.golang.org/protobuf/proto"

	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/services/ngalert/state"
	pb "github.com/grafana/grafana/pkg/services/ngalert/store/proto/v1"
	"github.com/grafana/grafana/pkg/services/ngalert/tests"
)

const baseIntervalSeconds = 10

func TestIntegration_CompressedAlertRuleStateOperations(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	ctx := context.Background()
	ng, _, ruleStore := tests.SetupTestEnv(t, baseIntervalSeconds)

	const mainOrgID int64 = 1

	alertRule1 := tests.CreateTestAlertRule(t, ctx, ruleStore, 60, mainOrgID)
	orgID := alertRule1.OrgID
	alertRule2 := tests.CreateTestAlertRule(t, ctx, ruleStore, 60, mainOrgID)
	require.Equal(t, orgID, alertRule2.OrgID)

	tests := []struct {
		name           string
		setupInstances func() []models.AlertInstance
		listQuery      *models.ListAlertInstancesQuery
		validate       func(t *testing.T, alerts []*models.AlertInstance)
	}{
		{
			name: "can save and read alert rule state",
			setupInstances: func() []models.AlertInstance {
				return []models.AlertInstance{
					*models.AlertInstanceGen(
						models.InstanceMuts.WithOrgID(alertRule1.OrgID),
						models.InstanceMuts.WithRuleUID(alertRule1.UID),
						models.InstanceMuts.WithLabelsHash("labelsHash1"),
						models.InstanceMuts.WithReason(string(models.InstanceStateError)),
						models.InstanceMuts.WithState(models.InstanceStateFiring),
						models.InstanceMuts.WithLabels(models.InstanceLabels{"label1": "value1"}),
						models.InstanceMuts.WithAnnotations(models.InstanceAnnotations{"annotation1": "value1"}),
					),
				}
			},
			listQuery: &models.ListAlertInstancesQuery{
				RuleOrgID: alertRule1.OrgID,
				RuleUID:   alertRule1.UID,
			},
			validate: func(t *testing.T, alerts []*models.AlertInstance) {
				require.Len(t, alerts, 1)
				require.Equal(t, "labelsHash1", alerts[0].LabelsHash)
			},
		},
		{
			name: "can save and read alert rule state with multiple instances",
			setupInstances: func() []models.AlertInstance {
				return []models.AlertInstance{
					*models.AlertInstanceGen(
						models.InstanceMuts.WithOrgID(alertRule1.OrgID),
						models.InstanceMuts.WithRuleUID(alertRule1.UID),
						models.InstanceMuts.WithLabelsHash("hash1"),
						models.InstanceMuts.WithState(models.InstanceStateFiring),
						models.InstanceMuts.WithLabels(models.InstanceLabels{"label1": "value1"}),
						models.InstanceMuts.WithAnnotations(models.InstanceAnnotations{"annotation1": "value1"}),
					),
					*models.AlertInstanceGen(
						models.InstanceMuts.WithOrgID(alertRule1.OrgID),
						models.InstanceMuts.WithRuleUID(alertRule1.UID),
						models.InstanceMuts.WithLabelsHash("hash2"),
						models.InstanceMuts.WithState(models.InstanceStateFiring),
						models.InstanceMuts.WithLabels(models.InstanceLabels{"label1": "value1"}),
						models.InstanceMuts.WithAnnotations(models.InstanceAnnotations{"annotation1": "value1"}),
					),
				}
			},
			listQuery: &models.ListAlertInstancesQuery{
				RuleOrgID: alertRule1.OrgID,
				RuleUID:   alertRule1.UID,
			},
			validate: func(t *testing.T, alerts []*models.AlertInstance) {
				require.Len(t, alerts, 2)
				containsHash(t, alerts, "hash1")
				containsHash(t, alerts, "hash2")
			},
		},
		{
			name: "truncates long LastError when saving compressed state",
			setupInstances: func() []models.AlertInstance {
				return []models.AlertInstance{
					*models.AlertInstanceGen(
						models.InstanceMuts.WithOrgID(alertRule1.OrgID),
						models.InstanceMuts.WithRuleUID(alertRule1.UID),
						models.InstanceMuts.WithLabelsHash("truncateHash"),
						models.InstanceMuts.WithState(models.InstanceStateError),
						models.InstanceMuts.WithLabels(models.InstanceLabels{"label1": "value1"}),
						models.InstanceMuts.WithLastError(strings.Repeat("e", 1200)),
					),
				}
			},
			listQuery: &models.ListAlertInstancesQuery{
				RuleOrgID: alertRule1.OrgID,
				RuleUID:   alertRule1.UID,
			},
			validate: func(t *testing.T, alerts []*models.AlertInstance) {
				require.Len(t, alerts, 1)
				require.LessOrEqual(t, len(alerts[0].LastError), 1000, "LastError should be truncated to max 1000 chars")
				require.True(t, strings.HasSuffix(alerts[0].LastError, "... (truncated)"), "Truncated error should have suffix")
			},
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			instances := tc.setupInstances()
			err := ng.InstanceStore.SaveAlertInstancesForRule(ctx, alertRule1.GetKeyWithGroup(), instances)
			require.NoError(t, err)
			alerts, err := ng.InstanceStore.ListAlertInstances(ctx, tc.listQuery)
			require.NoError(t, err)
			tc.validate(t, alerts)
		})
	}
}

// Under MySQL's default REPEATABLE READ, INSERT ... ON DUPLICATE KEY UPDATE takes a lock on the primary key
// supremum pseudo-record, so an open upsert of one rule blocked the state write of every other rule.
func TestIntegration_SaveAlertInstancesForRule_DoesNotBlockOnOtherRulesMySQL(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)
	if !db.IsTestDbMySQL() {
		t.Skip("lock behaviour is specific to MySQL")
	}

	ctx := context.Background()
	ng, dbstore, ruleStore := tests.SetupTestEnv(t, baseIntervalSeconds)

	rule1 := tests.CreateTestAlertRule(t, ctx, ruleStore, 60, 1)
	rule2 := tests.CreateTestAlertRule(t, ctx, ruleStore, 60, 1)

	instancesFor := func(ruleUID string) []models.AlertInstance {
		return []models.AlertInstance{
			*models.AlertInstanceGen(
				models.InstanceMuts.WithOrgID(1),
				models.InstanceMuts.WithRuleUID(ruleUID),
				models.InstanceMuts.WithLabelsHash("hash"),
			),
		}
	}
	require.NoError(t, ng.InstanceStore.SaveAlertInstancesForRule(ctx, rule1.GetKeyWithGroup(), instancesFor(rule1.UID)))
	require.NoError(t, ng.InstanceStore.SaveAlertInstancesForRule(ctx, rule2.GetKeyWithGroup(), instancesFor(rule2.UID)))

	holderHasLock := make(chan struct{})
	releaseHolder := make(chan struct{})
	holderDone := make(chan error, 1)
	go func() {
		holderDone <- dbstore.SQLStore.WithTransactionalDbSession(ctx, func(sess *db.Session) error {
			_, err := sess.Exec(
				"INSERT INTO alert_rule_state (org_id, rule_uid, data, updated_at) VALUES (?, ?, ?, ?) ON DUPLICATE KEY UPDATE data = VALUES(data), updated_at = VALUES(updated_at)",
				1, rule1.UID, []byte("held"), time.Now(),
			)
			close(holderHasLock)
			<-releaseHolder
			return err
		})
	}()
	t.Cleanup(func() {
		select {
		case <-releaseHolder:
		default:
			close(releaseHolder)
		}
		<-holderDone
	})
	<-holderHasLock

	saveDone := make(chan error, 1)
	go func() {
		saveDone <- ng.InstanceStore.SaveAlertInstancesForRule(ctx, rule2.GetKeyWithGroup(), instancesFor(rule2.UID))
	}()

	select {
	case err := <-saveDone:
		require.NoError(t, err)
	case <-time.After(10 * time.Second):
		require.Fail(t, "saving the state of one rule is blocked by an open write of another rule")
	}

	// updated_at has second precision, so saves of identical state in the same second change no row.
	// The test connection string has no clientFoundRows, so they report 0 affected rows.
	unchanged := instancesFor(rule2.UID)
	for range 5 {
		unchangedDone := make(chan error, 1)
		go func() {
			unchangedDone <- ng.InstanceStore.SaveAlertInstancesForRule(ctx, rule2.GetKeyWithGroup(), unchanged)
		}()
		select {
		case err := <-unchangedDone:
			require.NoError(t, err)
		case <-time.After(10 * time.Second):
			require.Fail(t, "saving unchanged state is blocked by an open write of another rule")
		}
	}
}

// containsHash is a helper function to check if an instance with
// a given labels hash exists in the list of alert instances.
func containsHash(t *testing.T, instances []*models.AlertInstance, hash string) {
	t.Helper()

	for _, i := range instances {
		if i.LabelsHash == hash {
			return
		}
	}

	require.Fail(t, fmt.Sprintf("%v does not contain an instance with hash %s", instances, hash))
}

func TestIntegration_ProtoInstanceDBStore_VerifyCompressedData(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	ctx := context.Background()
	ng, dbstore, ruleStore := tests.SetupTestEnv(t, baseIntervalSeconds)

	alertRule := tests.CreateTestAlertRule(t, ctx, ruleStore, 60, 1)

	instances := []models.AlertInstance{
		*models.AlertInstanceGen(
			models.InstanceMuts.WithOrgID(alertRule.OrgID),
			models.InstanceMuts.WithRuleUID(alertRule.UID),
			models.InstanceMuts.WithLabelsHash("hash1"),
			models.InstanceMuts.WithReason("reason"),
			models.InstanceMuts.WithState(models.InstanceStateFiring),
			models.InstanceMuts.WithLabels(models.InstanceLabels{"label1": "value1"}),
			models.InstanceMuts.WithAnnotations(models.InstanceAnnotations{"annotation1": "value1"}),
		),
	}

	err := ng.InstanceStore.SaveAlertInstancesForRule(ctx, alertRule.GetKeyWithGroup(), instances)
	require.NoError(t, err)

	// Query raw data from the database
	type compressedRow struct {
		OrgID   int64  `xorm:"org_id"`
		RuleUID string `xorm:"rule_uid"`
		Data    []byte `xorm:"data"`
	}
	var rawData compressedRow
	err = dbstore.SQLStore.WithDbSession(ctx, func(sess *db.Session) error {
		_, err := sess.SQL("SELECT * FROM alert_rule_state").Get(&rawData)
		return err
	})
	require.NoError(t, err)

	// Decompress and compare
	require.NotNil(t, rawData)
	decompressedInstances, err := decompressAlertInstances(rawData.Data)
	require.NoError(t, err)

	require.Len(t, decompressedInstances, 1)
	require.Equal(t, instances[0].LabelsHash, decompressedInstances[0].LabelsHash)
	require.Equal(t, string(instances[0].CurrentState), decompressedInstances[0].CurrentState)
	require.Equal(t, instances[0].CurrentReason, decompressedInstances[0].CurrentReason)
}

func decompressAlertInstances(compressed []byte) ([]*pb.AlertInstance, error) {
	if len(compressed) == 0 {
		return nil, nil
	}

	reader := snappy.NewReader(bytes.NewReader(compressed))
	var b bytes.Buffer
	if _, err := b.ReadFrom(reader); err != nil {
		return nil, fmt.Errorf("failed to read compressed data: %w", err)
	}

	var instances pb.AlertInstances
	if err := proto.Unmarshal(b.Bytes(), &instances); err != nil {
		return nil, fmt.Errorf("failed to unmarshal protobuf: %w", err)
	}

	return instances.Instances, nil
}

func TestIntegration_RecordingSeriesInRuleState(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	ctx := context.Background()
	ng, dbstore, ruleStore := tests.SetupTestEnv(t, baseIntervalSeconds)

	recording := tests.CreateTestAlertRule(t, ctx, ruleStore, 60, 1)
	alerting := tests.CreateTestAlertRule(t, ctx, ruleStore, 60, 1)
	seriesStore, ok := ng.InstanceStore.(state.RecordingSeriesStore)
	require.True(t, ok)

	series := []models.RecordingSeries{
		{TargetDatasourceUID: "ds", Metric: "metric", Labels: map[string]string{"job": "a"}, LastUpdate: time.Unix(1000, 0).UTC()},
		{TargetDatasourceUID: "ds", Metric: "metric", Labels: map[string]string{"job": "b"}, LastUpdate: time.Unix(1000, 0).UTC()},
	}
	instance := func(rule *models.AlertRule, hash string) models.AlertInstance {
		return *models.AlertInstanceGen(
			models.InstanceMuts.WithOrgID(rule.OrgID),
			models.InstanceMuts.WithRuleUID(rule.UID),
			models.InstanceMuts.WithLabelsHash(hash),
			models.InstanceMuts.WithState(models.InstanceStateNormal),
			models.InstanceMuts.WithLabels(models.InstanceLabels{"label": hash}),
		)
	}
	rowCount := func(t *testing.T, rule *models.AlertRule) int64 {
		t.Helper()
		var n int64
		err := dbstore.SQLStore.WithDbSession(ctx, func(sess *db.Session) error {
			_, err := sess.SQL("SELECT COUNT(*) FROM alert_rule_state WHERE org_id = ? AND rule_uid = ?", rule.OrgID, rule.UID).Get(&n)
			return err
		})
		require.NoError(t, err)
		return n
	}

	t.Run("saved series are listed and are not alert instances", func(t *testing.T) {
		require.NoError(t, seriesStore.SaveRecordingSeriesForRule(ctx, recording.GetKeyWithGroup(), series))

		got, err := seriesStore.ListRecordingSeries(ctx, recording.OrgID)
		require.NoError(t, err)
		require.Equal(t, series, got[recording.UID])

		instances, err := ng.InstanceStore.ListAlertInstances(ctx, &models.ListAlertInstancesQuery{RuleOrgID: recording.OrgID})
		require.NoError(t, err)
		require.Empty(t, instances)
	})

	t.Run("an empty set can be saved and keeps the row", func(t *testing.T) {
		require.NoError(t, seriesStore.SaveRecordingSeriesForRule(ctx, recording.GetKeyWithGroup(), nil))

		got, err := seriesStore.ListRecordingSeries(ctx, recording.OrgID)
		require.NoError(t, err)
		require.Empty(t, got[recording.UID])
		require.EqualValues(t, 1, rowCount(t, recording))
	})

	t.Run("saving alert instances for one rule keeps the series of another", func(t *testing.T) {
		require.NoError(t, seriesStore.SaveRecordingSeriesForRule(ctx, recording.GetKeyWithGroup(), series))

		require.NoError(t, ng.InstanceStore.SaveAlertInstancesForRule(ctx, alerting.GetKeyWithGroup(), []models.AlertInstance{instance(alerting, "h1")}))

		got, err := seriesStore.ListRecordingSeries(ctx, recording.OrgID)
		require.NoError(t, err)
		require.Equal(t, series, got[recording.UID])
	})

	t.Run("a full sync writes a row that has only series", func(t *testing.T) {
		err := seriesStore.FullSyncWithSeries(ctx,
			[]models.AlertInstance{instance(alerting, "h2")},
			map[models.AlertRuleKey][]models.RecordingSeries{recording.GetKey(): series},
			0, nil)
		require.NoError(t, err)

		got, err := seriesStore.ListRecordingSeries(ctx, recording.OrgID)
		require.NoError(t, err)
		require.Equal(t, series, got[recording.UID])

		instances, err := ng.InstanceStore.ListAlertInstances(ctx, &models.ListAlertInstancesQuery{RuleOrgID: alerting.OrgID, RuleUID: alerting.UID})
		require.NoError(t, err)
		require.Len(t, instances, 1)
	})

	t.Run("a plain full sync replaces a malformed blob", func(t *testing.T) {
		err := dbstore.SQLStore.WithDbSession(ctx, func(sess *db.Session) error {
			_, err := sess.Exec("UPDATE alert_rule_state SET data = ? WHERE rule_uid = ?", []byte("not snappy"), alerting.UID)
			return err
		})
		require.NoError(t, err)

		require.NoError(t, ng.InstanceStore.FullSync(ctx, []models.AlertInstance{instance(alerting, "h8")}, 0, nil))

		instances, err := ng.InstanceStore.ListAlertInstances(ctx, &models.ListAlertInstancesQuery{RuleOrgID: alerting.OrgID, RuleUID: alerting.UID})
		require.NoError(t, err)
		require.Len(t, instances, 1)
	})

	t.Run("deleting the series keeps the alert instances of the row", func(t *testing.T) {
		mixed := alerting.GetKeyWithGroup()
		require.NoError(t, seriesStore.FullSyncWithSeries(ctx,
			[]models.AlertInstance{instance(alerting, "h4")},
			map[models.AlertRuleKey][]models.RecordingSeries{alerting.GetKey(): series},
			0, nil))

		require.NoError(t, seriesStore.DeleteRecordingSeriesForRule(ctx, mixed))

		got, err := seriesStore.ListRecordingSeries(ctx, alerting.OrgID)
		require.NoError(t, err)
		require.Empty(t, got)
		instances, err := ng.InstanceStore.ListAlertInstances(ctx, &models.ListAlertInstancesQuery{RuleOrgID: alerting.OrgID, RuleUID: alerting.UID})
		require.NoError(t, err)
		require.Len(t, instances, 1)
	})

	t.Run("a full sync with only empty series sets leaves the table alone", func(t *testing.T) {
		require.NoError(t, ng.InstanceStore.SaveAlertInstancesForRule(ctx, alerting.GetKeyWithGroup(), []models.AlertInstance{instance(alerting, "h5")}))

		err := seriesStore.FullSyncWithSeries(ctx, nil, map[models.AlertRuleKey][]models.RecordingSeries{recording.GetKey(): {}}, 0, nil)
		require.NoError(t, err)

		instances, err := ng.InstanceStore.ListAlertInstances(ctx, &models.ListAlertInstancesQuery{RuleOrgID: alerting.OrgID, RuleUID: alerting.UID})
		require.NoError(t, err)
		require.Len(t, instances, 1)
	})

	t.Run("a full sync does not keep the row of an empty set", func(t *testing.T) {
		require.NoError(t, seriesStore.SaveRecordingSeriesForRule(ctx, recording.GetKeyWithGroup(), nil))
		require.EqualValues(t, 1, rowCount(t, recording))

		err := seriesStore.FullSyncWithSeries(ctx,
			[]models.AlertInstance{instance(alerting, "h6")},
			map[models.AlertRuleKey][]models.RecordingSeries{recording.GetKey(): {}},
			0, nil)
		require.NoError(t, err)

		require.EqualValues(t, 0, rowCount(t, recording))
		require.EqualValues(t, 1, rowCount(t, alerting))
	})

	t.Run("deleting the series of a series-only row removes the row", func(t *testing.T) {
		require.NoError(t, seriesStore.SaveRecordingSeriesForRule(ctx, recording.GetKeyWithGroup(), series))
		require.EqualValues(t, 1, rowCount(t, recording))

		require.NoError(t, seriesStore.DeleteRecordingSeriesForRule(ctx, recording.GetKeyWithGroup()))
		require.EqualValues(t, 0, rowCount(t, recording))
	})
}

// The series save and delete take the same MySQL lock as the instance save, and a held back write of one
// rule must not block the others. This is the path write-through takes for recording rules.
func TestIntegration_RecordingSeriesSaves_DoNotBlockOnOtherRulesMySQL(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)
	if !db.IsTestDbMySQL() {
		t.Skip("lock behaviour is specific to MySQL")
	}

	ctx := context.Background()
	ng, dbstore, ruleStore := tests.SetupTestEnv(t, baseIntervalSeconds)
	seriesStore, ok := ng.InstanceStore.(state.RecordingSeriesStore)
	require.True(t, ok)

	rule1 := tests.CreateTestAlertRule(t, ctx, ruleStore, 60, 1)
	rule2 := tests.CreateTestAlertRule(t, ctx, ruleStore, 60, 1)
	series := []models.RecordingSeries{{TargetDatasourceUID: "ds", Metric: "m", Labels: map[string]string{"a": "b"}, LastUpdate: time.Now()}}
	require.NoError(t, seriesStore.SaveRecordingSeriesForRule(ctx, rule1.GetKeyWithGroup(), series))
	instances := []models.AlertInstance{
		*models.AlertInstanceGen(models.InstanceMuts.WithOrgID(1), models.InstanceMuts.WithRuleUID(rule2.UID), models.InstanceMuts.WithLabelsHash("hash")),
	}
	require.NoError(t, seriesStore.FullSyncWithSeries(ctx, instances, map[models.AlertRuleKey][]models.RecordingSeries{rule2.GetKey(): series}, 0, nil))

	holderHasLock := make(chan struct{})
	releaseHolder := make(chan struct{})
	holderDone := make(chan error, 1)
	go func() {
		holderDone <- dbstore.SQLStore.WithTransactionalDbSession(ctx, func(sess *db.Session) error {
			_, err := sess.Exec(
				"INSERT INTO alert_rule_state (org_id, rule_uid, data, updated_at) VALUES (?, ?, ?, ?) ON DUPLICATE KEY UPDATE data = VALUES(data), updated_at = VALUES(updated_at)",
				1, rule1.UID, []byte("held"), time.Now(),
			)
			close(holderHasLock)
			<-releaseHolder
			return err
		})
	}()
	t.Cleanup(func() {
		select {
		case <-releaseHolder:
		default:
			close(releaseHolder)
		}
		require.NoError(t, <-holderDone)
	})
	<-holderHasLock

	finishes := func(t *testing.T, name string, fn func() error) {
		t.Helper()
		done := make(chan error, 1)
		go func() { done <- fn() }()
		select {
		case err := <-done:
			require.NoError(t, err)
		case <-time.After(10 * time.Second):
			require.Fail(t, name+" is blocked by an open write of another rule")
		}
	}

	t.Run("deleting series of a rule that has alert state", func(t *testing.T) {
		finishes(t, "deleting series", func() error { return seriesStore.DeleteRecordingSeriesForRule(ctx, rule2.GetKeyWithGroup()) })
	})
	t.Run("saving series", func(t *testing.T) {
		finishes(t, "saving series", func() error { return seriesStore.SaveRecordingSeriesForRule(ctx, rule2.GetKeyWithGroup(), series) })
	})
	t.Run("saving the same series again", func(t *testing.T) {
		for range 3 {
			finishes(t, "saving the same series", func() error { return seriesStore.SaveRecordingSeriesForRule(ctx, rule2.GetKeyWithGroup(), series) })
		}
	})
}
