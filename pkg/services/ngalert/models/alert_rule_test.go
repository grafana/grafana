package models

import (
	"encoding/json"
	"math/rand"
	"strings"
	"testing"
	"time"

	"github.com/google/go-cmp/cmp"
	"github.com/stretchr/testify/assert"
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

func TestDiff(t *testing.T) {
	t.Run("should return nil if there is no diff", func(t *testing.T) {
		rule1 := AlertRuleGen()()
		rule2 := CopyRule(rule1)
		result := rule1.Diff(rule2)
		require.Emptyf(t, result, "expected diff to be empty. rule1: %#v, rule2: %#v\ndiff: %s", rule1, rule2, result)
	})

	t.Run("should respect fields to ignore", func(t *testing.T) {
		rule1 := AlertRuleGen()()
		rule2 := CopyRule(rule1)
		rule2.ID = rule1.ID/2 + 1
		rule2.Version = rule1.Version/2 + 1
		rule2.Updated = rule1.Updated.Add(1 * time.Second)
		result := rule1.Diff(rule2, "ID", "Version", "Updated")
		require.Emptyf(t, result, "expected diff to be empty. rule1: %#v, rule2: %#v\ndiff: %s", rule1, rule2, result)
	})

	t.Run("should find diff in simple fields", func(t *testing.T) {
		rule1 := AlertRuleGen()()
		rule2 := AlertRuleGen()()

		diffs := rule1.Diff(rule2, "Data", "Annotations", "Labels") // these fields will be tested separately

		difCnt := 0
		if rule1.ID != rule2.ID {
			diff := diffs.GetDiffsForField("ID")
			assert.Len(t, diff, 1)
			assert.Equal(t, rule1.ID, diff[0].Left.Int())
			assert.Equal(t, rule2.ID, diff[0].Right.Int())
			difCnt++
		}
		if rule1.OrgID != rule2.OrgID {
			diff := diffs.GetDiffsForField("OrgID")
			assert.Len(t, diff, 1)
			assert.Equal(t, rule1.OrgID, diff[0].Left.Int())
			assert.Equal(t, rule2.OrgID, diff[0].Right.Int())
			difCnt++
		}
		if rule1.Title != rule2.Title {
			diff := diffs.GetDiffsForField("Title")
			assert.Len(t, diff, 1)
			assert.Equal(t, rule1.Title, diff[0].Left.String())
			assert.Equal(t, rule2.Title, diff[0].Right.String())
			difCnt++
		}
		if rule1.Condition != rule2.Condition {
			diff := diffs.GetDiffsForField("Condition")
			assert.Len(t, diff, 1)
			assert.Equal(t, rule1.Condition, diff[0].Left.String())
			assert.Equal(t, rule2.Condition, diff[0].Right.String())
			difCnt++
		}
		if rule1.Updated != rule2.Updated {
			diff := diffs.GetDiffsForField("Updated")
			assert.Len(t, diff, 1)
			assert.Equal(t, rule1.Updated, diff[0].Left.Interface())
			assert.Equal(t, rule2.Updated, diff[0].Right.Interface())
			difCnt++
		}
		if rule1.IntervalSeconds != rule2.IntervalSeconds {
			diff := diffs.GetDiffsForField("IntervalSeconds")
			assert.Len(t, diff, 1)
			assert.Equal(t, rule1.IntervalSeconds, diff[0].Left.Int())
			assert.Equal(t, rule2.IntervalSeconds, diff[0].Right.Int())
			difCnt++
		}
		if rule1.Version != rule2.Version {
			diff := diffs.GetDiffsForField("Version")
			assert.Len(t, diff, 1)
			assert.Equal(t, rule1.Version, diff[0].Left.Int())
			assert.Equal(t, rule2.Version, diff[0].Right.Int())
			difCnt++
		}
		if rule1.UID != rule2.UID {
			diff := diffs.GetDiffsForField("UID")
			assert.Len(t, diff, 1)
			assert.Equal(t, rule1.UID, diff[0].Left.String())
			assert.Equal(t, rule2.UID, diff[0].Right.String())
			difCnt++
		}
		if rule1.NamespaceUID != rule2.NamespaceUID {
			diff := diffs.GetDiffsForField("NamespaceUID")
			assert.Len(t, diff, 1)
			assert.Equal(t, rule1.NamespaceUID, diff[0].Left.String())
			assert.Equal(t, rule2.NamespaceUID, diff[0].Right.String())
			difCnt++
		}
		if rule1.DashboardUID != rule2.DashboardUID {
			diff := diffs.GetDiffsForField("DashboardUID")
			assert.Len(t, diff, 1)
			difCnt++
		}
		if rule1.PanelID != rule2.PanelID {
			diff := diffs.GetDiffsForField("PanelID")
			assert.Len(t, diff, 1)
			difCnt++
		}
		if rule1.RuleGroup != rule2.RuleGroup {
			diff := diffs.GetDiffsForField("RuleGroup")
			assert.Len(t, diff, 1)
			assert.Equal(t, rule1.RuleGroup, diff[0].Left.String())
			assert.Equal(t, rule2.RuleGroup, diff[0].Right.String())
			difCnt++
		}
		if rule1.NoDataState != rule2.NoDataState {
			diff := diffs.GetDiffsForField("NoDataState")
			assert.Len(t, diff, 1)
			assert.Equal(t, rule1.NoDataState, diff[0].Left.Interface())
			assert.Equal(t, rule2.NoDataState, diff[0].Right.Interface())
			difCnt++
		}
		if rule1.ExecErrState != rule2.ExecErrState {
			diff := diffs.GetDiffsForField("ExecErrState")
			assert.Len(t, diff, 1)
			assert.Equal(t, rule1.ExecErrState, diff[0].Left.Interface())
			assert.Equal(t, rule2.ExecErrState, diff[0].Right.Interface())
			difCnt++
		}
		if rule1.For != rule2.For {
			diff := diffs.GetDiffsForField("For")
			assert.Len(t, diff, 1)
			assert.Equal(t, rule1.For, diff[0].Left.Interface())
			assert.Equal(t, rule2.For, diff[0].Right.Interface())
			difCnt++
		}

		require.Lenf(t, diffs, difCnt, "Got some unexpected diffs. Either add to ignore or add assert to it")

		if t.Failed() {
			t.Logf("rule1: %#v, rule2: %#v\ndiff: %s", rule1, rule2, diffs)
		}
	})

	t.Run("should detect changes in Annotations", func(t *testing.T) {
		rule1 := AlertRuleGen()()
		rule2 := CopyRule(rule1)

		rule1.Annotations = map[string]string{
			"key1": "value1",
			"key2": "value2",
		}

		rule2.Annotations = map[string]string{
			"key2": "value22",
			"key3": "value3",
		}
		diff := rule1.Diff(rule2)

		assert.Len(t, diff, 3)

		d := diff.GetDiffsForField("Annotations[key1]")
		assert.Len(t, d, 1)
		assert.Equal(t, "value1", d[0].Left.String())
		assert.False(t, d[0].Right.IsValid())

		d = diff.GetDiffsForField("Annotations[key2]")
		assert.Len(t, d, 1)
		assert.Equal(t, "value2", d[0].Left.String())
		assert.Equal(t, "value22", d[0].Right.String())

		d = diff.GetDiffsForField("Annotations[key3]")
		assert.Len(t, d, 1)
		assert.False(t, d[0].Left.IsValid())
		assert.Equal(t, "value3", d[0].Right.String())

		if t.Failed() {
			t.Logf("rule1: %#v, rule2: %#v\ndiff: %v", rule1, rule2, diff)
		}
	})

	t.Run("should detect changes in Labels", func(t *testing.T) {
		rule1 := AlertRuleGen()()
		rule2 := CopyRule(rule1)

		rule1.Labels = map[string]string{
			"key1": "value1",
			"key2": "value2",
		}

		rule2.Labels = map[string]string{
			"key2": "value22",
			"key3": "value3",
		}
		diff := rule1.Diff(rule2)

		assert.Len(t, diff, 3)

		d := diff.GetDiffsForField("Labels[key1]")
		assert.Len(t, d, 1)
		assert.Equal(t, "value1", d[0].Left.String())
		assert.False(t, d[0].Right.IsValid())

		d = diff.GetDiffsForField("Labels[key2]")
		assert.Len(t, d, 1)
		assert.Equal(t, "value2", d[0].Left.String())
		assert.Equal(t, "value22", d[0].Right.String())

		d = diff.GetDiffsForField("Labels[key3]")
		assert.Len(t, d, 1)
		assert.False(t, d[0].Left.IsValid())
		assert.Equal(t, "value3", d[0].Right.String())

		if t.Failed() {
			t.Logf("rule1: %#v, rule2: %#v\ndiff: %s", rule1, rule2, d)
		}
	})

	t.Run("should detect changes in Data", func(t *testing.T) {
		rule1 := AlertRuleGen()()
		rule2 := CopyRule(rule1)

		query1 := AlertQuery{
			RefID:     "A",
			QueryType: util.GenerateShortUID(),
			RelativeTimeRange: RelativeTimeRange{
				From: Duration(5 * time.Hour),
				To:   0,
			},
			DatasourceUID: util.GenerateShortUID(),
			Model:         json.RawMessage(`{ "test": "data"}`),
			modelProps: map[string]interface{}{
				"test": 1,
			},
		}

		rule1.Data = []AlertQuery{query1}

		t.Run("should ignore modelProps", func(t *testing.T) {
			query2 := query1
			query2.modelProps = map[string]interface{}{
				"some": "other value",
			}
			rule2.Data = []AlertQuery{query2}

			diff := rule1.Diff(rule2)

			assert.Nil(t, diff)

			if t.Failed() {
				t.Logf("rule1: %#v, rule2: %#v\ndiff: %v", rule1, rule2, diff)
			}
		})

		t.Run("should detect changes inside the query", func(t *testing.T) {
			query2 := query1
			query2.QueryType = "test"
			query2.RefID = "test"
			rule2.Data = []AlertQuery{query2}

			diff := rule1.Diff(rule2)

			assert.Len(t, diff, 2)

			d := diff.GetDiffsForField("Data[0].QueryType")
			assert.Len(t, d, 1)
			d = diff.GetDiffsForField("Data[0].RefID")
			assert.Len(t, d, 1)
			if t.Failed() {
				t.Logf("rule1: %#v, rule2: %#v\ndiff: %v", rule1, rule2, diff)
			}
		})

		t.Run("should detect new changes in array if too many fields changed", func(t *testing.T) {
			query2 := query1
			query2.QueryType = "test"
			query2.RefID = "test"
			query2.DatasourceUID = "test"
			query2.Model = json.RawMessage(`{ "test": "da2ta"}`)

			rule2.Data = []AlertQuery{query2}

			diff := rule1.Diff(rule2)

			assert.Len(t, diff, 2)

			for _, d := range diff {
				assert.Equal(t, "Data", d.Path)
				if d.Left.IsValid() {
					assert.Equal(t, query1, d.Left.Interface())
				} else {
					assert.Equal(t, query2, d.Right.Interface())
				}
			}
			if t.Failed() {
				t.Logf("rule1: %#v, rule2: %#v\ndiff: %v", rule1, rule2, diff)
			}
		})
	})
}
