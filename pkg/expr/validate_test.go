package expr

import (
	"encoding/json"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/services/datasources"
	"github.com/grafana/grafana/pkg/setting"
)

func TestValidatePipeline(t *testing.T) {
	s := Service{
		cfg:    setting.NewCfg(),
		tracer: &testTracer{},
	}

	t.Run("valid pipeline with datasource and expression", func(t *testing.T) {
		req := &Request{
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
		}

		result, err := s.ValidatePipeline(t.Context(), req)
		require.NoError(t, err)
		require.NotNil(t, result)
		assert.True(t, result.IsValid)
		assert.Len(t, result.Nodes, 2)

		// Find the nodes by refID
		nodeMap := make(map[string]int)
		for i, n := range result.Nodes {
			nodeMap[n.RefID] = i
		}

		aIdx := nodeMap["A"]
		bIdx := nodeMap["B"]

		assert.Equal(t, "Expression", result.Nodes[aIdx].NodeType)
		assert.Equal(t, "reduce", result.Nodes[aIdx].CmdType)
		assert.Equal(t, []string{"B"}, result.Nodes[aIdx].DependsOn)
		assert.Empty(t, result.Nodes[aIdx].Error)

		assert.Equal(t, "Datasource", result.Nodes[bIdx].NodeType)
		assert.Equal(t, "Fake", result.Nodes[bIdx].DatasourceUID)
		assert.Empty(t, result.Nodes[bIdx].Error)
	})

	t.Run("missing dependency collected per-node", func(t *testing.T) {
		req := &Request{
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
		}

		result, err := s.ValidatePipeline(t.Context(), req)
		require.NoError(t, err)
		require.NotNil(t, result)
		assert.False(t, result.IsValid)
		assert.Len(t, result.Nodes, 1)
		assert.Contains(t, result.Nodes[0].Error, "unable to find dependent node 'B'")
	})

	t.Run("self reference collected per-node", func(t *testing.T) {
		req := &Request{
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
		}

		result, err := s.ValidatePipeline(t.Context(), req)
		require.NoError(t, err)
		require.NotNil(t, result)
		assert.False(t, result.IsValid)
		assert.Len(t, result.Nodes, 1)
		assert.Contains(t, result.Nodes[0].Error, "cannot reference itself")
	})

	t.Run("cycle detected per-node", func(t *testing.T) {
		req := &Request{
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
		}

		result, err := s.ValidatePipeline(t.Context(), req)
		require.NoError(t, err)
		require.NotNil(t, result)
		assert.False(t, result.IsValid)
		// Both nodes should have cycle errors
		for _, n := range result.Nodes {
			assert.Contains(t, n.Error, "cycle detected")
		}
	})

	t.Run("parse error on one node does not block other nodes", func(t *testing.T) {
		req := &Request{
			Queries: []Query{
				{
					RefID:      "A",
					DataSource: dataSourceModel(),
					JSON:       json.RawMessage(`{"type": "invalid_type_that_does_not_exist"}`),
				},
				{
					RefID: "B",
					DataSource: &datasources.DataSource{
						UID: "Fake",
					},
					TimeRange: AbsoluteTimeRange{},
				},
			},
		}

		result, err := s.ValidatePipeline(t.Context(), req)
		require.NoError(t, err)
		require.NotNil(t, result)
		assert.False(t, result.IsValid)
		assert.Len(t, result.Nodes, 2)

		nodeMap := make(map[string]int)
		for i, n := range result.Nodes {
			nodeMap[n.RefID] = i
		}

		// A has an error (invalid expression type)
		assert.NotEmpty(t, result.Nodes[nodeMap["A"]].Error)
		// B is fine
		assert.Empty(t, result.Nodes[nodeMap["B"]].Error)
	})

	t.Run("missing datasource UID", func(t *testing.T) {
		req := &Request{
			Queries: []Query{
				{
					RefID:      "A",
					DataSource: &datasources.DataSource{},
				},
			},
		}

		result, err := s.ValidatePipeline(t.Context(), req)
		require.NoError(t, err)
		require.NotNil(t, result)
		assert.False(t, result.IsValid)
		assert.Len(t, result.Nodes, 1)
		assert.Contains(t, result.Nodes[0].Error, "missing datasource uid")
	})

	t.Run("classic conditions cannot take expression input", func(t *testing.T) {
		req := &Request{
			Queries: []Query{
				{
					RefID:      "A",
					DataSource: dataSourceModel(),
					JSON: json.RawMessage(`{
						"type": "classic_conditions",
						"conditions": [
							{
								"evaluator": { "params": [2, 3], "type": "within_range" },
								"operator": { "type": "or" },
								"query": { "params": ["B"] },
								"reducer": { "params": [], "type": "diff" },
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
		}

		result, err := s.ValidatePipeline(t.Context(), req)
		require.NoError(t, err)
		require.NotNil(t, result)
		assert.False(t, result.IsValid)

		nodeMap := make(map[string]int)
		for i, n := range result.Nodes {
			nodeMap[n.RefID] = i
		}
		assert.Contains(t, result.Nodes[nodeMap["A"]].Error, "only data source queries may be inputs to a classic condition")
	})
}
