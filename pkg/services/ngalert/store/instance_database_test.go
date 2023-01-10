package store_test

import (
	"context"
	"fmt"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/services/ngalert/tests"
	"github.com/grafana/grafana/pkg/util"
)

const baseIntervalSeconds = 10

func BenchmarkAlertInstanceOperations(b *testing.B) {
	b.StopTimer()
	ctx := context.Background()
	_, dbstore := tests.SetupTestEnv(b, baseIntervalSeconds)
	dbstore.FeatureToggles = featuremgmt.WithFeatures(featuremgmt.FlagAlertingBigTransactions)

	const mainOrgID int64 = 1

	alertRule := tests.CreateTestAlertRule(b, ctx, dbstore, 60, mainOrgID)

	// Create some instances to write down and then delete.
	count := 10_003
	instances := make([]models.AlertInstance, 0, count)
	keys := make([]models.AlertInstanceKey, 0, count)
	for i := 0; i < count; i++ {
		labels := models.InstanceLabels{"test": fmt.Sprint(i)}
		_, labelsHash, _ := labels.StringAndHash()
		instance := models.AlertInstance{
			AlertInstanceKey: models.AlertInstanceKey{
				RuleOrgID:  alertRule.OrgID,
				RuleUID:    alertRule.UID,
				LabelsHash: labelsHash,
			},
			CurrentState:  models.InstanceStateFiring,
			CurrentReason: string(models.InstanceStateError),
			Labels:        labels,
		}
		instances = append(instances, instance)
		keys = append(keys, instance.AlertInstanceKey)
	}

	b.StartTimer()
	for i := 0; i < b.N; i++ {
		_ = dbstore.SaveAlertInstances(ctx, instances...)
		_ = dbstore.DeleteAlertInstances(ctx, keys...)
	}
}

func TestIntegrationAlertInstanceBulkWrite(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}
	ctx := context.Background()
	_, dbstore := tests.SetupTestEnv(t, baseIntervalSeconds)

	orgIDs := []int64{1, 2, 3, 4, 5}
	counts := []int{10_000, 200, 503, 0, 1256}
	instances := make([]models.AlertInstance, 0, 10_000+200+503+0+1256)
	keys := make([]models.AlertInstanceKey, 0, 10_000+200+503+0+1256)

	for i, id := range orgIDs {
		alertRule := tests.CreateTestAlertRule(t, ctx, dbstore, 60, id)

		// Create some instances to write down and then delete.
		for j := 0; j < counts[i]; j++ {
			labels := models.InstanceLabels{"test": fmt.Sprint(j)}
			_, labelsHash, _ := labels.StringAndHash()
			instance := models.AlertInstance{
				AlertInstanceKey: models.AlertInstanceKey{
					RuleOrgID:  alertRule.OrgID,
					RuleUID:    alertRule.UID,
					LabelsHash: labelsHash,
				},
				CurrentState:  models.InstanceStateFiring,
				CurrentReason: string(models.InstanceStateError),
				Labels:        labels,
			}
			instances = append(instances, instance)
			keys = append(keys, instance.AlertInstanceKey)
		}
	}

	for _, bigStmts := range []bool{false, true} {
		dbstore.FeatureToggles = featuremgmt.WithFeatures([]interface{}{featuremgmt.FlagAlertingBigTransactions, bigStmts})
		t.Log("Saving")
		err := dbstore.SaveAlertInstances(ctx, instances...)
		require.NoError(t, err)
		t.Log("Finished database write")

		// List our instances. Make sure we have the right count.
		for i, id := range orgIDs {
			q := &models.ListAlertInstancesQuery{
				RuleOrgID: id,
			}
			err = dbstore.ListAlertInstances(ctx, q)
			require.NoError(t, err)
			require.Equal(t, counts[i], len(q.Result), "Org %v: Expected %v instances but got %v", id, counts[i], len(q.Result))
		}
		t.Log("Finished database read")

		err = dbstore.DeleteAlertInstances(ctx, keys...)
		require.NoError(t, err)
		t.Log("Finished database delete")

		for _, id := range orgIDs {
			q := &models.ListAlertInstancesQuery{
				RuleOrgID: id,
			}
			err = dbstore.ListAlertInstances(ctx, q)
			require.NoError(t, err)
			require.Zero(t, len(q.Result), "Org %v: Deleted instances but still had %v", id, len(q.Result))
		}
	}
}

