package store_test

import (
	"context"
	"fmt"
	"testing"
	"time"

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
		for _, instance := range instances {
			_ = dbstore.SaveAlertInstance(ctx, instance)
		}
		_ = dbstore.DeleteAlertInstances(ctx, keys...)
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
		err := dbstore.SaveAlertInstance(ctx, instance)
		require.NoError(t, err)

		listCmd := &models.ListAlertInstancesQuery{
			RuleOrgID: instance.RuleOrgID,
			RuleUID:   instance.RuleUID,
		}
		alerts, err := dbstore.ListAlertInstances(ctx, listCmd)
		require.NoError(t, err)

		require.Len(t, alerts, 1)
		require.Equal(t, instance.Labels, alerts[0].Labels)
		require.Equal(t, alertRule1.OrgID, alerts[0].RuleOrgID)
		require.Equal(t, alertRule1.UID, alerts[0].RuleUID)
		require.Equal(t, instance.CurrentReason, alerts[0].CurrentReason)
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
		err := dbstore.SaveAlertInstance(ctx, instance)
		require.NoError(t, err)

		listCmd := &models.ListAlertInstancesQuery{
			RuleOrgID: instance.RuleOrgID,
			RuleUID:   instance.RuleUID,
		}

		alerts, err := dbstore.ListAlertInstances(ctx, listCmd)
		require.NoError(t, err)

		require.Len(t, alerts, 1)
		require.Equal(t, alertRule2.OrgID, alerts[0].RuleOrgID)
		require.Equal(t, alertRule2.UID, alerts[0].RuleUID)
		require.Equal(t, instance.Labels, alerts[0].Labels)
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

		err := dbstore.SaveAlertInstance(ctx, instance1)
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
		err = dbstore.SaveAlertInstance(ctx, instance2)
		require.NoError(t, err)

		listQuery := &models.ListAlertInstancesQuery{
			RuleOrgID: instance1.RuleOrgID,
			RuleUID:   instance1.RuleUID,
		}

		alerts, err := dbstore.ListAlertInstances(ctx, listQuery)
		require.NoError(t, err)

		require.Len(t, alerts, 2)
	})

	t.Run("can list all added instances in org", func(t *testing.T) {
		listQuery := &models.ListAlertInstancesQuery{
			RuleOrgID: orgID,
		}

		alerts, err := dbstore.ListAlertInstances(ctx, listQuery)
		require.NoError(t, err)

		require.Len(t, alerts, 4)
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
		err := dbstore.SaveAlertInstance(ctx, instance1)
		require.NoError(t, err)
		err = dbstore.SaveAlertInstance(ctx, instance2)
		require.NoError(t, err)

		listQuery := &models.ListAlertInstancesQuery{
			RuleOrgID: orgID,
		}

		alerts, err := dbstore.ListAlertInstances(ctx, listQuery)
		require.NoError(t, err)

		containsHash(t, alerts, instance1.LabelsHash)

		f := dbstore.FeatureToggles
		dbstore.FeatureToggles = featuremgmt.WithFeatures(featuremgmt.FlagAlertingNoNormalState)
		t.Cleanup(func() {
			dbstore.FeatureToggles = f
		})

		alerts, err = dbstore.ListAlertInstances(ctx, listQuery)
		require.NoError(t, err)

		containsHash(t, alerts, instance2.LabelsHash)

		for _, instance := range alerts {
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

		err := dbstore.SaveAlertInstance(ctx, instance1)
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
		err = dbstore.SaveAlertInstance(ctx, instance2)
		require.NoError(t, err)

		listQuery := &models.ListAlertInstancesQuery{
			RuleOrgID: alertRule4.OrgID,
			RuleUID:   alertRule4.UID,
		}

		alerts, err := dbstore.ListAlertInstances(ctx, listQuery)
		require.NoError(t, err)

		require.Len(t, alerts, 1)

		require.Equal(t, instance2.RuleOrgID, alerts[0].RuleOrgID)
		require.Equal(t, instance2.RuleUID, alerts[0].RuleUID)
		require.Equal(t, instance2.Labels, alerts[0].Labels)
		require.Equal(t, instance2.CurrentState, alerts[0].CurrentState)
	})
}

