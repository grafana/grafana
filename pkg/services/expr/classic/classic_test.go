package classic

import (
	"context"
	"encoding/json"
	"testing"
	"time"

	"github.com/stretchr/testify/require"
	ptr "github.com/xorcare/pointer"

	"github.com/grafana/grafana-plugin-sdk-go/data"
	"github.com/grafana/grafana/pkg/services/expr/mathexp"
)

func TestConditionsCmd(t *testing.T) {
	tests := []struct {
		name     string
		cmd      *ConditionsCmd
		vars     mathexp.Vars
		expected func() mathexp.Results
	}{{
		// This test asserts that a single query with condition returns 0 and no matches as the condition
		// is not met
		name: "single query with condition when condition is not met",
		vars: mathexp.Vars{
			"A": mathexp.Results{
				Values: []mathexp.Value{
					newSeries(ptr.Float64(1), ptr.Float64(5)),
				},
			},
		},
		cmd: &ConditionsCmd{
			Conditions: []condition{
				{
					InputRefID: "A",
					Reducer:    reducer("min"),
					Operator:   "and",
					Evaluator:  &thresholdEvaluator{Type: "gt", Threshold: 2},
				},
			}},
		expected: func() mathexp.Results {
			v := newNumber(ptr.Float64(0))
			v.SetMeta([]EvalMatch{})
			return newResults(v)
		},
	}, {
		// This test asserts that a single query with condition returns 1 and the average in the meta as
		// the condition is met
		name: "single query with condition when condition is met",
		vars: mathexp.Vars{
			"A": mathexp.Results{
				Values: []mathexp.Value{
					newSeries(ptr.Float64(1), ptr.Float64(5)),
				},
			},
		},
		cmd: &ConditionsCmd{
			Conditions: []condition{
				{
					InputRefID: "A",
					Reducer:    reducer("avg"),
					Operator:   "and",
					Evaluator:  &thresholdEvaluator{Type: "gt", Threshold: 2},
				},
			}},
		expected: func() mathexp.Results {
			v := newNumber(ptr.Float64(1))
			v.SetMeta([]EvalMatch{{Value: ptr.Float64(3)}})
			return newResults(v)
		},
	}, {
		name: "single query with ranged condition when condition is not met",
		vars: mathexp.Vars{
			"A": mathexp.Results{
				Values: []mathexp.Value{
					newSeries(ptr.Float64(1), ptr.Float64(5)),
				},
			},
		},
		cmd: &ConditionsCmd{
			Conditions: []condition{
				{
					InputRefID: "A",
					Reducer:    reducer("diff"),
					Operator:   "and",
					Evaluator:  &rangedEvaluator{Type: "within_range", Lower: 2, Upper: 4},
				},
			},
		},
		expected: func() mathexp.Results {
			v := newNumber(ptr.Float64(0))
			v.SetMeta([]EvalMatch{})
			return newResults(v)
		},
	}, {
		name: "single query with ranged condition when condition is met",
		vars: mathexp.Vars{
			"A": mathexp.Results{
				Values: []mathexp.Value{
					newSeries(ptr.Float64(1), ptr.Float64(5)),
				},
			},
		},
		cmd: &ConditionsCmd{
			Conditions: []condition{
				{
					InputRefID: "A",
					Reducer:    reducer("diff"),
					Operator:   "and",
					Evaluator:  &rangedEvaluator{Type: "within_range", Lower: 0, Upper: 10},
				},
			},
		},
		expected: func() mathexp.Results {
			v := newNumber(ptr.Float64(1))
			v.SetMeta([]EvalMatch{{Value: ptr.Float64(4)}})
			return newResults(v)
		},
	}, {
		name: "single no data query with condition is No Data",
		vars: mathexp.Vars{
			"A": mathexp.Results{
				Values: []mathexp.Value{mathexp.NoData{}.New()},
			},
		},
		cmd: &ConditionsCmd{
			Conditions: []condition{
				{
					InputRefID: "A",
					Reducer:    reducer("min"),
					Operator:   "and",
					Evaluator:  &thresholdEvaluator{"gt", 1},
				},
			},
		},
		expected: func() mathexp.Results {
			v := newNumber(nil)
			v.SetMeta([]EvalMatch{{Metric: "NoData"}})
			return newResults(v)
		},
	}, {
		name: "single no values query with condition is No Data",
		vars: mathexp.Vars{
			"A": mathexp.Results{
				Values: []mathexp.Value{},
			},
		},
		cmd: &ConditionsCmd{
			Conditions: []condition{
				{
					InputRefID: "A",
					Reducer:    reducer("min"),
					Operator:   "and",
					Evaluator:  &thresholdEvaluator{"gt", 1},
				},
			},
		},
		expected: func() mathexp.Results {
			v := newNumber(nil)
			v.SetMeta([]EvalMatch{{Metric: "NoData"}})
			return newResults(v)
		},
	}, {
		name: "single series no points query with condition returns No Data",
		vars: mathexp.Vars{
			"A": mathexp.Results{
				Values: []mathexp.Value{
					newSeries(nil),
				},
			},
		},
		cmd: &ConditionsCmd{
			Conditions: []condition{
				{
					InputRefID: "A",
					Reducer:    reducer("min"),
					Operator:   "and",
					Evaluator:  &thresholdEvaluator{"gt", 1},
				},
			},
		},
		expected: func() mathexp.Results {
			v := newNumber(nil)
			v.SetMeta([]EvalMatch{{Metric: "NoData"}})
			return newResults(v)
		},
	}, {
		name: "single no data query with condition is met has no value",
		vars: mathexp.Vars{
			"A": mathexp.Results{
				Values: []mathexp.Value{mathexp.NoData{}.New()},
			},
		},
		cmd: &ConditionsCmd{
			Conditions: []condition{
				{
					InputRefID: "A",
					Reducer:    reducer("min"),
					Operator:   "and",
					Evaluator:  &noValueEvaluator{},
				},
			},
		},
		expected: func() mathexp.Results {
			v := newNumber(ptr.Float64(1))
			v.SetMeta([]EvalMatch{{Value: nil}})
			return newResults(v)
		},
	}, {
		name: "single no values query with condition is met has no value",
		vars: mathexp.Vars{
			"A": mathexp.Results{
				Values: []mathexp.Value{},
			},
		},
		cmd: &ConditionsCmd{
			Conditions: []condition{
				{
					InputRefID: "A",
					Reducer:    reducer("min"),
					Operator:   "and",
					Evaluator:  &noValueEvaluator{},
				},
			},
		},
		expected: func() mathexp.Results {
			v := newNumber(ptr.Float64(1))
			v.SetMeta([]EvalMatch{{Value: nil}})
			return newResults(v)
		},
	}, {
		name: "single series no points query with condition is met has no value",
		vars: mathexp.Vars{
			"A": mathexp.Results{
				Values: []mathexp.Value{
					newSeries(nil),
				},
			},
		},
		cmd: &ConditionsCmd{
			Conditions: []condition{
				{
					InputRefID: "A",
					Reducer:    reducer("min"),
					Operator:   "and",
					Evaluator:  &noValueEvaluator{},
				},
			},
		},
		expected: func() mathexp.Results {
			v := newNumber(ptr.Float64(1))
			v.SetMeta([]EvalMatch{{Value: nil}})
			return newResults(v)
		},
	}, {
		// This test asserts that a single query with condition returns 1 and the average of the second
		// series in the meta because while the first series is No Data the second series contains valid points
		name: "single query with condition returns average when one series is no data and the other contains valid points",
		vars: mathexp.Vars{
			"A": mathexp.Results{
				Values: []mathexp.Value{
					newSeries(),
					newSeries(ptr.Float64(2)),
				},
			},
		},
		cmd: &ConditionsCmd{
			Conditions: []condition{
				{
					InputRefID: "A",
					Reducer:    reducer("min"),
					Operator:   "and",
					Evaluator:  &thresholdEvaluator{Type: "gt", Threshold: 1},
				},
			}},
		expected: func() mathexp.Results {
			v := newNumber(ptr.Float64(1))
			v.SetMeta([]EvalMatch{{Value: ptr.Float64(2)}})
			return newResults(v)
		},
	}, {
		name: "single query with condition and no series matches condition",
		vars: mathexp.Vars{
			"A": mathexp.Results{
				Values: []mathexp.Value{
					newSeries(ptr.Float64(1), ptr.Float64(5)),
					newSeries(ptr.Float64(2), ptr.Float64(10)),
				},
			},
		},
		cmd: &ConditionsCmd{
			Conditions: []condition{
				{
					InputRefID: "A",
					Reducer:    reducer("min"),
					Operator:   "and",
					Evaluator:  &thresholdEvaluator{Type: "gt", Threshold: 15},
				},
			}},
		expected: func() mathexp.Results {
			v := newNumber(ptr.Float64(0))
			v.SetMeta([]EvalMatch{})
			return mathexp.Results{Values: mathexp.Values{v}}
		},
	}, {
		name: "single query with condition and one of two series matches condition",
		vars: mathexp.Vars{
			"A": mathexp.Results{
				Values: []mathexp.Value{
					newSeries(ptr.Float64(1), ptr.Float64(5)),
					newSeriesWithLabels(data.Labels{"foo": "bar"}, ptr.Float64(2), ptr.Float64(10)),
				},
			},
		},
		cmd: &ConditionsCmd{
			Conditions: []condition{
				{
					InputRefID: "A",
					Reducer:    reducer("min"),
					Operator:   "and",
					Evaluator:  &thresholdEvaluator{Type: "gt", Threshold: 1},
				},
			}},
		expected: func() mathexp.Results {
			v := newNumber(ptr.Float64(1))
			v.SetMeta([]EvalMatch{{Value: ptr.Float64(2), Labels: data.Labels{"foo": "bar"}}})
			return newResults(v)
		},
	}, {
		name: "single query with condition and both series matches condition",
		vars: mathexp.Vars{
			"A": mathexp.Results{
				Values: []mathexp.Value{
					newSeries(ptr.Float64(1), ptr.Float64(5)),
					newSeriesWithLabels(data.Labels{"foo": "bar"}, ptr.Float64(2), ptr.Float64(10)),
				},
			},
		},
		cmd: &ConditionsCmd{
			Conditions: []condition{
				{
					InputRefID: "A",
					Reducer:    reducer("min"),
					Operator:   "and",
					Evaluator:  &thresholdEvaluator{Type: "gt", Threshold: 0},
				},
			}},
		expected: func() mathexp.Results {
			v := newNumber(ptr.Float64(1))
			v.SetMeta([]EvalMatch{{
				Value: ptr.Float64(1),
			}, {
				Value:  ptr.Float64(2),
				Labels: data.Labels{"foo": "bar"},
			}})
			return newResults(v)
		},
	}, {
		name: "single query with two conditions where left hand side is met",
		vars: mathexp.Vars{
			"A": mathexp.Results{
				Values: []mathexp.Value{
					newSeries(ptr.Float64(1), ptr.Float64(5)),
				},
			},
		},
		cmd: &ConditionsCmd{
			Conditions: []condition{
				{
					InputRefID: "A",
					Reducer:    reducer("max"),
					Evaluator:  &thresholdEvaluator{Type: "gt", Threshold: 2},
				},
				{
					InputRefID: "A",
					Reducer:    reducer("min"),
					Operator:   "or",
					Evaluator:  &thresholdEvaluator{Type: "gt", Threshold: 1},
				},
			}},
		expected: func() mathexp.Results {
			v := newNumber(ptr.Float64(1))
			v.SetMeta([]EvalMatch{{Value: ptr.Float64(5)}})
			return newResults(v)
		},
	}, {
		name: "single query with two conditions where right hand side is met",
		vars: mathexp.Vars{
			"A": mathexp.Results{
				Values: []mathexp.Value{
					newSeries(ptr.Float64(1), ptr.Float64(5)),
				},
			},
		},
		cmd: &ConditionsCmd{
			Conditions: []condition{
				{
					InputRefID: "A",
					Reducer:    reducer("max"),
					Evaluator:  &thresholdEvaluator{Type: "gt", Threshold: 10},
				},
				{
					InputRefID: "A",
					Reducer:    reducer("min"),
					Operator:   "or",
					Evaluator:  &thresholdEvaluator{Type: "gt", Threshold: 0},
				},
			}},
		expected: func() mathexp.Results {
			v := newNumber(ptr.Float64(1))
			v.SetMeta([]EvalMatch{{Value: ptr.Float64(1)}})
			return newResults(v)
		},
	}, {
		name: "single query with two conditions where both are met",
		vars: mathexp.Vars{
			"A": mathexp.Results{
				Values: []mathexp.Value{
					newSeries(ptr.Float64(1), ptr.Float64(5)),
				},
			},
		},
		cmd: &ConditionsCmd{
			Conditions: []condition{
				{
					InputRefID: "A",
					Reducer:    reducer("max"),
					Evaluator:  &thresholdEvaluator{Type: "gt", Threshold: 2},
				},
				{
					InputRefID: "A",
					Reducer:    reducer("min"),
					Operator:   "or",
					Evaluator:  &thresholdEvaluator{Type: "gt", Threshold: 0},
				},
			}},
		expected: func() mathexp.Results {
			v := newNumber(ptr.Float64(1))
			v.SetMeta([]EvalMatch{{Value: ptr.Float64(5)}, {Value: ptr.Float64(1)}})
			return newResults(v)
		},
	}, {
		name: "single instant query with condition where condition is met",
		vars: mathexp.Vars{
			"A": mathexp.Results{
				Values: []mathexp.Value{
					newNumber(ptr.Float64(5)),
					newNumber(ptr.Float64(10)),
					newNumber(ptr.Float64(15)),
				},
			},
		},
		cmd: &ConditionsCmd{
			Conditions: []condition{
				{
					InputRefID: "A",
					Reducer:    reducer("avg"),
					Operator:   "and",
					Evaluator:  &thresholdEvaluator{"gt", 1},
				},
			},
		},
		expected: func() mathexp.Results {
			v := newNumber(ptr.Float64(1))
			v.SetMeta([]EvalMatch{
				{Value: ptr.Float64(5)},
				{Value: ptr.Float64(10)},
				{Value: ptr.Float64(15)},
			})
			return newResults(v)
		},
	}, {
		name: "two queries with two conditions using and operator and first is No Data",
		vars: mathexp.Vars{
			"A": mathexp.Results{
				Values: []mathexp.Value{mathexp.NoData{}.New()},
			},
			"B": mathexp.Results{
				Values: []mathexp.Value{newSeries(ptr.Float64(5))},
			},
		},
		cmd: &ConditionsCmd{
			Conditions: []condition{
				{
					InputRefID: "A",
					Reducer:    reducer("min"),
					Operator:   "and",
					Evaluator:  &thresholdEvaluator{"gt", 1},
				},
				{
					InputRefID: "B",
					Reducer:    reducer("min"),
					Operator:   "and",
					Evaluator:  &thresholdEvaluator{"gt", 1},
				},
			},
		},
		expected: func() mathexp.Results {
			v := newNumber(ptr.Float64(0))
			v.SetMeta([]EvalMatch{{Metric: "NoData"}, {Value: ptr.Float64(5)}})
			return newResults(v)
		},
	}, {
		name: "two queries with two conditions using and operator and last is No Data",
		vars: mathexp.Vars{
			"A": mathexp.Results{
				Values: []mathexp.Value{newSeries(ptr.Float64(5))},
			},
			"B": mathexp.Results{
				Values: []mathexp.Value{mathexp.NoData{}.New()},
			},
		},
		cmd: &ConditionsCmd{
			Conditions: []condition{
				{
					InputRefID: "A",
					Reducer:    reducer("min"),
					Operator:   "and",
					Evaluator:  &thresholdEvaluator{"gt", 1},
				},
				{
					InputRefID: "B",
					Reducer:    reducer("min"),
					Operator:   "and",
					Evaluator:  &thresholdEvaluator{"gt", 1},
				},
			},
		},
		expected: func() mathexp.Results {
			v := newNumber(ptr.Float64(0))
			v.SetMeta([]EvalMatch{{Value: ptr.Float64(5)}, {Metric: "NoData"}})
			return newResults(v)
		},
	}, {
		name: "two queries with two conditions using or operator and first is No Data",
		vars: mathexp.Vars{
			"A": mathexp.Results{
				Values: []mathexp.Value{mathexp.NoData{}.New()},
			},
			"B": mathexp.Results{
				Values: []mathexp.Value{newSeries(ptr.Float64(5))},
			},
		},
		cmd: &ConditionsCmd{
			Conditions: []condition{
				{
					InputRefID: "A",
					Reducer:    reducer("min"),
					Operator:   "or",
					Evaluator:  &thresholdEvaluator{"gt", 1},
				},
				{
					InputRefID: "B",
					Reducer:    reducer("min"),
					Operator:   "or",
					Evaluator:  &thresholdEvaluator{"gt", 1},
				},
			},
		},
		expected: func() mathexp.Results {
			v := newNumber(nil)
			v.SetMeta([]EvalMatch{{Metric: "NoData"}, {Value: ptr.Float64(5)}})
			return newResults(v)
		},
	}, {
		name: "two queries with two conditions using or operator and last is No Data",
		vars: mathexp.Vars{
			"A": mathexp.Results{
				Values: []mathexp.Value{newSeries(ptr.Float64(5))},
			},
			"B": mathexp.Results{
				Values: []mathexp.Value{mathexp.NoData{}.New()},
			},
		},
		cmd: &ConditionsCmd{
			Conditions: []condition{
				{
					InputRefID: "A",
					Reducer:    reducer("min"),
					Operator:   "or",
					Evaluator:  &thresholdEvaluator{"gt", 1},
				},
				{
					InputRefID: "B",
					Reducer:    reducer("min"),
					Operator:   "or",
					Evaluator:  &thresholdEvaluator{"gt", 1},
				},
			},
		},
		expected: func() mathexp.Results {
			v := newNumber(nil)
			v.SetMeta([]EvalMatch{{Value: ptr.Float64(5)}, {Metric: "NoData"}})
			return newResults(v)
		},
	}}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			res, err := tt.cmd.Execute(context.Background(), time.Now(), tt.vars)
			require.NoError(t, err)
			require.Equal(t, tt.expected(), res)
		})
	}
}

