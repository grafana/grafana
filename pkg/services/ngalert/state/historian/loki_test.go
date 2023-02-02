package historian

import (
	"encoding/json"
	"fmt"
	"sort"
	"testing"

	"github.com/grafana/grafana-plugin-sdk-go/data"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/ngalert/eval"
	"github.com/grafana/grafana/pkg/services/ngalert/state"
	history_model "github.com/grafana/grafana/pkg/services/ngalert/state/historian/model"
	"github.com/stretchr/testify/require"
)

func TestRemoteLokiBackend(t *testing.T) {
	t.Run("statesToStreams", func(t *testing.T) {
		t.Run("skips non-transitory states", func(t *testing.T) {
			rule := createTestRule()
			l := log.NewNopLogger()
			states := singleFromNormal(&state.State{State: eval.Normal})

			res := statesToStreams(rule, states, nil, l)

			require.Empty(t, res)
		})

		t.Run("maps evaluation errors", func(t *testing.T) {
			rule := createTestRule()
			l := log.NewNopLogger()
			states := singleFromNormal(&state.State{State: eval.Error, Error: fmt.Errorf("oh no")})

			res := statesToStreams(rule, states, nil, l)

			entry := requireSingleEntry(t, res)
			require.Contains(t, entry.Error, "oh no")
		})

		t.Run("maps NoData results", func(t *testing.T) {
			rule := createTestRule()
			l := log.NewNopLogger()
			states := singleFromNormal(&state.State{State: eval.NoData})

			res := statesToStreams(rule, states, nil, l)

			_ = requireSingleEntry(t, res)
		})

		t.Run("produces expected stream identifier", func(t *testing.T) {
			rule := createTestRule()
			l := log.NewNopLogger()
			states := singleFromNormal(&state.State{
				State:  eval.Alerting,
				Labels: data.Labels{"a": "b"},
			})

			res := statesToStreams(rule, states, nil, l)

			require.Len(t, res, 1)
			exp := map[string]string{
				StateHistoryLabel: StateHistoryLabelValue,
				"folderUID":       rule.NamespaceUID,
				"group":           rule.Group,
				"orgID":           fmt.Sprint(rule.OrgID),
				"ruleUID":         rule.UID,
				"a":               "b",
			}
			require.Equal(t, exp, res[0].Stream)
		})

		t.Run("groups streams based on combined labels", func(t *testing.T) {
			rule := createTestRule()
			l := log.NewNopLogger()
			states := []state.StateTransition{
				{
					PreviousState: eval.Normal,
					State: &state.State{
						State:  eval.Alerting,
						Labels: data.Labels{"a": "b"},
					},
				},
				{
					PreviousState: eval.Normal,
					State: &state.State{
						State:  eval.Alerting,
						Labels: data.Labels{"a": "b"},
					},
				},
				{
					PreviousState: eval.Normal,
					State: &state.State{
						State:  eval.Alerting,
						Labels: data.Labels{"c": "d"},
					},
				},
			}

			res := statesToStreams(rule, states, nil, l)

			require.Len(t, res, 2)
			sort.Slice(res, func(i, j int) bool { return len(res[i].Values) > len(res[j].Values) })
			require.Contains(t, res[0].Stream, "a")
			require.Len(t, res[0].Values, 2)
			require.Contains(t, res[1].Stream, "c")
			require.Len(t, res[1].Values, 1)
		})

		t.Run("excludes private labels", func(t *testing.T) {
			rule := createTestRule()
			l := log.NewNopLogger()
			states := singleFromNormal(&state.State{
				State:  eval.Alerting,
				Labels: data.Labels{"__private__": "b"},
			})

			res := statesToStreams(rule, states, nil, l)

			require.Len(t, res, 1)
			require.NotContains(t, res[0].Stream, "__private__")
		})

		t.Run("serializes values when regular", func(t *testing.T) {
			rule := createTestRule()
			l := log.NewNopLogger()
			states := singleFromNormal(&state.State{
				State:  eval.Alerting,
				Values: map[string]float64{"A": 2.0, "B": 5.5},
			})

			res := statesToStreams(rule, states, nil, l)

			entry := requireSingleEntry(t, res)
			require.NotNil(t, entry.Values)
			require.NotNil(t, entry.Values.Get("A"))
			require.NotNil(t, entry.Values.Get("B"))
			require.InDelta(t, 2.0, entry.Values.Get("A").MustFloat64(), 1e-4)
			require.InDelta(t, 5.5, entry.Values.Get("B").MustFloat64(), 1e-4)
		})
	})
}

func singleFromNormal(st *state.State) []state.StateTransition {
	return []state.StateTransition{
		{
			PreviousState: eval.Normal,
			State:         st,
		},
	}
}

func createTestRule() history_model.RuleMeta {
	return history_model.RuleMeta{
		OrgID:        1,
		UID:          "rule-uid",
		Group:        "my-group",
		NamespaceUID: "my-folder",
		DashboardUID: "dash-uid",
		PanelID:      123,
	}
}

func requireSingleEntry(t *testing.T, res []stream) lokiEntry {
	require.Len(t, res, 1)
	require.Len(t, res[0].Values, 1)
	return requireEntry(t, res[0].Values[0])
}

func requireEntry(t *testing.T, row row) lokiEntry {
	t.Helper()

	var entry lokiEntry
	err := json.Unmarshal([]byte(row.Val), &entry)
	require.NoError(t, err)
	return entry
}
