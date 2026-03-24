package expr

import (
	"encoding/json"
	"testing"

	"github.com/grafana/grafana-plugin-sdk-go/backend/log"
	"github.com/stretchr/testify/require"
	"gonum.org/v1/gonum/graph/simple"

	"github.com/grafana/grafana/pkg/expr/sql"
	"github.com/grafana/grafana/pkg/services/datasources"
	"github.com/grafana/grafana/pkg/setting"
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
	s := Service{
		cfg:    setting.NewCfg(),
		tracer: &testTracer{},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			nodes, err := s.buildPipeline(t.Context(), tt.req)
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

func TestGetCommandsFromPipeline(t *testing.T) {
	pipeline := DataPipeline{
		&MLNode{},
		&DSNode{},
		&CMDNode{
			baseNode: baseNode{},
			CMDType:  0,
			Command:  &ReduceCommand{},
		},
		&CMDNode{
			baseNode: baseNode{},
			CMDType:  0,
			Command:  &ReduceCommand{},
		},
		&CMDNode{
			baseNode: baseNode{},
			CMDType:  0,
			Command:  &HysteresisCommand{},
		},
	}
	t.Run("should find command that exists", func(t *testing.T) {
		cmds := GetCommandsFromPipeline[*HysteresisCommand](pipeline)
		require.Len(t, cmds, 1)
		require.Equal(t, pipeline[4].(*CMDNode).Command, cmds[0])
	})
	t.Run("should find all commands that exist", func(t *testing.T) {
		cmds := GetCommandsFromPipeline[*ReduceCommand](pipeline)
		require.Len(t, cmds, 2)
	})
	t.Run("should not find all command that does not exist", func(t *testing.T) {
		cmds := GetCommandsFromPipeline[*MathCommand](pipeline)
		require.Len(t, cmds, 0)
	})
}

func getRefIDOrder(nodes []Node) []string {
	ids := make([]string, 0, len(nodes))
	for _, n := range nodes {
		ids = append(ids, n.RefID())
	}
	return ids
}

func TestCollectBrokenNodes(t *testing.T) {
	t.Run("single node with missing dependency", func(t *testing.T) {
		graph := simple.NewDirectedGraph()
		mathCmd, err := NewMathCommand("A", "$B")
		require.NoError(t, err)
		mathNode := &CMDNode{
			baseNode: baseNode{id: 0, refID: "A"},
			CMDType:  TypeMath,
			Command:  mathCmd,
		}
		graph.AddNode(mathNode)
		registry := buildNodeRegistry(graph)

		broken := collectBrokenNodes(graph, registry)

		require.Len(t, broken, 1)
		require.Contains(t, broken, "A")
		require.ErrorContains(t, broken["A"], "B")
	})

	t.Run("transitive dependent is also broken", func(t *testing.T) {
		graph := simple.NewDirectedGraph()
		dsNode := &DSNode{baseNode: baseNode{id: 0, refID: "A"}}
		mathCmd, err := NewMathCommand("B", "$NONEXISTENT")
		require.NoError(t, err)
		mathNode := &CMDNode{
			baseNode: baseNode{id: 1, refID: "B"},
			CMDType:  TypeMath,
			Command:  mathCmd,
		}
		reduceCmd, err := NewReduceCommand("C", "mean", "B", nil)
		require.NoError(t, err)
		reduceNode := &CMDNode{
			baseNode: baseNode{id: 2, refID: "C"},
			CMDType:  TypeReduce,
			Command:  reduceCmd,
		}
		graph.AddNode(dsNode)
		graph.AddNode(mathNode)
		graph.AddNode(reduceNode)
		registry := buildNodeRegistry(graph)

		broken := collectBrokenNodes(graph, registry)

		require.Len(t, broken, 2)
		require.Contains(t, broken, "B")
		require.Contains(t, broken, "C")
		require.NotNil(t, graph.Node(dsNode.ID()))
		require.Nil(t, graph.Node(mathNode.ID()))
		require.Nil(t, graph.Node(reduceNode.ID()))
	})

	t.Run("no broken nodes returns empty map", func(t *testing.T) {
		graph := simple.NewDirectedGraph()
		dsNode := &DSNode{baseNode: baseNode{id: 0, refID: "A"}}
		reduceCmd, err := NewReduceCommand("B", "mean", "A", nil)
		require.NoError(t, err)
		reduceNode := &CMDNode{
			baseNode: baseNode{id: 1, refID: "B"},
			CMDType:  TypeReduce,
			Command:  reduceCmd,
		}
		graph.AddNode(dsNode)
		graph.AddNode(reduceNode)
		registry := buildNodeRegistry(graph)

		broken := collectBrokenNodes(graph, registry)

		require.Empty(t, broken)
		require.NotNil(t, graph.Node(dsNode.ID()))
		require.NotNil(t, graph.Node(reduceNode.ID()))
	})

	t.Run("SQL node with missing table gets categorized error", func(t *testing.T) {
		graph := simple.NewDirectedGraph()
		sqlCmd, err := NewSQLCommand(t.Context(), log.NewNullLogger(), "C", "table", "SELECT * FROM nonexistent", 0, 0, 0)
		require.NoError(t, err)
		sqlNode := &CMDNode{
			baseNode: baseNode{id: 0, refID: "C"},
			CMDType:  TypeSQL,
			Command:  sqlCmd,
		}
		graph.AddNode(sqlNode)
		registry := buildNodeRegistry(graph)

		broken := collectBrokenNodes(graph, registry)

		require.Len(t, broken, 1)
		require.Contains(t, broken, "C")
		var catErr *sql.ErrorWithCategory
		require.ErrorAs(t, broken["C"], &catErr)
	})
}
