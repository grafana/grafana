package state

import (
	"context"
	"testing"
	"time"

	"github.com/stretchr/testify/require"
	"go.opentelemetry.io/otel"

	"github.com/grafana/grafana-plugin-sdk-go/data"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/util"
)

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
						FiredAt:            util.Pointer(time.Now()),
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
			mockStore := new(FakeInstanceStore)
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
					FiredAt:           s.FiredAt,
					ResolvedAt:        s.ResolvedAt,
					LastSentAt:        s.LastSentAt,
					ResultFingerprint: s.ResultFingerprint.String(),
				}
				instances = append(instances, instance)
			}
			persister.Sync(ctx, span, tc.ruleKey, tc.states)

			recordedCalls := mockStore.RecordedOps()
			require.Len(t, recordedCalls, 1)

			for _, op := range recordedCalls {
				switch q := op.(type) {
				case FakeInstanceStoreOp:
					require.Equal(t, "SaveAlertInstancesForRule", q.Name)
					require.Equal(t, tc.ruleKey, q.Args[1])
					require.Equal(t, instances, q.Args[2])
				default:
					require.Fail(t, "unexpected call", "op: %v", op)
				}
			}
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