func TestIntegrationAlertInstanceOperations(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}
	ctx := context.Background()
	_, dbstore := tests.SetupTestEnv(t, baseIntervalSeconds)

	const mainOrgID int64 = 1

	containsHash := func(t *testing.T, instances []*models.AlertInstance, hash string) {
		t.Helper()
		for _, i := range instances {
			if i.LabelsHash == hash {
				return
			}
		}
		require.Fail(t, "%v does not contain an instance with hash %s", instances, hash)
	}

	alertRule1 := tests.CreateTestAlertRule(t, ctx, dbstore, 60, mainOrgID)
	orgID := alertRule1.OrgID

	alertRule2 := tests.CreateTestAlertRule(t, ctx, dbstore, 60, mainOrgID)
	require.Equal(t, orgID, alertRule2.OrgID)

	alertRule3 := tests.CreateTestAlertRule(t, ctx, dbstore, 60, mainOrgID)
	require.Equal(t, orgID, alertRule3.OrgID)

	alertRule4 := tests.CreateTestAlertRule(t, ctx, dbstore, 60, mainOrgID)
	require.Equal(t, orgID, alertRule4.OrgID)

	t.Run("can save and read new alert instance", func(t *testing.T) {
		labels := models.InstanceLabels{"test": "testValue"}
		_, hash, _ := labels.StringAndHash()
		instance := models.AlertInstance{
			AlertInstanceKey: models.AlertInstanceKey{
				RuleOrgID:  alertRule1.OrgID,
				RuleUID:    alertRule1.UID,
				LabelsHash: hash,
			},
			CurrentState:  models.InstanceStateFiring,
			CurrentReason: string(models.InstanceStateError),
			Labels:        labels,
		}
		err := dbstore.SaveAlertInstances(ctx, instance)
		require.NoError(t, err)

		listCmd := &models.ListAlertInstancesQuery{
			RuleOrgID: instance.RuleOrgID,
			RuleUID:   instance.RuleUID,
		}
		err = dbstore.ListAlertInstances(ctx, listCmd)
		require.NoError(t, err)

		require.Len(t, listCmd.Result, 1)
		require.Equal(t, instance.Labels, listCmd.Result[0].Labels)
		require.Equal(t, alertRule1.OrgID, listCmd.Result[0].RuleOrgID)
		require.Equal(t, alertRule1.UID, listCmd.Result[0].RuleUID)
		require.Equal(t, instance.CurrentReason, listCmd.Result[0].CurrentReason)
	})

	t.Run("can save and read new alert instance with no labels", func(t *testing.T) {
		labels := models.InstanceLabels{}
		_, hash, _ := labels.StringAndHash()
		instance := models.AlertInstance{
			AlertInstanceKey: models.AlertInstanceKey{
				RuleOrgID:  alertRule2.OrgID,
				RuleUID:    alertRule2.UID,
				LabelsHash: hash,
			},
			CurrentState: models.InstanceStateNormal,
			Labels:       labels,
		}
		err := dbstore.SaveAlertInstances(ctx, instance)
		require.NoError(t, err)

		listCmd := &models.ListAlertInstancesQuery{
			RuleOrgID: instance.RuleOrgID,
			RuleUID:   instance.RuleUID,
		}

		err = dbstore.ListAlertInstances(ctx, listCmd)
		require.NoError(t, err)

		require.Len(t, listCmd.Result, 1)
		require.Equal(t, alertRule2.OrgID, listCmd.Result[0].RuleOrgID)
		require.Equal(t, alertRule2.UID, listCmd.Result[0].RuleUID)
		require.Equal(t, instance.Labels, listCmd.Result[0].Labels)
	})

	t.Run("can save two instances with same org_id, uid and different labels", func(t *testing.T) {
		labels := models.InstanceLabels{"test": "testValue"}
		_, hash, _ := labels.StringAndHash()
		instance1 := models.AlertInstance{
			AlertInstanceKey: models.AlertInstanceKey{
				RuleOrgID:  alertRule3.OrgID,
				RuleUID:    alertRule3.UID,
				LabelsHash: hash,
			},
			CurrentState: models.InstanceStateFiring,
			Labels:       labels,
		}

		err := dbstore.SaveAlertInstances(ctx, instance1)
		require.NoError(t, err)

		labels = models.InstanceLabels{"test": "testValue2"}
		_, hash, _ = labels.StringAndHash()
		instance2 := models.AlertInstance{
			AlertInstanceKey: models.AlertInstanceKey{
				RuleOrgID:  instance1.RuleOrgID,
				RuleUID:    instance1.RuleUID,
				LabelsHash: hash,
			},
			CurrentState: models.InstanceStateFiring,
			Labels:       labels,
		}
		err = dbstore.SaveAlertInstances(ctx, instance2)
		require.NoError(t, err)

		listQuery := &models.ListAlertInstancesQuery{
			RuleOrgID: instance1.RuleOrgID,
			RuleUID:   instance1.RuleUID,
		}

		err = dbstore.ListAlertInstances(ctx, listQuery)
		require.NoError(t, err)

		require.Len(t, listQuery.Result, 2)
	})

	t.Run("can list all added instances in org", func(t *testing.T) {
		listQuery := &models.ListAlertInstancesQuery{
			RuleOrgID: orgID,
		}

		err := dbstore.ListAlertInstances(ctx, listQuery)
		require.NoError(t, err)

		require.Len(t, listQuery.Result, 4)
	})

	t.Run("should ignore Normal state with no reason if feature flag is enabled", func(t *testing.T) {
		labels := models.InstanceLabels{"test": util.GenerateShortUID()}
		instance1 := models.AlertInstance{
			AlertInstanceKey: models.AlertInstanceKey{
				RuleOrgID:  orgID,
				RuleUID:    util.GenerateShortUID(),
				LabelsHash: util.GenerateShortUID(),
			},
			CurrentState:  models.InstanceStateNormal,
			CurrentReason: "",
			Labels:        labels,
		}
		instance2 := models.AlertInstance{
			AlertInstanceKey: models.AlertInstanceKey{
				RuleOrgID:  orgID,
				RuleUID:    util.GenerateShortUID(),
				LabelsHash: util.GenerateShortUID(),
			},
			CurrentState:  models.InstanceStateNormal,
			CurrentReason: models.StateReasonError,
			Labels:        labels,
		}
		err := dbstore.SaveAlertInstances(ctx, instance1, instance2)
		require.NoError(t, err)

		listQuery := &models.ListAlertInstancesQuery{
			RuleOrgID: orgID,
		}

		err = dbstore.ListAlertInstances(ctx, listQuery)
		require.NoError(t, err)

		containsHash(t, listQuery.Result, instance1.LabelsHash)

		f := dbstore.FeatureToggles
		dbstore.FeatureToggles = featuremgmt.WithFeatures(featuremgmt.FlagAlertingNoNormalState)
		t.Cleanup(func() {
			dbstore.FeatureToggles = f
		})

		err = dbstore.ListAlertInstances(ctx, listQuery)
		require.NoError(t, err)

		containsHash(t, listQuery.Result, instance2.LabelsHash)

		for _, instance := range listQuery.Result {
			if instance.CurrentState == models.InstanceStateNormal && instance.CurrentReason == "" {
				require.Fail(t, "List operation expected to return all states except Normal but the result contains Normal states")
			}
		}
	})

	t.Run("update instance with same org_id, uid and different state", func(t *testing.T) {
		labels := models.InstanceLabels{"test": "testValue"}
		_, hash, _ := labels.StringAndHash()
		instance1 := models.AlertInstance{
			AlertInstanceKey: models.AlertInstanceKey{
				RuleOrgID:  alertRule4.OrgID,
				RuleUID:    alertRule4.UID,
				LabelsHash: hash,
			},
			CurrentState: models.InstanceStateFiring,
			Labels:       labels,
		}

		err := dbstore.SaveAlertInstances(ctx, instance1)
		require.NoError(t, err)

		instance2 := models.AlertInstance{
			AlertInstanceKey: models.AlertInstanceKey{
				RuleOrgID:  alertRule4.OrgID,
				RuleUID:    instance1.RuleUID,
				LabelsHash: instance1.LabelsHash,
			},
			CurrentState: models.InstanceStateNormal,
			Labels:       instance1.Labels,
		}
		err = dbstore.SaveAlertInstances(ctx, instance2)
		require.NoError(t, err)

		listQuery := &models.ListAlertInstancesQuery{
			RuleOrgID: alertRule4.OrgID,
			RuleUID:   alertRule4.UID,
		}

		err = dbstore.ListAlertInstances(ctx, listQuery)
		require.NoError(t, err)

		require.Len(t, listQuery.Result, 1)

		require.Equal(t, instance2.RuleOrgID, listQuery.Result[0].RuleOrgID)
		require.Equal(t, instance2.RuleUID, listQuery.Result[0].RuleUID)
		require.Equal(t, instance2.Labels, listQuery.Result[0].Labels)
		require.Equal(t, instance2.CurrentState, listQuery.Result[0].CurrentState)
	})
}
