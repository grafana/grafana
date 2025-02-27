package store_test

import (
	"bytes"
	"context"
	"fmt"
	"testing"
	"time"

	"github.com/golang/snappy"
	"github.com/stretchr/testify/require"
	"google.golang.org/protobuf/proto"

	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/ngalert/models"
	pb "github.com/grafana/grafana/pkg/services/ngalert/store/proto/v1"
	"github.com/grafana/grafana/pkg/services/ngalert/tests"
	"github.com/grafana/grafana/pkg/util"
)

const baseIntervalSeconds = 10

func TestIntegration_CompressedAlertRuleStateOperations(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}

	ctx := context.Background()
	ng, dbstore := tests.SetupTestEnv(
		t,
		baseIntervalSeconds,
		tests.WithFeatureToggles(
			featuremgmt.WithFeatures(featuremgmt.FlagAlertingSaveStateCompressed),
		),
	)

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
					createAlertInstance(alertRule1.OrgID, alertRule1.UID, "labelsHash1", string(models.InstanceStateError), models.InstanceStateFiring),
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
					createAlertInstance(alertRule1.OrgID, alertRule1.UID, "hash1", "", models.InstanceStateFiring),
					createAlertInstance(alertRule1.OrgID, alertRule1.UID, "hash2", "", models.InstanceStateFiring),
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

func createAlertInstance(orgID int64, ruleUID, labelsHash, reason string, state models.InstanceStateType) models.AlertInstance {
	return models.AlertInstance{
		AlertInstanceKey: models.AlertInstanceKey{
			RuleOrgID:  orgID,
			RuleUID:    ruleUID,
			LabelsHash: labelsHash,
		},
		CurrentState:  state,
		CurrentReason: reason,
		Labels:        models.InstanceLabels{"label1": "value1"},
	}
}

