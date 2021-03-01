package classic

import (
	"encoding/json"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestUnmarshalConditionCMD(t *testing.T) {
	var tests = []struct {
		name            string
		rawJSON         string
		expectedCommand *ConditionsCmd
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
		})
	}
}
