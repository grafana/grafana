package expr

import (
	"encoding/json"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/services/datasources"
)

func TestServicebuildPipeLine(t *testing.T) {
	var tests = []struct {
		name              string
		req               *Request
		expectedOrder     []string
		expectErrContains string
	}{
		{
			name: "simple: a requires b",
			req: &Request{
				Queries: []Query{
					{
						RefID:      "A",
						DataSource: dataSourceModel(),
						JSON: json.RawMessage(`{
							"expression": "B",
							"reducer": "mean",
							"type": "reduce"
						}`),
					},
					{
						RefID: "B",
						DataSource: &datasources.DataSource{
							UID: "Fake",
						},
						TimeRange: AbsoluteTimeRange{},
					},
				},
			},
			expectedOrder: []string{"B", "A"},
		},
		{
			name: "cycle will error",
			req: &Request{
				Queries: []Query{
					{
						RefID:      "A",
						DataSource: dataSourceModel(),
						JSON: json.RawMessage(`{
								"expression": "$B",
								"type": "math"
							}`),
					},
					{
						RefID:      "B",
						DataSource: dataSourceModel(),
						JSON: json.RawMessage(`{
								"expression": "$A",
								"type": "math"
							}`),
					},
				},
			},
			expectErrContains: "cyclic components",
		},
		{
			name: "self reference will error",
			req: &Request{
				Queries: []Query{
					{
						RefID:      "A",
						DataSource: dataSourceModel(),
						JSON: json.RawMessage(`{
								"expression": "$A",
								"type": "math"
							}`),
					},
				},
			},
			expectErrContains: "expression 'A' cannot reference itself. Must be query or another expression",
		},
		{
			name: "missing dependency will error",
			req: &Request{
				Queries: []Query{
					{
						RefID:      "A",
						DataSource: dataSourceModel(),
						JSON: json.RawMessage(`{
								"expression": "$B",
								"type": "math"
							}`),
					},
				},
			},
			expectErrContains: "find dependent",
		},
		{
			name: "classic can not take input from another expression",
			req: &Request{
				Queries: []Query{
					{
						RefID:      "A",
						DataSource: dataSourceModel(),
						JSON: json.RawMessage(`{
							"type": "classic_conditions",
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
										"B"
									]
									},
									"reducer": {
									"params": [],
									"type": "diff"
									},
									"type": "query"
								}
							]
						}`),
					},
					{
						RefID:      "B",
						DataSource: dataSourceModel(),
						JSON: json.RawMessage(`{
							"expression": "C",
							"reducer": "mean",
							"type": "reduce"
						}`),
					},
					{
						RefID: "C",
						DataSource: &datasources.DataSource{
							UID: "Fake",
						},
						TimeRange: AbsoluteTimeRange{},
					},
				},
			},
			expectErrContains: "only data source queries may be inputs to a classic condition",
		},
		{
			name: "classic can not output to another expression",
			req: &Request{
				Queries: []Query{
					{
						RefID:      "A",
						DataSource: dataSourceModel(),
						JSON: json.RawMessage(`{
							"type": "classic_conditions",
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
										"C"
									]
									},
									"reducer": {
									"params": [],
									"type": "diff"
									},
									"type": "query"
								}
							]
						}`),
					},
					{
						RefID:      "B",
						DataSource: dataSourceModel(),
						JSON: json.RawMessage(`{
							"expression": "A",
							"reducer": "mean",
							"type": "reduce"
						}`),
					},
					{
						RefID: "C",
						DataSource: &datasources.DataSource{
							UID: "Fake",
						},
						TimeRange: AbsoluteTimeRange{},
					},
				},
			},
			expectErrContains: "classic conditions may not be the input for other expressions",
		},
		{
			name: "Queries with new datasource ref object",
			req: &Request{
				Queries: []Query{
					{
						RefID:      "A",
						DataSource: dataSourceModel(),
						JSON: json.RawMessage(`{
							"expression": "B",
							"reducer": "mean",
							"type": "reduce"
						}`),
					},
					{
						RefID: "B",
						DataSource: &datasources.DataSource{
							UID: "Fake",
						},
						TimeRange: AbsoluteTimeRange{},
					},
				},
			},
			expectedOrder: []string{"B", "A"},
		},
	}
	s := Service{}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			nodes, err := s.buildPipeline(tt.req)
			if tt.expectErrContains != "" {
				require.Error(t, err)
				require.Contains(t, err.Error(), tt.expectErrContains)
			} else {
				require.NoError(t, err)
				require.Equal(t, tt.expectedOrder, getRefIDOrder(nodes))
			}
		})
	}
}

func getRefIDOrder(nodes []Node) []string {
	ids := make([]string, 0, len(nodes))
	for _, n := range nodes {
		ids = append(ids, n.RefID())
	}
	return ids
}
