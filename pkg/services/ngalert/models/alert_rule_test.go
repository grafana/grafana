package models

import (
	"math/rand"
	"strings"
	"testing"
	"time"

	"github.com/google/go-cmp/cmp"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/util"
)

func TestNoDataStateFromString(t *testing.T) {
	allKnownNoDataStates := [...]NoDataState{
		Alerting,
		NoData,
		OK,
	}

	t.Run("should parse known values", func(t *testing.T) {
		for _, state := range allKnownNoDataStates {
			stateStr := string(state)
			actual, err := NoDataStateFromString(stateStr)
			require.NoErrorf(t, err, "failed to parse a known state [%s]", stateStr)
			require.Equal(t, state, actual)
		}
	})

	t.Run("should fail to parse in different case", func(t *testing.T) {
		for _, state := range allKnownNoDataStates {
			stateStr := strings.ToLower(string(state))
			actual, err := NoDataStateFromString(stateStr)
			require.Errorf(t, err, "expected error for input value [%s]", stateStr)
			require.Equal(t, NoDataState(""), actual)
		}
	})

	t.Run("should fail to parse unknown values", func(t *testing.T) {
		input := util.GenerateShortUID()
		actual, err := NoDataStateFromString(input)
		require.Errorf(t, err, "expected error for input value [%s]", input)
		require.Equal(t, NoDataState(""), actual)
	})
}

func TestErrStateFromString(t *testing.T) {
	allKnownErrStates := [...]ExecutionErrorState{
		AlertingErrState,
		ErrorErrState,
		OkErrState,
	}

	t.Run("should parse known values", func(t *testing.T) {
		for _, state := range allKnownErrStates {
			stateStr := string(state)
			actual, err := ErrStateFromString(stateStr)
			require.NoErrorf(t, err, "failed to parse a known state [%s]", stateStr)
			require.Equal(t, state, actual)
		}
	})

	t.Run("should fail to parse in different case", func(t *testing.T) {
		for _, state := range allKnownErrStates {
			stateStr := strings.ToLower(string(state))
			actual, err := ErrStateFromString(stateStr)
			require.Errorf(t, err, "expected error for input value [%s]", stateStr)
			require.Equal(t, ExecutionErrorState(""), actual)
		}
	})

	t.Run("should fail to parse unknown values", func(t *testing.T) {
		input := util.GenerateShortUID()
		actual, err := ErrStateFromString(input)
		require.Errorf(t, err, "expected error for input value [%s]", input)
		require.Equal(t, ExecutionErrorState(""), actual)
	})
}

func TestPatchPartialAlertRule(t *testing.T) {
	t.Run("patches", func(t *testing.T) {
		testCases := []struct {
			name    string
			mutator func(r *AlertRule)
		}{
			{
				name: "title is empty",
				mutator: func(r *AlertRule) {
					r.Title = ""
				},
			},
			{
				name: "condition and data are empty",
				mutator: func(r *AlertRule) {
					r.Condition = ""
					r.Data = nil
				},
			},
			{
				name: "ExecErrState is empty",
				mutator: func(r *AlertRule) {
					r.ExecErrState = ""
				},
			},
			{
				name: "NoDataState is empty",
				mutator: func(r *AlertRule) {
					r.NoDataState = ""
				},
			},
			{
				name: "For is 0",
				mutator: func(r *AlertRule) {
					r.For = 0
				},
			},
		}

		for _, testCase := range testCases {
			t.Run(testCase.name, func(t *testing.T) {
				var existing *AlertRule
				for {
					existing = AlertRuleGen(func(rule *AlertRule) {
						rule.For = time.Duration(rand.Int63n(1000) + 1)
					})()
					cloned := *existing
					testCase.mutator(&cloned)
					if !cmp.Equal(*existing, cloned, cmp.FilterPath(func(path cmp.Path) bool {
						return path.String() == "Data.modelProps"
					}, cmp.Ignore())) {
						break
					}
				}
				patch := *existing
				testCase.mutator(&patch)

				require.NotEqual(t, *existing, patch)
				PatchPartialAlertRule(existing, &patch)
				require.Equal(t, *existing, patch)
			})
		}
	})

	t.Run("does not patch", func(t *testing.T) {
		testCases := []struct {
			name    string
			mutator func(r *AlertRule)
		}{
			{
				name: "ID",
				mutator: func(r *AlertRule) {
					r.ID = 0
				},
			},
			{
				name: "OrgID",
				mutator: func(r *AlertRule) {
					r.OrgID = 0
				},
			},
			{
				name: "Updated",
				mutator: func(r *AlertRule) {
					r.Updated = time.Time{}
				},
			},
			{
				name: "Version",
				mutator: func(r *AlertRule) {
					r.Version = 0
				},
			},
			{
				name: "UID",
				mutator: func(r *AlertRule) {
					r.UID = ""
				},
			},
			{
				name: "DashboardUID",
				mutator: func(r *AlertRule) {
					r.DashboardUID = nil
				},
			},
			{
				name: "PanelID",
				mutator: func(r *AlertRule) {
					r.PanelID = nil
				},
			},
			{
				name: "Annotations",
				mutator: func(r *AlertRule) {
					r.Annotations = nil
				},
			},
			{
				name: "Labels",
				mutator: func(r *AlertRule) {
					r.Labels = nil
				},
			},
		}

		for _, testCase := range testCases {
			t.Run(testCase.name, func(t *testing.T) {
				var existing *AlertRule
				for {
					existing = AlertRuleGen()()
					cloned := *existing
					// make sure the generated rule does not match the mutated one
					testCase.mutator(&cloned)
					if !cmp.Equal(*existing, cloned, cmp.FilterPath(func(path cmp.Path) bool {
						return path.String() == "Data.modelProps"
					}, cmp.Ignore())) {
						break
					}
				}
				patch := *existing
				testCase.mutator(&patch)
				PatchPartialAlertRule(existing, &patch)
				require.NotEqual(t, *existing, patch)
			})
		}
	})
}