func TestIntegrationAlertInstanceOperations(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}
	ctx := context.Background()
	ng, dbstore := tests.SetupTestEnv(t, baseIntervalSeconds)

	const mainOrgID int64 = 1

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
		err := ng.InstanceStore.SaveAlertInstance(ctx, instance)
		require.NoError(t, err)

		listCmd := &models.ListAlertInstancesQuery{
			RuleOrgID: instance.RuleOrgID,
			RuleUID:   instance.RuleUID,
		}
		alerts, err := ng.InstanceStore.ListAlertInstances(ctx, listCmd)
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
		err := ng.InstanceStore.SaveAlertInstance(ctx, instance)
		require.NoError(t, err)

		listCmd := &models.ListAlertInstancesQuery{
			RuleOrgID: instance.RuleOrgID,
			RuleUID:   instance.RuleUID,
		}

		alerts, err := ng.InstanceStore.ListAlertInstances(ctx, listCmd)
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

		err := ng.InstanceStore.SaveAlertInstance(ctx, instance1)
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
		err = ng.InstanceStore.SaveAlertInstance(ctx, instance2)
		require.NoError(t, err)

		listQuery := &models.ListAlertInstancesQuery{
			RuleOrgID: instance1.RuleOrgID,
			RuleUID:   instance1.RuleUID,
		}

		alerts, err := ng.InstanceStore.ListAlertInstances(ctx, listQuery)
		require.NoError(t, err)

		require.Len(t, alerts, 2)
	})

	t.Run("can list all added instances in org", func(t *testing.T) {
		listQuery := &models.ListAlertInstancesQuery{
			RuleOrgID: orgID,
		}

		alerts, err := ng.InstanceStore.ListAlertInstances(ctx, listQuery)
		require.NoError(t, err)

		require.Len(t, alerts, 4)
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

		err := ng.InstanceStore.SaveAlertInstance(ctx, instance1)
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
		err = ng.InstanceStore.SaveAlertInstance(ctx, instance2)
		require.NoError(t, err)

		listQuery := &models.ListAlertInstancesQuery{
			RuleOrgID: alertRule4.OrgID,
			RuleUID:   alertRule4.UID,
		}

		alerts, err := ng.InstanceStore.ListAlertInstances(ctx, listQuery)
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
	ng, _ := tests.SetupTestEnv(t, baseIntervalSeconds)

	orgID := int64(1)

	ruleUIDs := []string{"a", "b", "c", "d"}

	instances := make([]models.AlertInstance, len(ruleUIDs))
	for i, ruleUID := range ruleUIDs {
		instances[i] = generateTestAlertInstance(orgID, ruleUID)
	}

	t.Run("Should do a proper full sync", func(t *testing.T) {
		err := ng.InstanceStore.FullSync(ctx, instances, batchSize)
		require.NoError(t, err)

		res, err := ng.InstanceStore.ListAlertInstances(ctx, &models.ListAlertInstancesQuery{
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
		err := ng.InstanceStore.FullSync(ctx, instances[1:], batchSize)
		require.NoError(t, err)

		res, err := ng.InstanceStore.ListAlertInstances(ctx, &models.ListAlertInstancesQuery{
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
		err := ng.InstanceStore.FullSync(ctx, append(instances, generateTestAlertInstance(orgID, newRuleUID)), batchSize)
		require.NoError(t, err)

		res, err := ng.InstanceStore.ListAlertInstances(ctx, &models.ListAlertInstancesQuery{
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
		err := ng.InstanceStore.FullSync(ctx, append(instances, generateTestAlertInstance(orgID, newRuleUID)), batchSize)
		require.NoError(t, err)

		res, err := ng.InstanceStore.ListAlertInstances(ctx, &models.ListAlertInstancesQuery{
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
		err := ng.InstanceStore.FullSync(ctx, initialInstances, 5)
		require.NoError(t, err)

		// Now call FullSync with no instances. According to the code, this should return nil
		// and should not delete anything in the table.
		err = ng.InstanceStore.FullSync(ctx, []models.AlertInstance{}, 5)
		require.NoError(t, err)

		// Check that the previously inserted instances are still present.
		res, err := ng.InstanceStore.ListAlertInstances(ctx, &models.ListAlertInstancesQuery{
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

		err := ng.InstanceStore.FullSync(ctx, []models.AlertInstance{validInstance, invalidInstance}, 2)
		require.NoError(t, err)

		// Only the valid instance should be saved.
		res, err := ng.InstanceStore.ListAlertInstances(ctx, &models.ListAlertInstancesQuery{
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

		err := ng.InstanceStore.FullSync(ctx, smallSet, 100)
		require.NoError(t, err)

		res, err := ng.InstanceStore.ListAlertInstances(ctx, &models.ListAlertInstancesQuery{
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
		err := ng.InstanceStore.FullSync(ctx, []models.AlertInstance{}, 1)
		require.NoError(t, err)

		largeCount := 300
		largeSet := make([]models.AlertInstance, largeCount)
		for i := 0; i < largeCount; i++ {
			largeSet[i] = generateTestAlertInstance(orgID, fmt.Sprintf("large-%d", i))
		}

		err = ng.InstanceStore.FullSync(ctx, largeSet, 50)
		require.NoError(t, err)

		res, err := ng.InstanceStore.ListAlertInstances(ctx, &models.ListAlertInstancesQuery{
			RuleOrgID: orgID,
		})
		require.NoError(t, err)
		require.Len(t, res, largeCount)
	})
}

func TestIntegration_ProtoInstanceDBStore_VerifyCompressedData(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}

	ctx := context.Background()
	ng, dbstore := tests.SetupTestEnv(
		t,
		baseIntervalSeconds,
		tests.WithFeatureToggles(
			featuremgmt.WithFeatures(
				featuremgmt.FlagAlertingSaveStateCompressed,
			),
		),
	)

	alertRule := tests.CreateTestAlertRule(t, ctx, dbstore, 60, 1)

	labelsHash := "hash1"
	reason := "reason"
	state := models.InstanceStateFiring
	instances := []models.AlertInstance{
		createAlertInstance(alertRule.OrgID, alertRule.UID, labelsHash, reason, state),
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
