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

			manager := NewStoreStateReader(mockReader, log.NewNopLogger())
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
					return q.RuleOrgID == orgID && q.RuleUID == ruleUID
				})).Return([]*models.AlertInstance(nil), tc.dbError).Once()
			} else {
				mockReader.On("ListAlertInstances", mock.Anything, mock.MatchedBy(func(q *models.ListAlertInstancesQuery) bool {
					return q.RuleOrgID == orgID && q.RuleUID == ruleUID
				})).Return(tc.instances, nil).Once()
			}

			manager := NewStoreStateReader(mockReader, log.NewNopLogger())
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
				return q.RuleOrgID == orgID && q.RuleUID == ruleUID
			})).Return(tc.instances, tc.dbError).Once()

			reader := NewStoreStateReader(mockReader, log.NewNopLogger())
			status, exists := reader.Status(context.Background(), key)

			require.Equal(t, tc.expectExists, exists)
			require.Equal(t, tc.expectHealth, status.Health)

			mockReader.AssertExpectations(t)
		})
	}
}
