package state

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/ngalert/models"
)

func TestStoreStateReader_GetAll(t *testing.T) {
	now := time.Now()
	orgID := int64(1)

	testCases := []struct {
		name             string
		instances        []*models.AlertInstance
		dbError          error
		expectedStates   int
		expectNilOnError bool
	}{
		{
			name:           "returns empty slice when no instances exist",
			instances:      []*models.AlertInstance{},
			expectedStates: 0,
		},
		{
			name: "returns states for all instances",
			instances: []*models.AlertInstance{
				{
					AlertInstanceKey: models.AlertInstanceKey{
						RuleOrgID:  orgID,
						RuleUID:    "rule-1",
						LabelsHash: "hash1",
					},
					Labels:       models.InstanceLabels{"alertname": "test1"},
					CurrentState: models.InstanceStateFiring,
					LastEvalTime: now,
				},
				{
					AlertInstanceKey: models.AlertInstanceKey{
						RuleOrgID:  orgID,
						RuleUID:    "rule-2",
						LabelsHash: "hash2",
					},
					Labels:       models.InstanceLabels{"alertname": "test2"},
					CurrentState: models.InstanceStateNormal,
					LastEvalTime: now.Add(-time.Minute),
				},
			},
			expectedStates: 2,
		},
		{
			name:             "returns nil on database error",
			dbError:          errors.New("database connection failed"),
			expectNilOnError: true,
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			mockReader := &mockInstanceReader{}
			if tc.dbError != nil {
				mockReader.On("ListAlertInstances", mock.Anything, mock.MatchedBy(func(q *models.ListAlertInstancesQuery) bool {
					return q.RuleOrgID == orgID
				})).Return([]*models.AlertInstance(nil), tc.dbError).Once()
			} else {
				mockReader.On("ListAlertInstances", mock.Anything, mock.MatchedBy(func(q *models.ListAlertInstancesQuery) bool {
					return q.RuleOrgID == orgID
				})).Return(tc.instances, nil).Once()
			}

			manager := NewStoreStateReader(mockReader, log.NewNopLogger(), 0, nil)
			states := manager.GetAll(context.Background(), orgID)

			if tc.expectNilOnError {
				require.Nil(t, states)
			} else {
				require.Len(t, states, tc.expectedStates)
			}

			mockReader.AssertExpectations(t)
		})
	}
}

func TestStoreStateReader_GetStatesForRuleUID(t *testing.T) {
	now := time.Now()
	orgID := int64(1)
	ruleUID := "rule-123"

	testCases := []struct {
		name             string
		instances        []*models.AlertInstance
		dbError          error
		expectedStates   int
		expectNilOnError bool
	}{
		{
			name:           "returns empty slice when no instances exist for rule",
			instances:      []*models.AlertInstance{},
			expectedStates: 0,
		},
		{
			name: "returns states for rule instances",
			instances: []*models.AlertInstance{
				{
					AlertInstanceKey: models.AlertInstanceKey{
						RuleOrgID:  orgID,
						RuleUID:    ruleUID,
						LabelsHash: "hash1",
					},
					Labels:       models.InstanceLabels{"alertname": "test", "instance": "a"},
					CurrentState: models.InstanceStateFiring,
					LastEvalTime: now,
				},
				{
					AlertInstanceKey: models.AlertInstanceKey{
						RuleOrgID:  orgID,
						RuleUID:    ruleUID,
						LabelsHash: "hash2",
					},
					Labels:       models.InstanceLabels{"alertname": "test", "instance": "b"},
					CurrentState: models.InstanceStatePending,
					LastEvalTime: now,
				},
			},
			expectedStates: 2,
		},
		{
			name:             "returns nil on database error",
			dbError:          errors.New("query failed"),
			expectNilOnError: true,
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			mockReader := &mockInstanceReader{}
			if tc.dbError != nil {
				mockReader.On("ListAlertInstances", mock.Anything, mock.MatchedBy(func(q *models.ListAlertInstancesQuery) bool {
					return q.RuleOrgID == orgID
				})).Return([]*models.AlertInstance(nil), tc.dbError).Once()
			} else {
				mockReader.On("ListAlertInstances", mock.Anything, mock.MatchedBy(func(q *models.ListAlertInstancesQuery) bool {
					return q.RuleOrgID == orgID
				})).Return(tc.instances, nil).Once()
			}

			manager := NewStoreStateReader(mockReader, log.NewNopLogger(), 0, nil)
			states := manager.GetStatesForRuleUID(context.Background(), orgID, ruleUID)

			if tc.expectNilOnError {
				require.Nil(t, states)
			} else {
				require.Len(t, states, tc.expectedStates)
			}

			mockReader.AssertExpectations(t)
		})
	}
}

