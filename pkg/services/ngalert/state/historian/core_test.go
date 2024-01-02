package historian

import (
	"fmt"
	"testing"

	"github.com/grafana/grafana-plugin-sdk-go/data"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/services/ngalert/eval"
	"github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/services/ngalert/state"
)

func TestShouldRecord(t *testing.T) {
	allStates := []eval.State{
		eval.Normal,
		eval.Alerting,
		eval.Pending,
		eval.NoData,
		eval.Error,
	}

	type Transition struct {
		State               eval.State
		StateReason         string
		PreviousState       eval.State
		PreviousStateReason string
	}

	transition := func(from eval.State, fromReason string, to eval.State, toReason string) Transition {
		return Transition{
			PreviousState:       from,
			PreviousStateReason: fromReason,
			State:               to,
			StateReason:         toReason,
		}
	}

	noTransition := func(state eval.State, stateReason string) Transition {
		return transition(state, stateReason, state, stateReason)
	}

	knownReasons := []string{
		"",
		models.StateReasonMissingSeries,
		models.StateReasonPaused,
		models.StateReasonUpdated,
		models.StateReasonRuleDeleted,
		eval.Error.String(),
		eval.NoData.String(),
	}

	// all combinations does not reflect the real transitions that could happen, which is a subset.
	allCombinations := make([]Transition, 0, len(allStates)*len(allStates)*len(knownReasons)*len(knownReasons))
	for _, from := range allStates {
		for _, reasonFrom := range knownReasons {
			for _, to := range allStates {
				for _, reasonTo := range knownReasons {
					allCombinations = append(allCombinations, transition(from, reasonFrom, to, reasonTo))
				}
			}
		}
	}

	negativeTransitions := map[Transition]struct{}{
		transition(eval.Normal, "", eval.Normal, models.StateReasonMissingSeries):                   {},
		transition(eval.Normal, eval.Error.String(), eval.Normal, models.StateReasonMissingSeries):  {},
		transition(eval.Normal, eval.NoData.String(), eval.Normal, models.StateReasonMissingSeries): {},

		transition(eval.Normal, models.StateReasonPaused, eval.Normal, ""):  {},
		transition(eval.Normal, models.StateReasonUpdated, eval.Normal, ""): {},

		// these transitions are actually not possible
		transition(eval.Normal, models.StateReasonRuleDeleted, eval.Normal, models.StateReasonMissingSeries): {},
		transition(eval.Normal, models.StateReasonPaused, eval.Normal, models.StateReasonMissingSeries):      {},
		transition(eval.Normal, models.StateReasonUpdated, eval.Normal, models.StateReasonMissingSeries):     {},
	}
	// add all transitions from reason X(Y) to X(Y) as negative.
	for _, s := range allStates {
		for _, reason := range knownReasons {
			negativeTransitions[noTransition(s, reason)] = struct{}{}
		}
	}

	for _, tc := range allCombinations {
		_, ok := negativeTransitions[tc]
		trans := state.StateTransition{
			State:               &state.State{State: tc.State, StateReason: tc.StateReason},
			PreviousState:       tc.PreviousState,
			PreviousStateReason: tc.PreviousStateReason,
		}

		t.Run(fmt.Sprintf("%s -> %s should be %v", trans.PreviousFormatted(), trans.Formatted(), !ok), func(t *testing.T) {
			require.Equal(t, !ok, shouldRecord(trans))
		})
	}
}

