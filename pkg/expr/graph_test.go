package expr

import (
	"encoding/json"
	"sync"
	"testing"

	"github.com/open-feature/go-sdk/openfeature"
	"github.com/open-feature/go-sdk/openfeature/memprovider"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/expr/metrics"
	"github.com/grafana/grafana/pkg/services/datasources"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/setting"
)

var openfeatureTestMutex sync.Mutex

func setupOpenFeatureFlag(t *testing.T, flag string, value bool) {
	t.Helper()
	openfeatureTestMutex.Lock()

	provider, err := featuremgmt.CreateStaticProviderWithStandardFlags(map[string]memprovider.InMemoryFlag{
		flag: setting.NewInMemoryFlag(flag, value),
	})
	require.NoError(t, err)

	err = openfeature.SetProviderAndWait(provider)
	require.NoError(t, err)

	t.Cleanup(func() {
		_ = openfeature.SetProviderAndWait(openfeature.NoopProvider{})
		openfeatureTestMutex.Unlock()
	})
}

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

func TestBuildPipelineDegraded(t *testing.T) {
	t.Run("missing dep marks node disabled when toggle ON", func(t *testing.T) {
		setupOpenFeatureFlag(t, featuremgmt.FlagSseExpressionErrorIsolation, true)
		s := Service{
			cfg:    setting.NewCfg(),
			tracer: &testTracer{},
		}
		req := &Request{
			Queries: []Query{
				{
					RefID: "A",
					DataSource: &datasources.DataSource{
						UID: "Fake",
					},
					TimeRange: AbsoluteTimeRange{},
				},
				{
					RefID:      "B",
					DataSource: dataSourceModel(),
					JSON: json.RawMessage(`{
						"expression": "$NONEXISTENT",
						"type": "math"
					}`),
				},
			},
		}

		pipeline, err := s.buildPipeline(t.Context(), req)
		require.NoError(t, err)
		require.Len(t, pipeline, 2, "both nodes should be in pipeline (B is disabled, not removed)")
		nodeByRefID := make(map[string]Node, len(pipeline))
		for _, n := range pipeline {
			nodeByRefID[n.RefID()] = n
		}
		require.Nil(t, nodeByRefID["A"].DisabledErr(), "node A should be enabled")
		require.Error(t, nodeByRefID["B"].DisabledErr(), "node B should be disabled")
		require.Contains(t, nodeByRefID["B"].DisabledErr().Error(), "NONEXISTENT")
	})

	t.Run("missing dep still hard-fails when toggle OFF", func(t *testing.T) {
		s := Service{
			cfg:    setting.NewCfg(),
			tracer: &testTracer{},
		}
		req := &Request{
			Queries: []Query{
				{
					RefID: "A",
					DataSource: &datasources.DataSource{
						UID: "Fake",
					},
					TimeRange: AbsoluteTimeRange{},
				},
				{
					RefID:      "B",
					DataSource: dataSourceModel(),
					JSON: json.RawMessage(`{
						"expression": "$NONEXISTENT",
						"type": "math"
					}`),
				},
			},
		}

		_, err := s.buildPipeline(t.Context(), req)
		require.Error(t, err)
		require.Contains(t, err.Error(), "find dependent")
	})

	t.Run("structural errors remain fatal even with toggle ON", func(t *testing.T) {
		setupOpenFeatureFlag(t, featuremgmt.FlagSseExpressionErrorIsolation, true)
		s := Service{
			cfg:    setting.NewCfg(),
			tracer: &testTracer{},
		}
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

		_, err := s.buildPipeline(t.Context(), req)
		require.Error(t, err)
		require.Contains(t, err.Error(), "cannot reference itself")
	})
}

func TestBuildPipelinePublicRejectsDegraded(t *testing.T) {
	t.Run("BuildPipeline returns error for broken nodes even with toggle ON", func(t *testing.T) {
		setupOpenFeatureFlag(t, featuremgmt.FlagSseExpressionErrorIsolation, true)
		s := Service{
			cfg:     setting.NewCfg(),
			tracer:  &testTracer{},
			metrics: metrics.NewSSEMetrics(nil),
		}
		req := &Request{
			Queries: []Query{
				{
					RefID: "A",
					DataSource: &datasources.DataSource{
						UID: "Fake",
					},
					TimeRange: AbsoluteTimeRange{},
				},
				{
					RefID:      "B",
					DataSource: dataSourceModel(),
					JSON: json.RawMessage(`{
						"expression": "$NONEXISTENT",
						"type": "math"
					}`),
				},
			},
		}

		_, err := s.BuildPipeline(t.Context(), req)
		require.Error(t, err, "BuildPipeline should reject degraded pipelines")
		require.Contains(t, err.Error(), "NONEXISTENT")
	})
}