func TestStoreStateReader_Status(t *testing.T) {
	now := time.Now()
	orgID := int64(1)
	ruleUID := "rule-456"
	key := models.AlertRuleKey{OrgID: orgID, UID: ruleUID}

	testCases := []struct {
		name         string
		instances    []*models.AlertInstance
		dbError      error
		expectExists bool
		expectHealth string
	}{
		{
			name:         "returns false when no instances exist",
			instances:    []*models.AlertInstance{},
			expectExists: false,
			expectHealth: "ok",
		},
		{
			name: "returns true and status when instances exist",
			instances: []*models.AlertInstance{
				{
					AlertInstanceKey: models.AlertInstanceKey{
						RuleOrgID:  orgID,
						RuleUID:    ruleUID,
						LabelsHash: "hash1",
					},
					Labels:       models.InstanceLabels{"alertname": "test"},
					CurrentState: models.InstanceStateFiring,
					LastEvalTime: now,
				},
			},
			expectExists: true,
			expectHealth: "ok",
		},
		{
			name:         "returns false on database error",
			dbError:      errors.New("connection refused"),
			expectExists: false,
			expectHealth: "ok",
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			mockReader := &mockInstanceReader{}
			mockReader.On("ListAlertInstances", mock.Anything, mock.MatchedBy(func(q *models.ListAlertInstancesQuery) bool {
				return q.RuleOrgID == orgID
			})).Return(tc.instances, tc.dbError).Once()

			reader := NewStoreStateReader(mockReader, log.NewNopLogger(), 0, nil)
			status, exists := reader.Status(context.Background(), key)

			require.Equal(t, tc.expectExists, exists)
			require.Equal(t, tc.expectHealth, status.Health)

			mockReader.AssertExpectations(t)
		})
	}
}

func TestStoreStateReader_CachesAndRefreshes(t *testing.T) {
	orgID := int64(1)
	ruleUID := "rule-1"
	inst := func(s models.InstanceStateType) []*models.AlertInstance {
		return []*models.AlertInstance{{
			AlertInstanceKey: models.AlertInstanceKey{RuleOrgID: orgID, RuleUID: ruleUID, LabelsHash: "h"},
			Labels:           models.InstanceLabels{"alertname": "t"},
			CurrentState:     s,
			LastEvalTime:     time.Now(),
		}}
	}

	mockReader := &mockInstanceReader{}
	// The cache always loads org-scoped state in bulk (no per-rule query).
	call := mockReader.On("ListAlertInstances", mock.Anything, mock.MatchedBy(func(q *models.ListAlertInstancesQuery) bool {
		return q.RuleOrgID == orgID && q.RuleUID == ""
	})).Return(inst(models.InstanceStateFiring), nil)

	m := NewStoreStateReader(mockReader, log.NewNopLogger(), time.Hour, nil)

	// Repeated reads are served from cache: only one DB load happens.
	for i := 0; i < 5; i++ {
		require.Len(t, m.GetStatesForRuleUID(context.Background(), orgID, ruleUID), 1)
	}
	mockReader.AssertNumberOfCalls(t, "ListAlertInstances", 1)

	// A background refresh reloads from the DB and atomically updates the snapshot.
	call.Return(inst(models.InstanceStateNormal), nil)
	m.refreshAll(context.Background())
	mockReader.AssertNumberOfCalls(t, "ListAlertInstances", 2)

	// Subsequent reads still come from cache (no extra DB call).
	require.Len(t, m.GetStatesForRuleUID(context.Background(), orgID, ruleUID), 1)
	mockReader.AssertNumberOfCalls(t, "ListAlertInstances", 2)
}

func TestStoreStateReader_EvictsIdleOrgs(t *testing.T) {
	orgID := int64(1)
	mockReader := &mockInstanceReader{}
	mockReader.On("ListAlertInstances", mock.Anything, mock.Anything).Return([]*models.AlertInstance{}, nil)

	m := NewStoreStateReader(mockReader, log.NewNopLogger(), time.Hour, nil)
	m.GetAll(context.Background(), orgID)
	mockReader.AssertNumberOfCalls(t, "ListAlertInstances", 1)

	// An org not read within the idle threshold is evicted without reloading.
	v, ok := m.cache.Load(orgID)
	require.True(t, ok)
	v.(*orgEntry).lastAccess.Store(time.Now().Add(-2 * stateCacheIdleEviction).UnixNano())
	m.refreshAll(context.Background())
	mockReader.AssertNumberOfCalls(t, "ListAlertInstances", 1)
	_, ok = m.cache.Load(orgID)
	require.False(t, ok)

	// The next read cold-loads again.
	m.GetAll(context.Background(), orgID)
	mockReader.AssertNumberOfCalls(t, "ListAlertInstances", 2)
}
