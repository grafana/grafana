package state

import (
	"context"
	"fmt"
	"math/rand"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/infra/log/logtest"
	"github.com/grafana/grafana/pkg/services/ngalert/eval"
	ngmodels "github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/util"
)

// Not for parallel tests.
type CountingImageService struct {
	Called int
}

func (c *CountingImageService) NewImage(_ context.Context, _ *ngmodels.AlertRule) (*ngmodels.Image, error) {
	c.Called += 1
	return &ngmodels.Image{
		Token: fmt.Sprint(rand.Int()),
	}, nil
}

func TestStateIsStale(t *testing.T) {
	now := time.Now()
	intervalSeconds := rand.Int63n(10) + 5

	testCases := []struct {
		name           string
		lastEvaluation time.Time
		expectedResult bool
	}{
		{
			name:           "false if last evaluation is now",
			lastEvaluation: now,
			expectedResult: false,
		},
		{
			name:           "false if last evaluation is 1 interval before now",
			lastEvaluation: now.Add(-time.Duration(intervalSeconds)),
			expectedResult: false,
		},
		{
			name:           "false if last evaluation is little less than 2 interval before now",
			lastEvaluation: now.Add(-time.Duration(intervalSeconds) * time.Second * 2).Add(100 * time.Millisecond),
			expectedResult: false,
		},
		{
			name:           "true if last evaluation is 2 intervals from now",
			lastEvaluation: now.Add(-time.Duration(intervalSeconds) * time.Second * 2),
			expectedResult: true,
		},
		{
			name:           "true if last evaluation is 3 intervals from now",
			lastEvaluation: now.Add(-time.Duration(intervalSeconds) * time.Second * 3),
			expectedResult: true,
		},
	}
	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			require.Equal(t, tc.expectedResult, stateIsStale(now, tc.lastEvaluation, intervalSeconds))
		})
	}
}

func TestManager_saveAlertStates(t *testing.T) {
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

	transitionToKey := map[ngmodels.AlertInstanceKey]StateTransition{}
	transitions := make([]StateTransition, 0)
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
		st := &FakeInstanceStore{}
		m := Manager{instanceStore: st, doNotSaveNormalState: false}
		m.saveAlertStates(context.Background(), &logtest.Fake{}, transitions...)

		savedKeys := map[ngmodels.AlertInstanceKey]ngmodels.AlertInstance{}
		for _, op := range st.RecordedOps {
			saved := op.(ngmodels.AlertInstance)
			savedKeys[saved.AlertInstanceKey] = saved
		}
		assert.Len(t, transitionToKey, len(savedKeys))

		for key, tr := range transitionToKey {
			assert.Containsf(t, savedKeys, key, "state %s (%s) was not saved but should be", tr.State.State, tr.StateReason)
		}
	})

	t.Run("should not save Normal->Normal if doNotSaveNormalState is true", func(t *testing.T) {
		st := &FakeInstanceStore{}
		m := Manager{instanceStore: st, doNotSaveNormalState: true}
		m.saveAlertStates(context.Background(), &logtest.Fake{}, transitions...)

		savedKeys := map[ngmodels.AlertInstanceKey]ngmodels.AlertInstance{}
		for _, op := range st.RecordedOps {
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
}
