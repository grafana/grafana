package state_test

import (
	"context"
	"testing"
	"time"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/services/ngalert/state"
	"github.com/grafana/grafana/pkg/services/ngalert/tests"
	"github.com/stretchr/testify/require"
)

func TestCleanStates(t *testing.T) {
	evaluationTime, err := time.Parse("2006-01-02", "2021-03-25")
	require.NoError(t, err)
	ctx := context.Background()
	_, dbstore := tests.SetupTestEnv(t, 1)
	const mainOrgID int64 = 1
	rule := tests.CreateTestAlertRule(t, ctx, dbstore, 600, mainOrgID)

	instances := make([]models.AlertInstance, 0)

	labels := models.InstanceLabels{"test1": "testValue1"}
	_, hash, _ := labels.StringAndHash()
	instances = append(instances, models.AlertInstance{
		AlertInstanceKey: models.AlertInstanceKey{
			RuleOrgID:  rule.OrgID,
			RuleUID:    rule.UID,
			LabelsHash: hash,
		},
		CurrentState:      models.InstanceStateNormal,
		LastEvalTime:      evaluationTime,
		CurrentStateSince: evaluationTime.Add(-1 * time.Minute),
		CurrentStateEnd:   evaluationTime.Add(1 * time.Minute),
		Labels:            labels,
	})

	labels = models.InstanceLabels{"test2": "testValue2"}
	_, hash, _ = labels.StringAndHash()
	instances = append(instances, models.AlertInstance{
		AlertInstanceKey: models.AlertInstanceKey{
			RuleOrgID:  rule.OrgID,
			RuleUID:    rule.UID,
			LabelsHash: hash,
		},
		CurrentState:      models.InstanceStateFiring,
		LastEvalTime:      evaluationTime,
		CurrentStateSince: evaluationTime.Add(-1 * time.Minute),
		CurrentStateEnd:   evaluationTime.Add(1 * time.Minute),
		Labels:            labels,
	})

	// Orphaned instance.
	const notExistingRuleUID = "does-not-exist"
	labels = models.InstanceLabels{"test3": "testValue3"}
	_, hash, _ = labels.StringAndHash()
	instances = append(instances, models.AlertInstance{
		AlertInstanceKey: models.AlertInstanceKey{
			RuleOrgID:  rule.OrgID,
			RuleUID:    notExistingRuleUID,
			LabelsHash: hash,
		},
		CurrentState:      models.InstanceStateFiring,
		LastEvalTime:      evaluationTime,
		CurrentStateSince: evaluationTime.Add(-1 * time.Minute),
		CurrentStateEnd:   evaluationTime.Add(1 * time.Minute),
		Labels:            labels,
	})

	for _, instance := range instances {
		_ = dbstore.SaveAlertInstance(ctx, instance)
	}

	err = state.Clean(ctx, dbstore, dbstore, log.NewNopLogger())

	require.NoError(t, err)

	t.Run("database contains expected entries", func(t *testing.T) {
		query := &models.ListAlertInstancesQuery{
			RuleOrgID: rule.OrgID,
			RuleUID:   rule.UID,
		}

		res, err := dbstore.ListAlertInstances(ctx, query)

		require.NoError(t, err)
		require.Equal(t, 2, len(res), "unexpected number of states in database, expected 2, actual: %v", res)
	})

	t.Run("database no longer contains orphaned entries", func(t *testing.T) {
		query := &models.ListAlertInstancesQuery{
			RuleOrgID: rule.OrgID,
			RuleUID:   notExistingRuleUID,
		}

		res, err := dbstore.ListAlertInstances(ctx, query)

		require.NoError(t, err)
		require.Empty(t, res, "Orphaned entry was not cleared from database")
	})
}
