package state

import (
	"context"
	"testing"
	"time"

	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"
	"go.opentelemetry.io/otel"

	"github.com/grafana/grafana-plugin-sdk-go/data"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/ngalert/models"
)

type mockInstanceStore struct {
	mock.Mock
}

func (m *mockInstanceStore) SaveAlertInstancesForRule(ctx context.Context, ruleKey models.AlertRuleKeyWithGroup, instances []models.AlertInstance) error {
	args := m.Called(ctx, ruleKey, instances)
	return args.Error(0)
}

func (m *mockInstanceStore) FetchOrgIds(ctx context.Context) ([]int64, error) {
	args := m.Called(ctx)
	return args.Get(0).([]int64), args.Error(1)
}

func (m *mockInstanceStore) ListAlertInstances(ctx context.Context, cmd *models.ListAlertInstancesQuery) ([]*models.AlertInstance, error) {
	args := m.Called(ctx, cmd)
	return args.Get(0).([]*models.AlertInstance), args.Error(1)
}

func (m *mockInstanceStore) DeleteAlertInstances(ctx context.Context, keys ...models.AlertInstanceKey) error {
	args := m.Called(ctx, keys)
	return args.Error(0)
}

func (m *mockInstanceStore) DeleteAlertInstancesByRule(ctx context.Context, key models.AlertRuleKeyWithGroup) error {
	args := m.Called(ctx, key)
	return args.Error(0)
}

func (m *mockInstanceStore) FullSync(ctx context.Context, instances []models.AlertInstance) error {
	args := m.Called(ctx, instances)
	return args.Error(0)
}

func (m *mockInstanceStore) SaveAlertInstance(ctx context.Context, instance models.AlertInstance) error {
	args := m.Called(ctx, instance)
	return args.Error(0)
}

func TestSyncRuleStatePersister_Sync(t *testing.T) {
	const orgID = int64(1)
	const ruleUID = "rule-id"
	const ruleGroup = "test-group"

	testCases := []struct {
		name                 string
		states               StateTransitions
		ruleKey              models.AlertRuleKeyWithGroup
		doNotSaveNormalState bool
		expectedError        error
	}{
		{
			name: "success case",
			states: StateTransitions{
				{
					State: &State{
						Labels: data.Labels{
							"label-1": "value-1",
						},
						LastEvaluationTime: time.Now(),
						StartsAt:           time.Now(),
						EndsAt:             time.Now(),
					},
				},
			},
			ruleKey: models.AlertRuleKeyWithGroup{
				AlertRuleKey: models.AlertRuleKey{
					OrgID: orgID,
					UID:   ruleUID,
				},
				RuleGroup: ruleGroup,
			},
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			ctx := context.Background()
			mockStore := new(mockInstanceStore)
			persister := &SyncRuleStatePersister{
				log:   log.New("test"),
				store: mockStore,
			}
			tracer := otel.Tracer("test")
			ctx, span := tracer.Start(ctx, "test-span")

			instances := make([]models.AlertInstance, 0, len(tc.states))
			for _, s := range tc.states {
				key, err := s.GetAlertInstanceKey()
				require.NoError(t, err)
				instance := models.AlertInstance{
					AlertInstanceKey:  key,
					Labels:            models.InstanceLabels(s.Labels),
					CurrentState:      models.InstanceStateType(s.State.State.String()),
					CurrentReason:     s.StateReason,
					LastEvalTime:      s.LastEvaluationTime,
					CurrentStateSince: s.StartsAt,
					CurrentStateEnd:   s.EndsAt,
					ResolvedAt:        s.ResolvedAt,
					LastSentAt:        s.LastSentAt,
					ResultFingerprint: s.ResultFingerprint.String(),
				}
				instances = append(instances, instance)
			}
			mockStore.On("SaveAlertInstancesForRule", mock.Anything, tc.ruleKey, instances).Return(nil)

			persister.Sync(ctx, span, tc.ruleKey, tc.states)

			mockStore.AssertCalled(t, "SaveAlertInstancesForRule", mock.Anything, tc.ruleKey, mock.Anything)
		})
	}

	t.Run("no-op when store is nil", func(t *testing.T) {
		persister := &SyncRuleStatePersister{
			log: log.New("test"),
		}
		tracer := otel.Tracer("test")
		ctx := context.Background()
		ctx, span := tracer.Start(ctx, "test-span")
		ruleKey := models.AlertRuleKeyWithGroup{
			AlertRuleKey: models.AlertRuleKey{
				OrgID: orgID,
				UID:   ruleUID,
			},
			RuleGroup: ruleGroup,
		}
		states := StateTransitions{
			{
				State: &State{
					Labels: data.Labels{
						"label-1": "value-1",
					},
				},
			},
		}

		// There is no store, so no call to SaveAlertInstancesForRule or panic
		persister.Sync(ctx, span, ruleKey, states)
	})
}
