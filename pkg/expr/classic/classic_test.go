package classic

import (
	"context"
	"encoding/json"
	"testing"

	"github.com/grafana/grafana-plugin-sdk-go/data"
	"github.com/stretchr/testify/require"
	ptr "github.com/xorcare/pointer"

	"github.com/grafana/grafana/pkg/expr/mathexp"
)

func TestUnmarshalConditionCMD(t *testing.T) {
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
						QueryRefID: "A",
						Reducer:    classicReducer("avg"),
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
						QueryRefID: "A",
						Reducer:    classicReducer("diff"),
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

func TestConditionsCmdExecute(t *testing.T) {
	tests := []struct {
		name          string
		vars          mathexp.Vars
		conditionsCmd *ConditionsCmd
		resultNumber  func() mathexp.Number
	}{
		{
			name: "single query and single condition",
			vars: mathexp.Vars{
				"A": mathexp.Results{
					Values: []mathexp.Value{
						valBasedSeries(ptr.Float64(30), ptr.Float64(40)),
					},
				},
			},
			conditionsCmd: &ConditionsCmd{
				Conditions: []condition{
					{
						QueryRefID: "A",
						Reducer:    classicReducer("avg"),
						Operator:   "and",
						Evaluator:  &thresholdEvaluator{Type: "gt", Threshold: 34},
					},
				}},
			resultNumber: func() mathexp.Number {
				v := valBasedNumber(ptr.Float64(1))
				v.SetMeta([]EvalMatch{{Value: ptr.Float64(35)}})
				return v
			},
		},
		{
			name: "single query and single condition - empty series",
			vars: mathexp.Vars{
				"A": mathexp.Results{
					Values: []mathexp.Value{
						valBasedSeries(),
					},
				},
			},
			conditionsCmd: &ConditionsCmd{
				Conditions: []condition{
					{
						QueryRefID: "A",
						Reducer:    classicReducer("avg"),
						Operator:   "and",
						Evaluator:  &thresholdEvaluator{Type: "gt", Threshold: 34},
					},
				}},
			resultNumber: func() mathexp.Number {
				v := valBasedNumber(nil)
				v.SetMeta([]EvalMatch{{Metric: "NoData"}})
				return v
			},
		},
		{
			name: "single query and single condition - empty series and not empty series",
			vars: mathexp.Vars{
				"A": mathexp.Results{
					Values: []mathexp.Value{
						valBasedSeries(),
						valBasedSeries(ptr.Float64(3)),
					},
				},
			},
			conditionsCmd: &ConditionsCmd{
				Conditions: []condition{
					{
						QueryRefID: "A",
						Reducer:    classicReducer("avg"),
						Operator:   "and",
						Evaluator:  &thresholdEvaluator{Type: "gt", Threshold: .5},
					},
				}},
			resultNumber: func() mathexp.Number {
				v := valBasedNumber(ptr.Float64(1))
				v.SetMeta([]EvalMatch{{Value: ptr.Float64(3)}})
				return v
			},
		},
		{
			name: "single query and two conditions",
			vars: mathexp.Vars{
				"A": mathexp.Results{
					Values: []mathexp.Value{
						valBasedSeries(ptr.Float64(30), ptr.Float64(40)),
					},
				},
			},
			conditionsCmd: &ConditionsCmd{
				Conditions: []condition{
					{
						QueryRefID: "A",
						Reducer:    classicReducer("max"),
						Evaluator:  &thresholdEvaluator{Type: "gt", Threshold: 34},
					},
					{
						QueryRefID: "A",
						Reducer:    classicReducer("min"),
						Operator:   "or",
						Evaluator:  &thresholdEvaluator{Type: "gt", Threshold: 12},
					},
				}},
			resultNumber: func() mathexp.Number {
				v := valBasedNumber(ptr.Float64(1))
				v.SetMeta([]EvalMatch{{Value: ptr.Float64(40)}, {Value: ptr.Float64(30)}})
				return v
			},
		},
		{
			name: "single query and single condition - multiple series (one true, one not == true)",
			vars: mathexp.Vars{
				"A": mathexp.Results{
					Values: []mathexp.Value{
						valBasedSeriesWithLabels(data.Labels{"h": "1"}, ptr.Float64(30), ptr.Float64(40)),
						valBasedSeries(ptr.Float64(0), ptr.Float64(10)),
					},
				},
			},
			conditionsCmd: &ConditionsCmd{
				Conditions: []condition{
					{
						QueryRefID: "A",
						Reducer:    classicReducer("avg"),
						Operator:   "and",
						Evaluator:  &thresholdEvaluator{Type: "gt", Threshold: 34},
					},
				}},
			resultNumber: func() mathexp.Number {
				v := valBasedNumber(ptr.Float64(1))
				v.SetMeta([]EvalMatch{{Value: ptr.Float64(35), Labels: data.Labels{"h": "1"}}})
				return v
			},
		},
		{
			name: "single query and single condition - multiple series (one not true, one true == true)",
			vars: mathexp.Vars{
				"A": mathexp.Results{
					Values: []mathexp.Value{
						valBasedSeries(ptr.Float64(0), ptr.Float64(10)),
						valBasedSeries(ptr.Float64(30), ptr.Float64(40)),
					},
				},
			},
			conditionsCmd: &ConditionsCmd{
				Conditions: []condition{
					{
						QueryRefID: "A",
						Reducer:    classicReducer("avg"),
						Operator:   "and",
						Evaluator:  &thresholdEvaluator{Type: "gt", Threshold: 34},
					},
				}},
			resultNumber: func() mathexp.Number {
				v := valBasedNumber(ptr.Float64(1))
				v.SetMeta([]EvalMatch{{Value: ptr.Float64(35)}})
				return v
			},
		},
		{
			name: "single query and single condition - multiple series (2 not true == false)",
			vars: mathexp.Vars{
				"A": mathexp.Results{
					Values: []mathexp.Value{
						valBasedSeries(ptr.Float64(0), ptr.Float64(10)),
						valBasedSeries(ptr.Float64(20), ptr.Float64(30)),
					},
				},
			},
			conditionsCmd: &ConditionsCmd{
				Conditions: []condition{
					{
						QueryRefID: "A",
						Reducer:    classicReducer("avg"),
						Operator:   "and",
						Evaluator:  &thresholdEvaluator{Type: "gt", Threshold: 34},
					},
				}},
			resultNumber: func() mathexp.Number {
				v := valBasedNumber(ptr.Float64(0))
				v.SetMeta([]EvalMatch{})
				return v
			},
		},
		{
			name: "single query and single ranged condition",
			vars: mathexp.Vars{
				"A": mathexp.Results{
					Values: []mathexp.Value{
						valBasedSeries(ptr.Float64(30), ptr.Float64(40)),
					},
				},
			},
			conditionsCmd: &ConditionsCmd{
				Conditions: []condition{
					{
						QueryRefID: "A",
						Reducer:    classicReducer("diff"),
						Operator:   "and",
						Evaluator:  &rangedEvaluator{Type: "within_range", Lower: 2, Upper: 3},
					},
				},
			},
			resultNumber: func() mathexp.Number {
				v := valBasedNumber(ptr.Float64(0))
				v.SetMeta([]EvalMatch{})
				return v
			},
		},
		{
			name: "single query with no data",
			vars: mathexp.Vars{
				"A": mathexp.Results{
					Values: []mathexp.Value{},
				},
			},
			conditionsCmd: &ConditionsCmd{
				Conditions: []condition{
					{
						QueryRefID: "A",
						Reducer:    classicReducer("avg"),
						Operator:   "and",
						Evaluator:  &thresholdEvaluator{"gt", 1},
					},
				},
			},
			resultNumber: func() mathexp.Number {
				v := valBasedNumber(nil)
				v.SetMeta([]EvalMatch{{Metric: "NoData"}})
				return v
			},
		},
		{
			name: "should accept numbers",
			vars: mathexp.Vars{
				"A": mathexp.Results{
					Values: []mathexp.Value{
						valBasedNumber(ptr.Float64(5)),
						valBasedNumber(ptr.Float64(10)),
						valBasedNumber(ptr.Float64(15)),
					},
				},
			},
			conditionsCmd: &ConditionsCmd{
				Conditions: []condition{
					{
						QueryRefID: "A",
						Reducer:    classicReducer("avg"),
						Operator:   "and",
						Evaluator:  &thresholdEvaluator{"gt", 1},
					},
				},
			},
			resultNumber: func() mathexp.Number {
				v := valBasedNumber(ptr.Float64(1))
				v.SetMeta([]EvalMatch{
					{Value: ptr.Float64(5)},
					{Value: ptr.Float64(10)},
					{Value: ptr.Float64(15)},
				})
				return v
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			res, err := tt.conditionsCmd.Execute(context.Background(), tt.vars)
			require.NoError(t, err)

			require.Equal(t, 1, len(res.Values))

			require.Equal(t, tt.resultNumber(), res.Values[0])
		})
	}
}
