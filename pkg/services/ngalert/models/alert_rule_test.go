package models

import (
	"encoding/json"
	"fmt"
	"math/rand"
	"reflect"
	"sort"
	"strings"
	"testing"
	"time"

	"github.com/google/go-cmp/cmp"
	"github.com/google/go-cmp/cmp/cmpopts"
	"github.com/prometheus/common/model"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"golang.org/x/exp/maps"
	"gopkg.in/yaml.v3"

	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/util"
	"github.com/grafana/grafana/pkg/util/cmputil"
)

func TestSortAlertRulesByGroupKeyAndIndex(t *testing.T) {
	tc := []struct {
		name     string
		input    []*AlertRule
		expected []*AlertRule
	}{{
		name: "alert rules are ordered by organization",
		input: []*AlertRule{
			{OrgID: 2, NamespaceUID: "test2"},
			{OrgID: 1, NamespaceUID: "test1"},
		},
		expected: []*AlertRule{
			{OrgID: 1, NamespaceUID: "test1"},
			{OrgID: 2, NamespaceUID: "test2"},
		},
	}, {
		name: "alert rules in same organization are ordered by namespace",
		input: []*AlertRule{
			{OrgID: 1, NamespaceUID: "test2"},
			{OrgID: 1, NamespaceUID: "test1"},
		},
		expected: []*AlertRule{
			{OrgID: 1, NamespaceUID: "test1"},
			{OrgID: 1, NamespaceUID: "test2"},
		},
	}, {
		name: "alert rules with same group key are ordered by index",
		input: []*AlertRule{
			{OrgID: 1, NamespaceUID: "test", RuleGroupIndex: 2},
			{OrgID: 1, NamespaceUID: "test", RuleGroupIndex: 1},
		},
		expected: []*AlertRule{
			{OrgID: 1, NamespaceUID: "test", RuleGroupIndex: 1},
			{OrgID: 1, NamespaceUID: "test", RuleGroupIndex: 2},
		},
	}}

	for _, tt := range tc {
		t.Run(tt.name, func(t *testing.T) {
			AlertRulesBy(AlertRulesByGroupKeyAndIndex).Sort(tt.input)
			assert.EqualValues(t, tt.expected, tt.input)
		})
	}
}

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

func TestSetDashboardAndPanelFromAnnotations(t *testing.T) {
	testCases := []struct {
		name                 string
		annotations          map[string]string
		expectedError        error
		expectedErrContains  string
		expectedDashboardUID string
		expectedPanelID      int64
	}{
		{
			name:                 "annotations is empty",
			annotations:          nil,
			expectedError:        nil,
			expectedDashboardUID: "",
			expectedPanelID:      -1,
		},
		{
			name:                 "dashboardUID is not present",
			annotations:          map[string]string{PanelIDAnnotation: "1234567890"},
			expectedError:        ErrAlertRuleFailedValidation,
			expectedErrContains:  fmt.Sprintf("%s and %s", DashboardUIDAnnotation, PanelIDAnnotation),
			expectedDashboardUID: "",
			expectedPanelID:      -1,
		},
		{
			name:                 "dashboardUID is present but empty",
			annotations:          map[string]string{DashboardUIDAnnotation: "", PanelIDAnnotation: "1234567890"},
			expectedError:        ErrAlertRuleFailedValidation,
			expectedErrContains:  fmt.Sprintf("%s and %s", DashboardUIDAnnotation, PanelIDAnnotation),
			expectedDashboardUID: "",
			expectedPanelID:      -1,
		},
		{
			name:                 "panelID is not present",
			annotations:          map[string]string{DashboardUIDAnnotation: "cKy7f6Hk"},
			expectedError:        ErrAlertRuleFailedValidation,
			expectedErrContains:  fmt.Sprintf("%s and %s", DashboardUIDAnnotation, PanelIDAnnotation),
			expectedDashboardUID: "",
			expectedPanelID:      -1,
		},
		{
			name:                 "panelID is present but empty",
			annotations:          map[string]string{DashboardUIDAnnotation: "cKy7f6Hk", PanelIDAnnotation: ""},
			expectedError:        ErrAlertRuleFailedValidation,
			expectedErrContains:  fmt.Sprintf("%s and %s", DashboardUIDAnnotation, PanelIDAnnotation),
			expectedDashboardUID: "",
			expectedPanelID:      -1,
		},
		{
			name:                 "dashboardUID and panelID are present but panelID is not a correct int64",
			annotations:          map[string]string{DashboardUIDAnnotation: "cKy7f6Hk", PanelIDAnnotation: "fgh"},
			expectedError:        ErrAlertRuleFailedValidation,
			expectedErrContains:  PanelIDAnnotation,
			expectedDashboardUID: "",
			expectedPanelID:      -1,
		},
		{
			name:                 "dashboardUID and panelID are present and correct",
			annotations:          map[string]string{DashboardUIDAnnotation: "cKy7f6Hk", PanelIDAnnotation: "65"},
			expectedError:        nil,
			expectedDashboardUID: "cKy7f6Hk",
			expectedPanelID:      65,
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			rule := RuleGen.With(
				RuleMuts.WithDashboardAndPanel(nil, nil),
				RuleMuts.WithAnnotations(tc.annotations),
			).Generate()
			err := rule.SetDashboardAndPanelFromAnnotations()

			require.ErrorIs(t, err, tc.expectedError)
			if tc.expectedErrContains != "" {
				require.ErrorContains(t, err, tc.expectedErrContains)
			}
			require.Equal(t, tc.expectedDashboardUID, rule.GetDashboardUID())
			require.Equal(t, tc.expectedPanelID, rule.GetPanelID())
		})
	}
}

