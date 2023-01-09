package historian

import (
	"fmt"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana-plugin-sdk-go/data"
	"github.com/grafana/grafana/pkg/infra/log"
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
			require.Equal(t, !ok, shouldRecord(trans))
		})
	}
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

func TestParsePanelKey(t *testing.T) {
	logger := log.NewNopLogger()

	type testCase struct {
		name string
		in   models.AlertRule
		exp  *panelKey
	}

	cases := []testCase{
		{
			name: "no dash UID",
			in: models.AlertRule{
				OrgID: 1,
				Annotations: map[string]string{
					models.PanelIDAnnotation: "123",
				},
			},
			exp: nil,
		},
		{
			name: "no panel ID",
			in: models.AlertRule{
				OrgID: 1,
				Annotations: map[string]string{
					models.DashboardUIDAnnotation: "abcd-uid",
				},
			},
			exp: nil,
		},
		{
			name: "invalid panel ID",
			in: models.AlertRule{
				OrgID: 1,
				Annotations: map[string]string{
					models.DashboardUIDAnnotation: "abcd-uid",
					models.PanelIDAnnotation:      "bad-id",
				},
			},
			exp: nil,
		},
		{
			name: "success",
			in: models.AlertRule{
				OrgID: 1,
				Annotations: map[string]string{
					models.DashboardUIDAnnotation: "abcd-uid",
					models.PanelIDAnnotation:      "123",
				},
			},
			exp: &panelKey{
				orgID:   1,
				dashUID: "abcd-uid",
				panelID: 123,
			},
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			res := parsePanelKey(&tc.in, logger)
			require.Equal(t, tc.exp, res)
		})
	}
}
