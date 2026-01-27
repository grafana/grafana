package store

import (
	"context"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/ngalert/models"
)

func TestGetDistinctRuleUIDsByState(t *testing.T) {
	sqlStore := db.InitTestDB(t)
	store := &InstanceDBStore{
		SQLStore: sqlStore,
		Logger:   log.NewNopLogger(),
	}

	orgID := int64(1)
	ctx := context.Background()

	// Insert test alert instances with different states
	instances := []models.AlertInstance{
		{
			AlertInstanceKey: models.AlertInstanceKey{
				RuleOrgID:  orgID,
				RuleUID:    "rule1",
				LabelsHash: "hash1",
			},
			CurrentState: models.InstanceStateFiring,
			Labels:       models.InstanceLabels{"alertname": "test1"},
		},
		{
			AlertInstanceKey: models.AlertInstanceKey{
				RuleOrgID:  orgID,
				RuleUID:    "rule1",
				LabelsHash: "hash2",
			},
			CurrentState: models.InstanceStatePending,
			Labels:       models.InstanceLabels{"alertname": "test1"},
		},
		{
			AlertInstanceKey: models.AlertInstanceKey{
				RuleOrgID:  orgID,
				RuleUID:    "rule2",
				LabelsHash: "hash3",
			},
			CurrentState: models.InstanceStateError,
			Labels:       models.InstanceLabels{"alertname": "test2"},
		},
		{
			AlertInstanceKey: models.AlertInstanceKey{
				RuleOrgID:  orgID,
				RuleUID:    "rule3",
				LabelsHash: "hash4",
			},
			CurrentState: models.InstanceStateNormal,
			Labels:       models.InstanceLabels{"alertname": "test3"},
		},
		{
			AlertInstanceKey: models.AlertInstanceKey{
				RuleOrgID:  orgID,
				RuleUID:    "rule4",
				LabelsHash: "hash5",
			},
			CurrentState: models.InstanceStateNoData,
			Labels:       models.InstanceLabels{"alertname": "test4"},
		},
	}

	// Save all instances
	for _, instance := range instances {
		err := store.SaveAlertInstance(ctx, instance)
		require.NoError(t, err)
	}

	t.Run("single state filter - Pending", func(t *testing.T) {
		uids, err := store.GetDistinctRuleUIDsByState(ctx, orgID, []string{"Pending"})
		require.NoError(t, err)
		assert.Equal(t, []string{"rule1"}, uids)
	})

	t.Run("single state filter - Error", func(t *testing.T) {
		uids, err := store.GetDistinctRuleUIDsByState(ctx, orgID, []string{"Error"})
		require.NoError(t, err)
		assert.Equal(t, []string{"rule2"}, uids)
	})

	t.Run("multiple state filter", func(t *testing.T) {
		uids, err := store.GetDistinctRuleUIDsByState(ctx, orgID, []string{"Error", "NoData"})
		require.NoError(t, err)
		assert.ElementsMatch(t, []string{"rule2", "rule4"}, uids)
	})

	t.Run("state filter with multiple instances per rule", func(t *testing.T) {
		// rule1 has both Firing and Pending instances, should be returned once
		uids, err := store.GetDistinctRuleUIDsByState(ctx, orgID, []string{"Alerting", "Pending"})
		require.NoError(t, err)
		assert.ElementsMatch(t, []string{"rule1"}, uids)
	})

	t.Run("empty state filter", func(t *testing.T) {
		uids, err := store.GetDistinctRuleUIDsByState(ctx, orgID, []string{})
		require.NoError(t, err)
		assert.Nil(t, uids)
	})

	t.Run("non-existent state", func(t *testing.T) {
		uids, err := store.GetDistinctRuleUIDsByState(ctx, orgID, []string{"NonExistent"})
		require.NoError(t, err)
		assert.Empty(t, uids)
	})

	t.Run("wrong org ID", func(t *testing.T) {
		uids, err := store.GetDistinctRuleUIDsByState(ctx, 999, []string{"Error"})
		require.NoError(t, err)
		assert.Empty(t, uids)
	})
}
