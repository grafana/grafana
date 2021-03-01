package classic

import (
	"context"
	"encoding/json"
	"testing"

	"github.com/grafana/grafana/pkg/expr/mathexp"
	"github.com/stretchr/testify/require"
	ptr "github.com/xorcare/pointer"
)

func TestUnmarshalConditionCMD(t *testing.T) {
	var tests = []struct {
		name            string
		rawJSON         string
		expectedCommand *ConditionsCmd
		needsVars       []string
	}{
		{
			name: "conditions unmarshal test",
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
	trueNumber := valBasedNumber(ptr.Float64(1))
	//falseNumber := valBasedNumber(ptr.Float64(1))
	//noDataNumber := valBasedNumber(ptr.Float64(nil)) ?

	tests := []struct {
		name          string
		vars          mathexp.Vars
		conditionsCmd *ConditionsCmd
		resultNumber  mathexp.Number
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
			resultNumber: trueNumber,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			res, err := tt.conditionsCmd.Execute(context.Background(), tt.vars)
			require.NoError(t, err)

			require.Equal(t, 1, len(res.Values))

			require.Equal(t, tt.resultNumber, res.Values[0])
		})
	}
}
