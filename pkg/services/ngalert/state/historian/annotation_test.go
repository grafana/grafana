package historian

import (
	"fmt"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/services/ngalert/eval"
	"github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/services/ngalert/state"
)

func TestShouldAnnotate(t *testing.T) {
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
		eval.Error.String(),
		eval.NoData.String(),
	}

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
		noTransition(eval.Normal, ""):                                {},
		noTransition(eval.Normal, eval.Error.String()):               {},
		noTransition(eval.Normal, eval.NoData.String()):              {},
		noTransition(eval.Normal, models.StateReasonMissingSeries):   {},
		noTransition(eval.Alerting, ""):                              {},
		noTransition(eval.Alerting, eval.Error.String()):             {},
		noTransition(eval.Alerting, eval.NoData.String()):            {},
		noTransition(eval.Alerting, models.StateReasonMissingSeries): {},
		noTransition(eval.Pending, ""):                               {},
		noTransition(eval.Pending, eval.Error.String()):              {},
		noTransition(eval.Pending, eval.NoData.String()):             {},
		noTransition(eval.Pending, models.StateReasonMissingSeries):  {},
		noTransition(eval.NoData, ""):                                {},
		noTransition(eval.NoData, eval.Error.String()):               {},
		noTransition(eval.NoData, eval.NoData.String()):              {},
		noTransition(eval.NoData, models.StateReasonMissingSeries):   {},
		noTransition(eval.Error, ""):                                 {},
		noTransition(eval.Error, eval.Error.String()):                {},
		noTransition(eval.Error, eval.NoData.String()):               {},
		noTransition(eval.Error, models.StateReasonMissingSeries):    {},

		transition(eval.Normal, "", eval.Normal, models.StateReasonMissingSeries):                   {},
		transition(eval.Normal, eval.Error.String(), eval.Normal, models.StateReasonMissingSeries):  {},
		transition(eval.Normal, eval.NoData.String(), eval.Normal, models.StateReasonMissingSeries): {},
	}

	for _, tc := range allCombinations {
		_, ok := negativeTransitions[tc]
		trans := state.StateTransition{
			State:               &state.State{State: tc.State, StateReason: tc.StateReason},
			PreviousState:       tc.PreviousState,
			PreviousStateReason: tc.PreviousStateReason,
		}

		t.Run(fmt.Sprintf("%s -> %s should be %v", trans.PreviousFormatted(), trans.Formatted(), !ok), func(t *testing.T) {
			require.Equal(t, !ok, shouldAnnotate(trans))
		})
	}
}