func TestShouldRecordAnnotation(t *testing.T) {
	transition := func(from eval.State, fromReason string, to eval.State, toReason string) state.StateTransition {
		return state.StateTransition{
			PreviousState:       from,
			PreviousStateReason: fromReason,
			State:               &state.State{State: to, StateReason: toReason},
		}
	}

	t.Run("transitions between Normal and Normal(NoData) not recorded", func(t *testing.T) {
		forward := transition(eval.Normal, "", eval.Normal, models.StateReasonNoData)
		backward := transition(eval.Normal, models.StateReasonNoData, eval.Normal, "")

		require.False(t, ShouldRecordAnnotation(forward), "Normal -> Normal(NoData) should be false")
		require.False(t, ShouldRecordAnnotation(backward), "Normal(NoData) -> Normal should be false")
	})

	t.Run("other Normal transitions involving NoData still recorded", func(t *testing.T) {
		pauseForward := transition(eval.Normal, models.StateReasonNoData, eval.Normal, models.StateReasonPaused)
		pauseBackward := transition(eval.Normal, models.StateReasonPaused, eval.Normal, models.StateReasonNoData)
		errorForward := transition(eval.Normal, models.StateReasonNoData, eval.Normal, models.StateReasonError)
		errorBackward := transition(eval.Normal, models.StateReasonError, eval.Normal, models.StateReasonNoData)
		missingSeriesBackward := transition(eval.Normal, models.StateReasonMissingSeries, eval.Normal, models.StateReasonNoData)

		require.True(t, ShouldRecordAnnotation(pauseForward), "Normal(NoData) -> Normal(Paused) should be true")
		require.True(t, ShouldRecordAnnotation(pauseBackward), "Normal(Paused) -> Normal(NoData) should be true")
		require.True(t, ShouldRecordAnnotation(errorForward), "Normal(NoData) -> Normal(Error) should be true")
		require.True(t, ShouldRecordAnnotation(errorBackward), "Normal(Error) -> Normal(NoData) should be true")
		require.True(t, ShouldRecordAnnotation(missingSeriesBackward), "Normal(MissingSeries) -> Normal(NoData) should be true")
	})

	t.Run("respects filters in shouldRecord()", func(t *testing.T) {
		missingSeries := transition(eval.Normal, "", eval.Normal, models.StateReasonMissingSeries)
		unpause := transition(eval.Normal, models.StateReasonPaused, eval.Normal, "")
		afterUpdate := transition(eval.Normal, models.StateReasonUpdated, eval.Normal, "")

		require.False(t, ShouldRecordAnnotation(missingSeries), "Normal -> Normal(MissingSeries) should be false")
		require.False(t, ShouldRecordAnnotation(unpause), "Normal(Paused) -> Normal should be false")
		require.False(t, ShouldRecordAnnotation(afterUpdate), "Normal(Updated) -> Normal should be false")

		// Smoke test a few basic ones, exhaustive tests for shouldRecord() already exist elsewhere.
		basicPending := transition(eval.Normal, "", eval.Pending, "")
		basicAlerting := transition(eval.Pending, "", eval.Alerting, "")
		basicResolve := transition(eval.Alerting, "", eval.Normal, "")
		basicError := transition(eval.Normal, "", eval.Error, "")
		require.True(t, ShouldRecordAnnotation(basicPending), "Normal -> Pending should be true")
		require.True(t, ShouldRecordAnnotation(basicAlerting), "Pending -> Alerting should be true")
		require.True(t, ShouldRecordAnnotation(basicResolve), "Alerting -> Normal should be true")
		require.True(t, ShouldRecordAnnotation(basicError), "Normal -> Error should be true")
	})
}

func TestRemovePrivateLabels(t *testing.T) {
	type testCase struct {
		name string
		in   data.Labels
		exp  data.Labels
	}

	cases := []testCase{
		{
			name: "empty",
			in:   map[string]string{},
			exp:  map[string]string{},
		},
		{
			name: "nil",
			in:   nil,
			exp:  map[string]string{},
		},
		{
			name: "prefix",
			in:   map[string]string{"__asdf": "one", "b": "c"},
			exp:  map[string]string{"b": "c"},
		},
		{
			name: "suffix",
			in:   map[string]string{"asdf__": "one", "b": "c"},
			exp:  map[string]string{"b": "c"},
		},
		{
			name: "both",
			in:   map[string]string{"__asdf__": "one", "b": "c"},
			exp:  map[string]string{"b": "c"},
		},
		{
			name: "all",
			in:   map[string]string{"__a__": "a", "__b": "b", "c__": "c"},
			exp:  map[string]string{},
		},
		{
			name: "whitespace",
			in:   map[string]string{"  __asdf__ ": "one", "b": "c"},
			exp:  map[string]string{"  __asdf__ ": "one", "b": "c"},
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			res := removePrivateLabels(tc.in)
			require.Equal(t, tc.exp, res)
		})
	}
}