func TestPatchPartialAlertRule(t *testing.T) {
	t.Run("patches", func(t *testing.T) {
		testCases := []struct {
			name    string
			mutator func(r *AlertRuleWithOptionals)
		}{
			{
				name: "title is empty",
				mutator: func(r *AlertRuleWithOptionals) {
					r.Title = ""
				},
			},
			{
				name: "condition and data are empty",
				mutator: func(r *AlertRuleWithOptionals) {
					r.Condition = ""
					r.Data = nil
				},
			},
			{
				name: "ExecErrState is empty",
				mutator: func(r *AlertRuleWithOptionals) {
					r.ExecErrState = ""
				},
			},
			{
				name: "NoDataState is empty",
				mutator: func(r *AlertRuleWithOptionals) {
					r.NoDataState = ""
				},
			},
			{
				name: "For is -1",
				mutator: func(r *AlertRuleWithOptionals) {
					r.For = -1
				},
			},
			{
				name: "IsPaused did not come in request",
				mutator: func(r *AlertRuleWithOptionals) {
					r.IsPaused = true
				},
			},
			{
				name: "No metadata",
				mutator: func(r *AlertRuleWithOptionals) {
					r.Metadata = AlertRuleMetadata{}
					r.HasEditorSettings = false
				},
			},
		}

		gen := RuleGen.With(
			RuleMuts.WithFor(time.Duration(rand.Int63n(1000)+1)),
			RuleMuts.WithEditorSettingsSimplifiedQueryAndExpressionsSection(true),
		)

		for _, testCase := range testCases {
			t.Run(testCase.name, func(t *testing.T) {
				var existing *AlertRuleWithOptionals
				for i := 0; i < 10; i++ {
					rule := gen.Generate()
					existing = &AlertRuleWithOptionals{AlertRule: rule}
					cloned := *existing
					testCase.mutator(&cloned)
					if !cmp.Equal(existing, cloned, cmp.FilterPath(func(path cmp.Path) bool {
						return path.String() == "Data.modelProps"
					}, cmp.Ignore())) {
						break
					}
				}
				patch := *existing
				testCase.mutator(&patch)

				require.NotEqual(t, *existing, patch)
				PatchPartialAlertRule(&existing.AlertRule, &patch)
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

		gen := RuleGen.With(
			RuleMuts.WithUniqueID(),
			RuleMuts.WithFor(time.Duration(rand.Int63n(1000)+1)),
		)

		for _, testCase := range testCases {
			t.Run(testCase.name, func(t *testing.T) {
				var existing *AlertRule
				for {
					existing = gen.GenerateRef()
					cloned := CopyRule(existing)
					// make sure the generated rule does not match the mutated one
					testCase.mutator(cloned)
					if !cmp.Equal(existing, cloned, cmp.FilterPath(func(path cmp.Path) bool {
						return path.String() == "Data.modelProps"
					}, cmp.Ignore())) {
						break
					}
				}
				patch := AlertRuleWithOptionals{AlertRule: *existing}
				testCase.mutator(&patch.AlertRule)
				PatchPartialAlertRule(existing, &patch)
				require.NotEqual(t, *existing, &patch.AlertRule)
			})
		}
	})
}

// nolint:gocyclo
func TestDiff(t *testing.T) {
	t.Run("should return nil if there is no diff", func(t *testing.T) {
		rule1 := RuleGen.GenerateRef()
		rule2 := CopyRule(rule1)
		result := rule1.Diff(rule2)
		require.Emptyf(t, result, "expected diff to be empty. rule1: %#v, rule2: %#v\ndiff: %s", rule1, rule2, result)
	})

	t.Run("should respect fields to ignore", func(t *testing.T) {
		rule1 := RuleGen.GenerateRef()
		rule2 := CopyRule(rule1)
		rule2.ID = rule1.ID/2 + 1
		rule2.Version = rule1.Version/2 + 1
		rule2.Updated = rule1.Updated.Add(1 * time.Second)
		result := rule1.Diff(rule2, "ID", "Version", "Updated")
		require.Emptyf(t, result, "expected diff to be empty. rule1: %#v, rule2: %#v\ndiff: %s", rule1, rule2, result)
	})

	t.Run("should find diff in simple fields", func(t *testing.T) {
		rule1 := RuleGen.GenerateRef()
		rule2 := RuleGen.With(
			RuleGen.WithMissingSeriesEvalsToResolve(*rule1.MissingSeriesEvalsToResolve + 1),
		).GenerateRef()

		diffs := rule1.Diff(rule2, "Data", "Annotations", "Labels", "NotificationSettings", "Metadata") // these fields will be tested separately

		difCnt := 0
		if rule1.ID != rule2.ID {
			diff := diffs.GetDiffsForField("ID")
			assert.Len(t, diff, 1)
			assert.Equal(t, rule1.ID, diff[0].Left.Int())
			assert.Equal(t, rule2.ID, diff[0].Right.Int())
			difCnt++
		}

		if rule1.GUID != rule2.GUID {
			diff := diffs.GetDiffsForField("GUID")
			assert.Len(t, diff, 1)
			assert.Equal(t, rule1.GUID, diff[0].Left.String())
			assert.Equal(t, rule2.GUID, diff[0].Right.String())
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
		if rule1.UpdatedBy != rule2.UpdatedBy {
			diff := diffs.GetDiffsForField("UpdatedBy")
			assert.Len(t, diff, 1)
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
		if rule1.KeepFiringFor != rule2.KeepFiringFor {
			diff := diffs.GetDiffsForField("KeepFiringFor")
			assert.Len(t, diff, 1)
			assert.Equal(t, rule1.KeepFiringFor, diff[0].Left.Interface())
			assert.Equal(t, rule2.KeepFiringFor, diff[0].Right.Interface())
			difCnt++
		}
		if rule1.RuleGroupIndex != rule2.RuleGroupIndex {
			diff := diffs.GetDiffsForField("RuleGroupIndex")
			assert.Len(t, diff, 1)
			assert.Equal(t, rule1.RuleGroupIndex, diff[0].Left.Interface())
			assert.Equal(t, rule2.RuleGroupIndex, diff[0].Right.Interface())
			difCnt++
		}
		if rule1.Record != rule2.Record {
			diff := diffs.GetDiffsForField("Record")
			assert.Len(t, diff, 1)
			assert.Equal(t, rule1.Record, diff[0].Left.String())
			assert.Equal(t, rule2.Record, diff[0].Right.String())
			difCnt++
		}
		if rule1.MissingSeriesEvalsToResolve != rule2.MissingSeriesEvalsToResolve {
			diff := diffs.GetDiffsForField("MissingSeriesEvalsToResolve")
			assert.Len(t, diff, 1)
			assert.Equal(t, *rule1.MissingSeriesEvalsToResolve, diff[0].Left.Int())
			assert.Equal(t, *rule2.MissingSeriesEvalsToResolve, diff[0].Right.Int())
			difCnt++
		}

		require.Lenf(t, diffs, difCnt, "Got some unexpected diffs. Either add to ignore or add assert to it")

		if t.Failed() {
			t.Logf("rule1: %#v, rule2: %#v\ndiff: %s", rule1, rule2, diffs)
		}
	})

	t.Run("should not see difference between nil and empty Annotations", func(t *testing.T) {
		rule1 := RuleGen.GenerateRef()
		rule1.Annotations = make(map[string]string)
		rule2 := CopyRule(rule1)
		rule2.Annotations = nil

		diff := rule1.Diff(rule2)
		require.Empty(t, diff)
	})

	t.Run("should detect changes in Annotations", func(t *testing.T) {
		rule1 := RuleGen.GenerateRef()
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

	t.Run("should not see difference between nil and empty Labels", func(t *testing.T) {
		rule1 := RuleGen.GenerateRef()
		rule1.Annotations = make(map[string]string)
		rule2 := CopyRule(rule1)
		rule2.Annotations = nil

		diff := rule1.Diff(rule2)
		require.Empty(t, diff)
	})

	t.Run("should detect changes in Labels", func(t *testing.T) {
		rule1 := RuleGen.GenerateRef()
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
		rule1 := RuleGen.GenerateRef()
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
			modelProps: map[string]any{
				"test": 1,
			},
		}

		rule1.Data = []AlertQuery{query1}

		t.Run("should ignore modelProps", func(t *testing.T) {
			query2 := query1
			query2.modelProps = map[string]any{
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

		t.Run("should correctly detect no change with '<' and '>' in query", func(t *testing.T) {
			old := query1
			newQuery := query1
			old.Model = json.RawMessage(`{"field1": "$A \u003c 1"}`)
			newQuery.Model = json.RawMessage(`{"field1": "$A < 1"}`)
			rule1.Data = []AlertQuery{old}
			rule2.Data = []AlertQuery{newQuery}

			diff := rule1.Diff(rule2)
			assert.Nil(t, diff)

			// reset rule1
			rule1.Data = []AlertQuery{query1}
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

	t.Run("should detect changes in NotificationSettings", func(t *testing.T) {
		rule1 := RuleGen.GenerateRef()

		baseSettings := NotificationSettingsGen(NSMuts.WithGroupBy("test1", "test2"))()
		rule1.NotificationSettings = []NotificationSettings{baseSettings}

		addTime := func(d *model.Duration, duration time.Duration) *time.Duration {
			dur := time.Duration(*d)
			dur += duration
			return &dur
		}

		testCases := []struct {
			name                 string
			notificationSettings NotificationSettings
			diffs                cmputil.DiffReport
		}{
			{
				name:                 "should detect changes in Receiver",
				notificationSettings: CopyNotificationSettings(baseSettings, NSMuts.WithReceiver(baseSettings.Receiver+"-modified")),
				diffs: []cmputil.Diff{
					{
						Path:  "NotificationSettings[0].Receiver",
						Left:  reflect.ValueOf(baseSettings.Receiver),
						Right: reflect.ValueOf(baseSettings.Receiver + "-modified"),
					},
				},
			},
			{
				name:                 "should detect changes in GroupWait",
				notificationSettings: CopyNotificationSettings(baseSettings, NSMuts.WithGroupWait(addTime(baseSettings.GroupWait, 1*time.Second))),
				diffs: []cmputil.Diff{
					{
						Path:  "NotificationSettings[0].GroupWait",
						Left:  reflect.ValueOf(*baseSettings.GroupWait),
						Right: reflect.ValueOf(model.Duration(*addTime(baseSettings.GroupWait, 1*time.Second))),
					},
				},
			},
			{
				name:                 "should detect changes in GroupInterval",
				notificationSettings: CopyNotificationSettings(baseSettings, NSMuts.WithGroupInterval(addTime(baseSettings.GroupInterval, 1*time.Second))),
				diffs: []cmputil.Diff{
					{
						Path:  "NotificationSettings[0].GroupInterval",
						Left:  reflect.ValueOf(*baseSettings.GroupInterval),
						Right: reflect.ValueOf(model.Duration(*addTime(baseSettings.GroupInterval, 1*time.Second))),
					},
				},
			},
			{
				name:                 "should detect changes in RepeatInterval",
				notificationSettings: CopyNotificationSettings(baseSettings, NSMuts.WithRepeatInterval(addTime(baseSettings.RepeatInterval, 1*time.Second))),
				diffs: []cmputil.Diff{
					{
						Path:  "NotificationSettings[0].RepeatInterval",
						Left:  reflect.ValueOf(*baseSettings.RepeatInterval),
						Right: reflect.ValueOf(model.Duration(*addTime(baseSettings.RepeatInterval, 1*time.Second))),
					},
				},
			},
			{
				name:                 "should detect changes in GroupBy",
				notificationSettings: CopyNotificationSettings(baseSettings, NSMuts.WithGroupBy(baseSettings.GroupBy[0]+"-modified", baseSettings.GroupBy[1]+"-modified")),
				diffs: []cmputil.Diff{
					{
						Path:  "NotificationSettings[0].GroupBy[0]",
						Left:  reflect.ValueOf(baseSettings.GroupBy[0]),
						Right: reflect.ValueOf(baseSettings.GroupBy[0] + "-modified"),
					},
					{
						Path:  "NotificationSettings[0].GroupBy[1]",
						Left:  reflect.ValueOf(baseSettings.GroupBy[1]),
						Right: reflect.ValueOf(baseSettings.GroupBy[1] + "-modified"),
					},
				},
			},
			{
				name:                 "should detect changes in MuteTimeIntervals",
				notificationSettings: CopyNotificationSettings(baseSettings, NSMuts.WithMuteTimeIntervals(baseSettings.MuteTimeIntervals[0]+"-modified", baseSettings.MuteTimeIntervals[1]+"-modified")),
				diffs: []cmputil.Diff{
					{
						Path:  "NotificationSettings[0].MuteTimeIntervals[0]",
						Left:  reflect.ValueOf(baseSettings.MuteTimeIntervals[0]),
						Right: reflect.ValueOf(baseSettings.MuteTimeIntervals[0] + "-modified"),
					},
					{
						Path:  "NotificationSettings[0].MuteTimeIntervals[1]",
						Left:  reflect.ValueOf(baseSettings.MuteTimeIntervals[1]),
						Right: reflect.ValueOf(baseSettings.MuteTimeIntervals[1] + "-modified"),
					},
				},
			},
			{
				name:                 "should detect changes in ActiveTimeIntervals",
				notificationSettings: CopyNotificationSettings(baseSettings, NSMuts.WithActiveTimeIntervals(baseSettings.ActiveTimeIntervals[0]+"-modified", baseSettings.ActiveTimeIntervals[1]+"-modified")),
				diffs: []cmputil.Diff{
					{
						Path:  "NotificationSettings[0].ActiveTimeIntervals[0]",
						Left:  reflect.ValueOf(baseSettings.ActiveTimeIntervals[0]),
						Right: reflect.ValueOf(baseSettings.ActiveTimeIntervals[0] + "-modified"),
					},
					{
						Path:  "NotificationSettings[0].ActiveTimeIntervals[1]",
						Left:  reflect.ValueOf(baseSettings.ActiveTimeIntervals[1]),
						Right: reflect.ValueOf(baseSettings.ActiveTimeIntervals[1] + "-modified"),
					},
				},
			},
		}

		for _, tt := range testCases {
			t.Run(tt.name, func(t *testing.T) {
				rule2 := CopyRule(rule1)
				rule2.NotificationSettings = []NotificationSettings{tt.notificationSettings}
				diffs := rule1.Diff(rule2)

				cOpt := []cmp.Option{
					cmpopts.IgnoreUnexported(cmputil.Diff{}),
				}
				if !cmp.Equal(diffs, tt.diffs, cOpt...) {
					t.Errorf("Unexpected Diffs: %v", cmp.Diff(diffs, tt.diffs, cOpt...))
				}
			})
		}
	})

	t.Run("should detect changes in Metadata.EditorSettings", func(t *testing.T) {
		rule1 := RuleGen.With(RuleGen.WithMetadata(AlertRuleMetadata{EditorSettings: EditorSettings{
			SimplifiedQueryAndExpressionsSection: false,
			SimplifiedNotificationsSection:       false,
		}})).GenerateRef()

		rule2 := CopyRule(rule1, RuleGen.WithMetadata(AlertRuleMetadata{EditorSettings: EditorSettings{
			SimplifiedQueryAndExpressionsSection: true,
			SimplifiedNotificationsSection:       true,
		}}))

		diff := rule1.Diff(rule2)
		assert.ElementsMatch(t, []string{
			"Metadata.EditorSettings.SimplifiedQueryAndExpressionsSection",
			"Metadata.EditorSettings.SimplifiedNotificationsSection",
		}, diff.Paths())
	})

	t.Run("should detect changes in Metadata.PrometheusStyleRule", func(t *testing.T) {
		rule1 := RuleGen.With(RuleGen.WithMetadata(AlertRuleMetadata{PrometheusStyleRule: &PrometheusStyleRule{
			OriginalRuleDefinition: "data",
		}})).GenerateRef()

		rule2 := CopyRule(rule1, RuleGen.WithMetadata(AlertRuleMetadata{PrometheusStyleRule: &PrometheusStyleRule{
			OriginalRuleDefinition: "updated data",
		}}))

		diff := rule1.Diff(rule2)
		assert.ElementsMatch(t, []string{
			"Metadata.PrometheusStyleRule.OriginalRuleDefinition",
		}, diff.Paths())
	})
}

func TestSortByGroupIndex(t *testing.T) {
	ensureNotSorted := func(t *testing.T, rules []*AlertRule, less func(i, j int) bool) {
		for i := 0; i < 5; i++ {
			rand.Shuffle(len(rules), func(i, j int) {
				rules[i], rules[j] = rules[j], rules[i]
			})
			if !sort.SliceIsSorted(rules, less) {
				return
			}
		}
		t.Fatalf("unable to ensure that alerts are not sorted")
	}

	t.Run("should sort rules by GroupIndex", func(t *testing.T) {
		rules := RuleGen.With(
			RuleMuts.WithUniqueGroupIndex(),
		).GenerateManyRef(5, 20)
		ensureNotSorted(t, rules, func(i, j int) bool {
			return rules[i].RuleGroupIndex < rules[j].RuleGroupIndex
		})
		RulesGroup(rules).SortByGroupIndex()
		require.True(t, sort.SliceIsSorted(rules, func(i, j int) bool {
			return rules[i].RuleGroupIndex < rules[j].RuleGroupIndex
		}))
	})

	t.Run("should sort by ID if same GroupIndex", func(t *testing.T) {
		rules := RuleGen.With(
			RuleMuts.WithUniqueID(),
			RuleMuts.WithGroupIndex(rand.Int()),
		).GenerateManyRef(5, 20)
		ensureNotSorted(t, rules, func(i, j int) bool {
			return rules[i].ID < rules[j].ID
		})
		RulesGroup(rules).SortByGroupIndex()
		require.True(t, sort.SliceIsSorted(rules, func(i, j int) bool {
			return rules[i].ID < rules[j].ID
		}))
	})
}

func TestTimeRangeYAML(t *testing.T) {
	yamlRaw := "from: 600\nto: 0\n"
	var rtr RelativeTimeRange
	err := yaml.Unmarshal([]byte(yamlRaw), &rtr)
	require.NoError(t, err)
	// nanoseconds
	require.Equal(t, Duration(600000000000), rtr.From)
	require.Equal(t, Duration(0), rtr.To)

	serialized, err := yaml.Marshal(rtr)
	require.NoError(t, err)
	require.Equal(t, yamlRaw, string(serialized))
}

func TestAlertRuleGetKey(t *testing.T) {
	t.Run("should return correct key", func(t *testing.T) {
		rule := RuleGen.GenerateRef()
		expected := AlertRuleKey{
			OrgID: rule.OrgID,
			UID:   rule.UID,
		}
		require.Equal(t, expected, rule.GetKey())
	})
}

func TestAlertRuleGetKeyWithGroup(t *testing.T) {
	t.Run("should return correct key", func(t *testing.T) {
		rule := RuleGen.With(
			RuleMuts.WithUniqueGroupIndex(),
		).GenerateRef()
		expected := AlertRuleKeyWithGroup{
			AlertRuleKey: rule.GetKey(),
			RuleGroup:    rule.RuleGroup,
		}
		require.Equal(t, expected, rule.GetKeyWithGroup())
	})
}

func TestAlertRuleGetMissingSeriesEvalsToResolve(t *testing.T) {
	t.Run("should return the default 2 if MissingSeriesEvalsToResolve is nil", func(t *testing.T) {
		rule := RuleGen.GenerateRef()
		rule.MissingSeriesEvalsToResolve = nil
		require.Equal(t, int64(2), rule.GetMissingSeriesEvalsToResolve())
	})

	t.Run("should return the correct value", func(t *testing.T) {
		rule := RuleGen.With(
			RuleMuts.WithMissingSeriesEvalsToResolve(3),
		).GenerateRef()
		require.Equal(t, int64(3), rule.GetMissingSeriesEvalsToResolve())
	})
}

func TestAlertRuleCopy(t *testing.T) {
	t.Run("should return a copy of the rule", func(t *testing.T) {
		for i := 0; i < 100; i++ {
			rule := RuleGen.GenerateRef()
			copied := rule.Copy()
			require.Empty(t, rule.Diff(copied))
		}
	})

	t.Run("should create a copy of the prometheus rule definition from the metadata", func(t *testing.T) {
		rule := RuleGen.With(RuleGen.WithMetadata(AlertRuleMetadata{PrometheusStyleRule: &PrometheusStyleRule{
			OriginalRuleDefinition: "data",
		}})).GenerateRef()
		copied := rule.Copy()
		require.NotSame(t, rule.Metadata.PrometheusStyleRule, copied.Metadata.PrometheusStyleRule)
	})
}

// This test makes sure the default generator
func TestGeneratorFillsAllFields(t *testing.T) {
	ignoredFields := map[string]struct{}{
		"ID":       {},
		"IsPaused": {},
		"Record":   {},
	}

	tpe := reflect.TypeOf(AlertRule{})
	fields := make(map[string]struct{}, tpe.NumField())
	for i := 0; i < tpe.NumField(); i++ {
		if _, ok := ignoredFields[tpe.Field(i).Name]; ok {
			continue
		}
		fields[tpe.Field(i).Name] = struct{}{}
	}

	for i := 0; i < 1000; i++ {
		rule := RuleGen.Generate()
		v := reflect.ValueOf(rule)

		for j := 0; j < tpe.NumField(); j++ {
			field := tpe.Field(j)
			value := v.Field(j)
			if !value.IsValid() || value.Kind() == reflect.Ptr && value.IsNil() || value.IsZero() {
				continue
			}
			delete(fields, field.Name)
			if len(fields) == 0 {
				return
			}
		}
	}

	require.FailNow(t, "AlertRule generator does not populate fields", "skipped fields: %v", maps.Keys(fields))
}

func TestValidateAlertRule(t *testing.T) {
	t.Run("keepFiringFor", func(t *testing.T) {
		testCases := []struct {
			name          string
			keepFiringFor time.Duration
			expectedErr   error
		}{
			{
				name:          "should accept zero keep firing for",
				keepFiringFor: 0,
				expectedErr:   nil,
			},
			{
				name:          "should accept positive keep firing for",
				keepFiringFor: 1 * time.Minute,
				expectedErr:   nil,
			},
			{
				name:          "should reject negative keep firing for",
				keepFiringFor: -1 * time.Minute,
				expectedErr:   fmt.Errorf("%w: field `keep_firing_for` cannot be negative", ErrAlertRuleFailedValidation),
			},
		}

		for _, tc := range testCases {
			t.Run(tc.name, func(t *testing.T) {
				rule := RuleGen.With(
					RuleGen.WithKeepFiringFor(tc.keepFiringFor),
					RuleGen.WithIntervalSeconds(10),
				).GenerateRef()

				err := rule.ValidateAlertRule(setting.UnifiedAlertingSettings{BaseInterval: 10 * time.Second})

				if tc.expectedErr == nil {
					require.NoError(t, err)
				} else {
					require.Error(t, err)
					require.Equal(t, tc.expectedErr.Error(), err.Error())
				}
			})
		}
	})

	t.Run("missingSeriesEvalsToResolve", func(t *testing.T) {
		testCases := []struct {
			name                        string
			missingSeriesEvalsToResolve *int64
			expectedErrorContains       string
		}{
			{
				name:                        "should allow nil value",
				missingSeriesEvalsToResolve: nil,
			},
			{
				name:                        "should reject negative value",
				missingSeriesEvalsToResolve: util.Pointer[int64](-1),
				expectedErrorContains:       "field `missing_series_evals_to_resolve` must be greater than 0",
			},
			{
				name:                        "should reject 0",
				missingSeriesEvalsToResolve: util.Pointer[int64](0),
				expectedErrorContains:       "field `missing_series_evals_to_resolve` must be greater than 0",
			},
			{
				name:                        "should accept positive value",
				missingSeriesEvalsToResolve: util.Pointer[int64](2),
			},
		}

		for _, tc := range testCases {
			t.Run(tc.name, func(t *testing.T) {
				baseIntervalSeconds := int64(10)
				cfg := setting.UnifiedAlertingSettings{
					BaseInterval: time.Duration(baseIntervalSeconds) * time.Second,
				}

				rule := RuleGen.With(
					RuleMuts.WithIntervalSeconds(baseIntervalSeconds * 2),
				).Generate()
				rule.MissingSeriesEvalsToResolve = tc.missingSeriesEvalsToResolve

				err := rule.ValidateAlertRule(cfg)

				if tc.expectedErrorContains != "" {
					require.Error(t, err)
					require.ErrorIs(t, err, ErrAlertRuleFailedValidation)
					require.Contains(t, err.Error(), tc.expectedErrorContains)
				} else {
					require.NoError(t, err)
				}
			})
		}
	})

	t.Run("ExecErrState & NoDataState", func(t *testing.T) {
		testCases := []struct {
			name         string
			execErrState string
			noDataState  string
			error        bool
		}{
			{
				name:         "invalid error state",
				execErrState: "invalid",
				error:        true,
			},
			{
				name:        "invalid no data state",
				noDataState: "invalid",
				error:       true,
			},
			{
				name:  "valid states",
				error: false,
			},
		}
		for _, tc := range testCases {
			t.Run(tc.name, func(t *testing.T) {
				rule := RuleGen.With(
					RuleMuts.WithIntervalSeconds(10),
				).Generate()
				if tc.execErrState != "" {
					rule.ExecErrState = ExecutionErrorState(tc.execErrState)
				}
				if tc.noDataState != "" {
					rule.NoDataState = NoDataState(tc.noDataState)
				}

				err := rule.ValidateAlertRule(setting.UnifiedAlertingSettings{BaseInterval: 10 * time.Second})
				if tc.error {
					require.Error(t, err)
					require.ErrorIs(t, err, ErrAlertRuleFailedValidation)
				} else {
					require.NoError(t, err)
				}
			})
		}
	})
}

func TestAlertRule_PrometheusRuleDefinition(t *testing.T) {
	tests := []struct {
		name             string
		rule             AlertRule
		expectedResult   string
		expectedErrorMsg string
	}{
		{
			name: "rule with prometheus definition",
			rule: AlertRule{
				Metadata: AlertRuleMetadata{
					PrometheusStyleRule: &PrometheusStyleRule{
						OriginalRuleDefinition: "groups:\n- name: example\n  rules:\n  - alert: HighRequestLatency\n    expr: request_latency_seconds{job=\"myjob\"} > 0.5\n    for: 10m\n    labels:\n      severity: page\n    annotations:\n      summary: High request latency",
					},
				},
			},
			expectedResult:   "groups:\n- name: example\n  rules:\n  - alert: HighRequestLatency\n    expr: request_latency_seconds{job=\"myjob\"} > 0.5\n    for: 10m\n    labels:\n      severity: page\n    annotations:\n      summary: High request latency",
			expectedErrorMsg: "",
		},
		{
			name: "rule with empty prometheus definition",
			rule: AlertRule{
				Metadata: AlertRuleMetadata{
					PrometheusStyleRule: &PrometheusStyleRule{
						OriginalRuleDefinition: "",
					},
				},
			},
			expectedResult:   "",
			expectedErrorMsg: "prometheus rule definition is missing",
		},
		{
			name: "rule with nil prometheus style rule",
			rule: AlertRule{
				Metadata: AlertRuleMetadata{
					PrometheusStyleRule: nil,
				},
			},
			expectedResult:   "",
			expectedErrorMsg: "prometheus rule definition is missing",
		},
		{
			name:             "rule with empty metadata",
			rule:             AlertRule{},
			expectedResult:   "",
			expectedErrorMsg: "prometheus rule definition is missing",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result, err := tt.rule.PrometheusRuleDefinition()
			isPrometheusRule := tt.rule.HasPrometheusRuleDefinition()

			if tt.expectedErrorMsg != "" {
				require.Error(t, err)
				require.Equal(t, tt.expectedErrorMsg, err.Error())
				require.False(t, isPrometheusRule)
			} else {
				require.NoError(t, err)
				require.Equal(t, tt.expectedResult, result)
				require.True(t, isPrometheusRule)
			}
		})
	}
}

func TestAlertRule_ImportedPrometheusRule(t *testing.T) {
	tests := []struct {
		name     string
		rule     AlertRule
		expected bool
	}{
		{
			name: "rule with prometheus definition",
			rule: AlertRule{
				Metadata: AlertRuleMetadata{
					PrometheusStyleRule: &PrometheusStyleRule{
						OriginalRuleDefinition: "some rule definition",
					},
				},
			},
			expected: true,
		},
		{
			name: "rule with converted prometheus rule label",
			rule: AlertRule{
				Labels: map[string]string{
					ConvertedPrometheusRuleLabel: "true",
				},
			},
			expected: true,
		},
		{
			name: "rule with both prometheus definition and converted label",
			rule: AlertRule{
				Labels: map[string]string{
					ConvertedPrometheusRuleLabel: "true",
				},
				Metadata: AlertRuleMetadata{
					PrometheusStyleRule: &PrometheusStyleRule{
						OriginalRuleDefinition: "some rule definition",
					},
				},
			},
			expected: true,
		},
		{
			name: "rule with empty prometheus definition",
			rule: AlertRule{
				Metadata: AlertRuleMetadata{
					PrometheusStyleRule: &PrometheusStyleRule{
						OriginalRuleDefinition: "",
					},
				},
			},
			expected: false,
		},
		{
			name: "rule with nil prometheus style rule",
			rule: AlertRule{
				Metadata: AlertRuleMetadata{
					PrometheusStyleRule: nil,
				},
			},
			expected: false,
		},
		{
			name:     "rule with empty metadata",
			rule:     AlertRule{},
			expected: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := tt.rule.ImportedPrometheusRule()
			require.Equal(t, tt.expected, result)
		})
	}
}
