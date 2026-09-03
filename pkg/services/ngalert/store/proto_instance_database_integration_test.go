package store_test

import (
	"bytes"
	"context"
	"fmt"
	"strings"
	"testing"

	"github.com/golang/snappy"
	"github.com/grafana/grafana/pkg/util/testutil"
	"github.com/stretchr/testify/require"
	"google.golang.org/protobuf/proto"

	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/services/ngalert/models"
	pb "github.com/grafana/grafana/pkg/services/ngalert/store/proto/v1"
	"github.com/grafana/grafana/pkg/services/ngalert/tests"
)

const baseIntervalSeconds = 10

func TestIntegration_CompressedAlertRuleStateOperations(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	ctx := context.Background()
	ng, dbstore := tests.SetupTestEnv(t, baseIntervalSeconds)

	const mainOrgID int64 = 1

	alertRule1 := tests.CreateTestAlertRule(t, ctx, dbstore, 60, mainOrgID)
	orgID := alertRule1.OrgID
	alertRule2 := tests.CreateTestAlertRule(t, ctx, dbstore, 60, mainOrgID)
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
	ng, dbstore := tests.SetupTestEnv(t, baseIntervalSeconds)

	alertRule := tests.CreateTestAlertRule(t, ctx, dbstore, 60, 1)

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