func TestUnmarshalConditionsCmd(t *testing.T) {
	var tests = []struct {
		name            string
		rawJSON         string
		expectedCommand *ConditionsCmd
		needsVars       []string
	}{
		{
			name: "basic threshold condition",
			rawJSON: `{
				"conditions": [
				  {
					"evaluator": {
					  "params": [
						2
					  ],
					  "type": "gt"
					},
					"operator": {
					  "type": "and"
					},
					"query": {
					  "params": [
						"A"
					  ]
					},
					"reducer": {
					  "params": [],
					  "type": "avg"
					},
					"type": "query"
				  }
				]
			}`,
			expectedCommand: &ConditionsCmd{
				Conditions: []condition{
					{
						InputRefID: "A",
						Reducer:    reducer("avg"),
						Operator:   "and",
						Evaluator:  &thresholdEvaluator{Type: "gt", Threshold: 2},
					},
				},
			},
			needsVars: []string{"A"},
		},
		{
			name: "ranged condition",
			rawJSON: `{
				"conditions": [
				  {
					"evaluator": {
					  "params": [
						2,
						3
					  ],
					  "type": "within_range"
					},
					"operator": {
					  "type": "or"
					},
					"query": {
					  "params": [
						"A"
					  ]
					},
					"reducer": {
					  "params": [],
					  "type": "diff"
					},
					"type": "query"
				  }
				]
			}`,
			expectedCommand: &ConditionsCmd{
				Conditions: []condition{
					{
						InputRefID: "A",
						Reducer:    reducer("diff"),
						Operator:   "or",
						Evaluator:  &rangedEvaluator{Type: "within_range", Lower: 2, Upper: 3},
					},
				},
			},
			needsVars: []string{"A"},
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			var rq map[string]interface{}

			err := json.Unmarshal([]byte(tt.rawJSON), &rq)
			require.NoError(t, err)

			cmd, err := UnmarshalConditionsCmd(rq, "")
			require.NoError(t, err)
			require.Equal(t, tt.expectedCommand, cmd)

			require.Equal(t, tt.needsVars, cmd.NeedsVars())
		})
	}
}
