package state

import (
	"context"
	"errors"
	"fmt"
	"math/rand"
	"testing"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/data"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"k8s.io/component-base/tracing"

	"github.com/grafana/grafana/pkg/infra/log/logtest"
	"github.com/grafana/grafana/pkg/services/ngalert/eval"
	ngmodels "github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/util"
)

func TestSyncPersister_saveAlertStates(t *testing.T) {
	type stateWithReason struct {
		State  eval.State
		Reason string
	}
	create := func(s eval.State, r string) stateWithReason {
		return stateWithReason{
			State:  s,
			Reason: r,
		}
	}
	allStates := [...]stateWithReason{
		create(eval.Normal, ""),
		create(eval.Normal, eval.NoData.String()),
		create(eval.Normal, eval.Error.String()),
		create(eval.Normal, util.GenerateShortUID()),
		create(eval.Alerting, ""),
		create(eval.Pending, ""),
		create(eval.NoData, ""),
		create(eval.Error, ""),
	}
	ruleKey := ngmodels.AlertRuleKeyWithGroup{}

	transitionToKey := map[ngmodels.AlertInstanceKey]StateTransition{}
	transitions := make([]StateTransition, 0, len(allStates)*len(allStates))
	for _, fromState := range allStates {
		for i, toState := range allStates {
			tr := StateTransition{
				State: &State{
					State:       toState.State,
					StateReason: toState.Reason,
					Labels:      ngmodels.GenerateAlertLabels(5, fmt.Sprintf("%d--", i)),
				},
				PreviousState:       fromState.State,
				PreviousStateReason: fromState.Reason,
			}
			key, err := tr.GetAlertInstanceKey()
			require.NoError(t, err)
			transitionToKey[key] = tr
			transitions = append(transitions, tr)
		}
	}

	t.Run("should save all transitions if doNotSaveNormalState is false", func(t *testing.T) {
		trace := tracing.NewNoopTracerProvider().Tracer("test")
		_, span := trace.Start(context.Background(), "")
		st := &FakeInstanceStore{}
		syncStatePersister := NewSyncStatePersisiter(&logtest.Fake{}, ManagerCfg{
			InstanceStore:           st,
			MaxStateSaveConcurrency: 1,
		})
		syncStatePersister.Sync(context.Background(), span, ruleKey, transitions)
		savedKeys := map[ngmodels.AlertInstanceKey]ngmodels.AlertInstance{}
		for _, op := range st.RecordedOps() {
			saved := op.(ngmodels.AlertInstance)
			savedKeys[saved.AlertInstanceKey] = saved
		}
		assert.Len(t, transitionToKey, len(savedKeys))

		for key, tr := range transitionToKey {
			assert.Containsf(t, savedKeys, key, "state %s (%s) was not saved but should be", tr.State.State, tr.StateReason)
		}
	})

	t.Run("should not save Normal->Normal if doNotSaveNormalState is true", func(t *testing.T) {
		trace := tracing.NewNoopTracerProvider().Tracer("test")
		_, span := trace.Start(context.Background(), "")
		st := &FakeInstanceStore{}
		syncStatePersister := NewSyncStatePersisiter(&logtest.Fake{}, ManagerCfg{
			InstanceStore:           st,
			MaxStateSaveConcurrency: 1,
		})
		syncStatePersister.Sync(context.Background(), span, ruleKey, transitions)

		savedKeys := map[ngmodels.AlertInstanceKey]ngmodels.AlertInstance{}
		for _, op := range st.RecordedOps() {
			saved := op.(ngmodels.AlertInstance)
			savedKeys[saved.AlertInstanceKey] = saved
		}
		for key, tr := range transitionToKey {
			if tr.State.State == eval.Normal && tr.StateReason == "" && tr.PreviousState == eval.Normal && tr.PreviousStateReason == "" {
				continue
			}
			assert.Containsf(t, savedKeys, key, "state %s (%s) was not saved but should be", tr.State.State, tr.StateReason)
		}
	})

	t.Run("should save expected fields", func(t *testing.T) {
		trace := tracing.NewNoopTracerProvider().Tracer("test")
		_, span := trace.Start(context.Background(), "")
		st := &FakeInstanceStore{}
		syncStatePersister := NewSyncStatePersisiter(&logtest.Fake{}, ManagerCfg{
			InstanceStore:           st,
			MaxStateSaveConcurrency: 1,
		})

		state := &State{
			OrgID:             rand.Int63(),
			AlertRuleUID:      util.GenerateShortUID(),
			CacheID:           data.Fingerprint(rand.Int63()),
			State:             eval.Alerting,
			StateReason:       "TEST",
			ResultFingerprint: data.Fingerprint(rand.Int63()),
			LatestResult: &Evaluation{
				EvaluationTime:  time.Now().Add(1 * time.Minute),
				EvaluationState: eval.Alerting,
				Values: map[string]float64{
					"A": 1.0,
					"B": 2.0,
				},
				Condition: "A",
			},
			Error: errors.New("test"),
			Image: &ngmodels.Image{
				ID:        rand.Int63(),
				Token:     util.GenerateShortUID(),
				Path:      util.GenerateShortUID(),
				URL:       util.GenerateShortUID(),
				CreatedAt: time.Now().Add(2 * time.Minute),
				ExpiresAt: time.Now().Add(3 * time.Minute),
			},
			Annotations: ngmodels.GenerateAlertLabels(4, "annotations_"),
			Labels:      ngmodels.GenerateAlertLabels(4, "labels_"),
			Values: map[string]float64{
				"A1": 11.0,
				"B1": 12.0,
			},
			StartsAt:             time.Now().Add(4 * time.Minute),
			EndsAt:               time.Now().Add(5 * time.Minute),
			ResolvedAt:           util.Pointer(time.Now().Add(6 * time.Minute)),
			LastSentAt:           util.Pointer(time.Now().Add(7 * time.Minute)),
			LastEvaluationString: util.GenerateShortUID(),
			LastEvaluationTime:   time.Now().Add(8 * time.Minute),
			EvaluationDuration:   time.Duration(rand.Intn(100)+1) * time.Second,
		}

		transition := StateTransition{
			State:               state,
			PreviousState:       eval.Normal,
			PreviousStateReason: util.GenerateShortUID(),
		}

		syncStatePersister.Sync(context.Background(), span, ruleKey, []StateTransition{transition})

		require.Len(t, st.RecordedOps(), 1)
		saved := st.RecordedOps()[0].(ngmodels.AlertInstance)

		expectedAlertInstanceKey, err := state.GetAlertInstanceKey()
		require.NoError(t, err)
		assert.Equal(t, expectedAlertInstanceKey, saved.AlertInstanceKey)
		assert.Equal(t, ngmodels.InstanceLabels(state.Labels), saved.Labels)
		assert.EqualValues(t, ngmodels.InstanceStateType(state.State.String()), saved.CurrentState)
		assert.Equal(t, state.StateReason, saved.CurrentReason)
		assert.Equal(t, state.StartsAt, saved.CurrentStateSince)
		assert.Equal(t, state.EndsAt, saved.CurrentStateEnd)
		assert.Equal(t, state.LastEvaluationTime, saved.LastEvalTime)
		assert.Equal(t, state.LastSentAt, saved.LastSentAt)
		assert.EqualValues(t, state.ResolvedAt, saved.ResolvedAt)
		assert.Equal(t, state.ResultFingerprint.String(), saved.ResultFingerprint)
	})
}