func TestIntegrationFullSync(t *testing.T) {
	batchSize := 1

	ctx := context.Background()
	_, dbstore := tests.SetupTestEnv(t, baseIntervalSeconds)

	orgID := int64(1)

	ruleUIDs := []string{"a", "b", "c", "d"}

	instances := make([]models.AlertInstance, len(ruleUIDs))
	for i, ruleUID := range ruleUIDs {
		instances[i] = generateTestAlertInstance(orgID, ruleUID)
	}

	t.Run("Should do a proper full sync", func(t *testing.T) {
		err := dbstore.FullSync(ctx, instances, batchSize)
		require.NoError(t, err)

		res, err := dbstore.ListAlertInstances(ctx, &models.ListAlertInstancesQuery{
			RuleOrgID: orgID,
		})
		require.NoError(t, err)
		require.Len(t, res, len(instances))
		for _, ruleUID := range ruleUIDs {
			found := false
			for _, instance := range res {
				if instance.RuleUID == ruleUID {
					found = true
					continue
				}
			}
			if !found {
				t.Errorf("Instance with RuleUID '%s' not found", ruleUID)
			}
		}
	})

	t.Run("Should remove non existing entries on sync", func(t *testing.T) {
		err := dbstore.FullSync(ctx, instances[1:], batchSize)
		require.NoError(t, err)

		res, err := dbstore.ListAlertInstances(ctx, &models.ListAlertInstancesQuery{
			RuleOrgID: orgID,
		})
		require.NoError(t, err)
		require.Len(t, res, len(instances)-1)
		for _, instance := range res {
			if instance.RuleUID == "a" {
				t.Error("Instance with RuleUID 'a' should not be exist anymore")
			}
		}
	})

	t.Run("Should add new entries on sync", func(t *testing.T) {
		newRuleUID := "y"
		err := dbstore.FullSync(ctx, append(instances, generateTestAlertInstance(orgID, newRuleUID)), batchSize)
		require.NoError(t, err)

		res, err := dbstore.ListAlertInstances(ctx, &models.ListAlertInstancesQuery{
			RuleOrgID: orgID,
		})
		require.NoError(t, err)
		require.Len(t, res, len(instances)+1)
		for _, ruleUID := range append(ruleUIDs, newRuleUID) {
			found := false
			for _, instance := range res {
				if instance.RuleUID == ruleUID {
					found = true
					continue
				}
			}
			if !found {
				t.Errorf("Instance with RuleUID '%s' not found", ruleUID)
			}
		}
	})

	t.Run("Should save all instances when batch size is bigger than 1", func(t *testing.T) {
		batchSize = 2
		newRuleUID := "y"
		err := dbstore.FullSync(ctx, append(instances, generateTestAlertInstance(orgID, newRuleUID)), batchSize)
		require.NoError(t, err)

		res, err := dbstore.ListAlertInstances(ctx, &models.ListAlertInstancesQuery{
			RuleOrgID: orgID,
		})
		require.NoError(t, err)
		require.Len(t, res, len(instances)+1)
		for _, ruleUID := range append(ruleUIDs, newRuleUID) {
			found := false
			for _, instance := range res {
				if instance.RuleUID == ruleUID {
					found = true
					continue
				}
			}
			if !found {
				t.Errorf("Instance with RuleUID '%s' not found", ruleUID)
			}
		}
	})

	t.Run("Should not fail when the instances are empty", func(t *testing.T) {
		// First, insert some data into the table.
		initialInstances := []models.AlertInstance{
			generateTestAlertInstance(orgID, "preexisting-1"),
			generateTestAlertInstance(orgID, "preexisting-2"),
		}
		err := dbstore.FullSync(ctx, initialInstances, 5)
		require.NoError(t, err)

		// Now call FullSync with no instances. According to the code, this should return nil
		// and should not delete anything in the table.
		err = dbstore.FullSync(ctx, []models.AlertInstance{}, 5)
		require.NoError(t, err)

		// Check that the previously inserted instances are still present.
		res, err := dbstore.ListAlertInstances(ctx, &models.ListAlertInstancesQuery{
			RuleOrgID: orgID,
		})
		require.NoError(t, err)
		require.Len(t, res, 2, "Expected the preexisting instances to remain since empty sync does nothing")

		found1, found2 := false, false
		for _, r := range res {
			if r.RuleUID == "preexisting-1" {
				found1 = true
			}
			if r.RuleUID == "preexisting-2" {
				found2 = true
			}
		}
		require.True(t, found1, "Expected preexisting-1 to remain")
		require.True(t, found2, "Expected preexisting-2 to remain")
	})

	t.Run("Should handle invalid instances by skipping them", func(t *testing.T) {
		// Create a batch with one valid and one invalid instance
		validInstance := generateTestAlertInstance(orgID, "valid")

		invalidInstance := generateTestAlertInstance(orgID, "")
		// Make the invalid instance actually invalid
		invalidInstance.AlertInstanceKey.RuleUID = ""

		err := dbstore.FullSync(ctx, []models.AlertInstance{validInstance, invalidInstance}, 2)
		require.NoError(t, err)

		// Only the valid instance should be saved.
		res, err := dbstore.ListAlertInstances(ctx, &models.ListAlertInstancesQuery{
			RuleOrgID: orgID,
		})
		require.NoError(t, err)
		require.Len(t, res, 1)
		require.Equal(t, "valid", res[0].RuleUID)
	})

	t.Run("Should handle batchSize larger than the number of instances", func(t *testing.T) {
		// Insert a small number of instances but use a large batchSize
		smallSet := []models.AlertInstance{
			generateTestAlertInstance(orgID, "batch-test1"),
			generateTestAlertInstance(orgID, "batch-test2"),
		}

		err := dbstore.FullSync(ctx, smallSet, 100)
		require.NoError(t, err)

		res, err := dbstore.ListAlertInstances(ctx, &models.ListAlertInstancesQuery{
			RuleOrgID: orgID,
		})
		require.NoError(t, err)
		require.Len(t, res, len(smallSet))
		found1, found2 := false, false
		for _, r := range res {
			if r.RuleUID == "batch-test1" {
				found1 = true
			}
			if r.RuleUID == "batch-test2" {
				found2 = true
			}
		}
		require.True(t, found1)
		require.True(t, found2)
	})

	t.Run("Should handle a large set of instances with a moderate batchSize", func(t *testing.T) {
		// Clear everything first.
		err := dbstore.FullSync(ctx, []models.AlertInstance{}, 1)
		require.NoError(t, err)

		largeCount := 300
		largeSet := make([]models.AlertInstance, largeCount)
		for i := 0; i < largeCount; i++ {
			largeSet[i] = generateTestAlertInstance(orgID, fmt.Sprintf("large-%d", i))
		}

		err = dbstore.FullSync(ctx, largeSet, 50)
		require.NoError(t, err)

		res, err := dbstore.ListAlertInstances(ctx, &models.ListAlertInstancesQuery{
			RuleOrgID: orgID,
		})
		require.NoError(t, err)
		require.Len(t, res, largeCount)
	})
}

func generateTestAlertInstance(orgID int64, ruleID string) models.AlertInstance {
	return models.AlertInstance{
		AlertInstanceKey: models.AlertInstanceKey{
			RuleOrgID:  orgID,
			RuleUID:    ruleID,
			LabelsHash: "abc",
		},
		CurrentState: models.InstanceStateFiring,
		Labels: map[string]string{
			"hello": "world",
		},
		ResultFingerprint: "abc",
		CurrentStateEnd:   time.Now(),
		CurrentStateSince: time.Now(),
		LastEvalTime:      time.Now(),
		LastSentAt:        util.Pointer(time.Now()),
		ResolvedAt:        util.Pointer(time.Now()),
		CurrentReason:     "abc",
	}
}
