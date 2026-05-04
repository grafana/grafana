package expr

import (
	"context"
	"encoding/json"
	"fmt"
	"sort"
	"testing"
	"time"

	"github.com/google/go-cmp/cmp"
	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/data"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/testutil"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/apimachinery/errutil"
	"github.com/grafana/grafana/pkg/expr/metrics"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/services/datasources"
	datafakes "github.com/grafana/grafana/pkg/services/datasources/fakes"
	"github.com/grafana/grafana/pkg/services/dsquerierclient"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/pluginconfig"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/plugincontext"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/pluginstore"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/setting"
)

func TestService(t *testing.T) {
	dsDF := data.NewFrame("test",
		data.NewField("time", nil, []time.Time{time.Unix(1, 0)}),
		data.NewField("value", data.Labels{"test": "label"}, []*float64{fp(2)}),
	)

	resp := map[string]backend.DataResponse{
		"A": {Frames: data.Frames{dsDF}},
	}

	queries := []Query{
		{
			RefID: "A",
			DataSource: &datasources.DataSource{
				OrgID: 1,
				UID:   "test",
				Type:  "test",
			},
			JSON: json.RawMessage(`{ "datasource": { "uid": "1" }, "intervalMs": 1000, "maxDataPoints": 1000 }`),
			TimeRange: AbsoluteTimeRange{
				From: time.Time{},
				To:   time.Time{},
			},
		},
		{
			RefID:      "B",
			DataSource: dataSourceModel(),
			JSON:       json.RawMessage(`{ "datasource": { "uid": "__expr__", "type": "__expr__"}, "type": "math", "expression": "$A * 2" }`),
		},
	}

	s, req := newMockQueryService(resp, queries)

	pl, err := s.BuildPipeline(t.Context(), req)
	require.NoError(t, err)

	res, err := s.ExecutePipeline(context.Background(), time.Now(), pl)
	require.NoError(t, err)

	bDF := data.NewFrame("",
		data.NewField("Time", nil, []time.Time{time.Unix(1, 0)}),
		data.NewField("B", data.Labels{"test": "label"}, []*float64{fp(4)}))
	bDF.RefID = "B"
	bDF.SetMeta(&data.FrameMeta{
		Type:        data.FrameTypeTimeSeriesMulti,
		TypeVersion: data.FrameTypeVersion{0, 1},
	})

	expect := &backend.QueryDataResponse{
		Responses: backend.Responses{
			"A": {
				Frames: []*data.Frame{dsDF},
			},
			"B": {
				Frames: []*data.Frame{bDF},
			},
		},
	}

	// Service currently doesn't care about order of datas in the return.
	trans := cmp.Transformer("Sort", func(in []*data.Frame) []*data.Frame {
		out := append([]*data.Frame(nil), in...) // Copy input to avoid mutating it
		sort.SliceStable(out, func(i, j int) bool {
			return out[i].RefID > out[j].RefID
		})
		return out
	})
	options := append([]cmp.Option{trans}, data.FrameTestCompareOptions()...)
	if diff := cmp.Diff(expect, res, options...); diff != "" {
		t.Errorf("Result mismatch (-want +got):\n%s", diff)
	}
}

func TestDSQueryError(t *testing.T) {
	resp := map[string]backend.DataResponse{
		"A": {Error: fmt.Errorf("womp womp")},
		"B": {Frames: data.Frames{}},
	}

	queries := []Query{
		{
			RefID: "A",
			DataSource: &datasources.DataSource{
				OrgID: 1,
				UID:   "test",
				Type:  "test",
			},
			JSON: json.RawMessage(`{ "datasource": { "uid": "1" }, "intervalMs": 1000, "maxDataPoints": 1000 }`),
			TimeRange: AbsoluteTimeRange{
				From: time.Time{},
				To:   time.Time{},
			},
		},
		{
			RefID:      "B",
			DataSource: dataSourceModel(),
			JSON:       json.RawMessage(`{ "datasource": { "uid": "__expr__", "type": "__expr__"}, "type": "math", "expression": "$A * 2" }`),
		},
		{
			RefID:      "C",
			DataSource: dataSourceModel(),
			JSON:       json.RawMessage(`{ "datasource": { "uid": "__expr__", "type": "__expr__"}, "type": "math", "expression": "42" }`),
		},
	}

	s, req := newMockQueryService(resp, queries)

	pl, err := s.BuildPipeline(t.Context(), req)
	require.NoError(t, err)

	res, err := s.ExecutePipeline(context.Background(), time.Now(), pl)
	require.NoError(t, err)

	var utilErr errutil.Error
	require.ErrorContains(t, res.Responses["A"].Error, "womp womp")
	require.ErrorAs(t, res.Responses["B"].Error, &utilErr)
	require.ErrorIs(t, utilErr, DependencyError)
	require.Equal(t, fp(42), res.Responses["C"].Frames[0].Fields[0].At(0))
}

func TestParseError(t *testing.T) {
	resp := map[string]backend.DataResponse{}

	queries := []Query{
		{
			RefID:      "A",
			DataSource: dataSourceModel(),
			JSON:       json.RawMessage(`{ "datasource": { "uid": "__expr__", "type": "__expr__"}, "type": "math", "expression": "asdf" }`),
		},
	}

	s, req := newMockQueryService(resp, queries)

	_, err := s.BuildPipeline(t.Context(), req)
	require.ErrorContains(t, err, "parse")
	require.ErrorContains(t, err, "math")
	require.ErrorContains(t, err, "asdf")
}

func TestSQLExpressionCellLimitFromConfig(t *testing.T) {
	tests := []struct {
		name            string
		configCellLimit int64
		expectedLimit   int64
	}{
		{
			name:            "should pass default cell limit (0) to SQL command",
			configCellLimit: 0,
			expectedLimit:   0,
		},
		{
			name:            "should pass custom cell limit to SQL command",
			configCellLimit: 5000,
			expectedLimit:   5000,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// Create a request with an SQL expression
			sqlQuery := Query{
				RefID:      "A",
				DataSource: dataSourceModel(),
				JSON:       json.RawMessage(`{ "datasource": { "uid": "__expr__", "type": "__expr__"}, "type": "sql", "expression": "SELECT 1 AS n" }`),
				TimeRange: AbsoluteTimeRange{
					From: time.Time{},
					To:   time.Time{},
				},
			}

			queries := []Query{sqlQuery}

			// Create service with specified cell limit
			cfg := setting.NewCfg()
			cfg.ExpressionsEnabled = true
			cfg.SQLExpressionCellLimit = tt.configCellLimit

			features := featuremgmt.WithFeatures(featuremgmt.FlagSqlExpressions)

			// Create service with our configured limit
			s := &Service{
				cfg:      cfg,
				features: features,
				converter: &ResultConverter{
					Features: features,
				},
				tracer: &testTracer{},
			}

			req := &Request{Queries: queries, User: &user.SignedInUser{}}

			// Build the pipeline
			pipeline, err := s.BuildPipeline(t.Context(), req)
			require.NoError(t, err)

			node := pipeline[0]
			cmdNode := node.(*CMDNode)
			sqlCmd := cmdNode.Command.(*SQLCommand)

			// Verify the SQL command has the correct inputLimit
			require.Equal(t, tt.expectedLimit, sqlCmd.inputLimit, "SQL command has incorrect cell limit")
		})
	}
}

// nonExecutableNode implements Node but not ExecutableNode, to test that
// the pipeline handles non-executable nodes gracefully per-node instead of
// returning a global error.
type nonExecutableNode struct {
	id        int64
	refID     string
	ntype     NodeType
	inputTo   map[string]struct{}
	needsVars []string
}

func (n *nonExecutableNode) ID() int64           { return n.id }
func (n *nonExecutableNode) NodeType() NodeType  { return n.ntype }
func (n *nonExecutableNode) RefID() string       { return n.refID }
func (n *nonExecutableNode) String() string      { return n.refID }
func (n *nonExecutableNode) NeedsVars() []string { return n.needsVars }
func (n *nonExecutableNode) SetInputTo(refID string) {
	if n.inputTo == nil {
		n.inputTo = make(map[string]struct{})
	}
	n.inputTo[refID] = struct{}{}
}
func (n *nonExecutableNode) IsInputTo() map[string]struct{} { return n.inputTo }

func TestUnexpectedNodeTypeIsPerNodeError(t *testing.T) {
	resp := map[string]backend.DataResponse{}

	queries := []Query{
		{
			RefID:      "C",
			DataSource: dataSourceModel(),
			JSON:       json.RawMessage(`{ "datasource": { "uid": "__expr__", "type": "__expr__"}, "type": "math", "expression": "42" }`),
		},
	}

	s, req := newMockQueryService(resp, queries)

	pl, err := s.BuildPipeline(t.Context(), req)
	require.NoError(t, err)

	// Inject a non-executable node into the pipeline before the math node.
	badNode := &nonExecutableNode{id: 99, refID: "X", ntype: TypeCMDNode}
	pl = append(DataPipeline{badNode}, pl...)

	res, err := s.ExecutePipeline(context.Background(), time.Now(), pl)
	// Should not return a global error — per-node errors only
	require.NoError(t, err)

	// X should have a per-node error
	require.Error(t, res.Responses["X"].Error)
	require.ErrorContains(t, res.Responses["X"].Error, "expected executable node type")

	// C should still succeed independently
	require.NoError(t, res.Responses["C"].Error)
	require.Equal(t, fp(42), res.Responses["C"].Frames[0].Fields[0].At(0))
}

func TestMultipleIndependentNodesWithMixedErrors(t *testing.T) {
	resp := map[string]backend.DataResponse{}
	queries := []Query{
		{
			RefID:      "A",
			DataSource: dataSourceModel(),
			JSON:       json.RawMessage(`{ "datasource": { "uid": "__expr__", "type": "__expr__"}, "type": "math", "expression": "1" }`),
		},
		{
			RefID:      "B",
			DataSource: dataSourceModel(),
			JSON:       json.RawMessage(`{ "datasource": { "uid": "__expr__", "type": "__expr__"}, "type": "math", "expression": "2" }`),
		},
	}

	s, req := newMockQueryService(resp, queries)
	pl, err := s.BuildPipeline(t.Context(), req)
	require.NoError(t, err)

	badX := &nonExecutableNode{id: 98, refID: "X", ntype: TypeCMDNode}
	badY := &nonExecutableNode{id: 99, refID: "Y", ntype: TypeCMDNode}
	pl = append(DataPipeline{badX, badY}, pl...)

	res, err := s.ExecutePipeline(context.Background(), time.Now(), pl)
	require.NoError(t, err)

	require.Error(t, res.Responses["X"].Error)
	require.Error(t, res.Responses["Y"].Error)
	require.NoError(t, res.Responses["A"].Error)
	require.NoError(t, res.Responses["B"].Error)
	require.Equal(t, fp(1), res.Responses["A"].Frames[0].Fields[0].At(0))
	require.Equal(t, fp(2), res.Responses["B"].Frames[0].Fields[0].At(0))
}

func TestDependencyChainPartialFailure(t *testing.T) {
	resp := map[string]backend.DataResponse{}
	queries := []Query{
		{
			RefID:      "B",
			DataSource: dataSourceModel(),
			JSON:       json.RawMessage(`{ "datasource": { "uid": "__expr__", "type": "__expr__"}, "type": "math", "expression": "42" }`),
		},
	}

	s, req := newMockQueryService(resp, queries)
	pl, err := s.BuildPipeline(t.Context(), req)
	require.NoError(t, err)

	// A is a bad node; C is a bad node that depends on A.
	// C should get a dependency error because A failed; B is independent and succeeds.
	badA := &nonExecutableNode{id: 97, refID: "A", ntype: TypeCMDNode}
	nodeC := &nonExecutableNode{id: 98, refID: "C", ntype: TypeCMDNode, needsVars: []string{"A"}}
	pl = append(DataPipeline{badA, nodeC}, pl...)

	res, err := s.ExecutePipeline(context.Background(), time.Now(), pl)
	require.NoError(t, err)

	require.Error(t, res.Responses["A"].Error)
	require.Error(t, res.Responses["C"].Error)
	require.NoError(t, res.Responses["B"].Error)
	require.Equal(t, fp(42), res.Responses["B"].Frames[0].Fields[0].At(0))
}

func fp(f float64) *float64 {
	return &f
}

type mockEndpoint struct {
	Responses map[string]backend.DataResponse
}

func (me *mockEndpoint) QueryData(ctx context.Context, req *backend.QueryDataRequest) (*backend.QueryDataResponse, error) {
	resp := backend.NewQueryDataResponse()
	for _, ref := range req.Queries {
		resp.Responses[ref.RefID] = me.Responses[ref.RefID]
	}
	return resp, nil
}

func dataSourceModel() *datasources.DataSource {
	d, _ := DataSourceModelFromNodeType(TypeCMDNode)
	return d
}

func newMockQueryService(responses map[string]backend.DataResponse, queries []Query) (*Service, *Request) {
	me := &mockEndpoint{
		Responses: responses,
	}
	pCtxProvider := plugincontext.ProvideService(setting.NewCfg(), nil, &pluginstore.FakePluginStore{
		PluginList: []pluginstore.Plugin{
			{JSONData: plugins.JSONData{ID: "test"}},
		},
	}, &datafakes.FakeCacheService{}, &datafakes.FakeDataSourceService{}, nil, pluginconfig.NewFakePluginRequestConfigProvider())

	features := featuremgmt.WithFeatures()
	return &Service{
		cfg:          setting.NewCfg(),
		dataService:  me,
		pCtxProvider: pCtxProvider,
		features:     featuremgmt.WithFeatures(),
		tracer:       tracing.InitializeTracerForTest(),
		metrics:      metrics.NewSSEMetrics(nil),
		converter: &ResultConverter{
			Features: features,
			Tracer:   tracing.InitializeTracerForTest(),
		},
		qsDatasourceClientBuilder: dsquerierclient.NewNullQSDatasourceClientBuilder(),
	}, &Request{Queries: queries, User: &user.SignedInUser{}}
}

func newMockQueryServiceWithMetricsRegistry(
	responses map[string]backend.DataResponse,
	queries []Query,
	reg *prometheus.Registry,
) (*Service, *Request) {
	s, req := newMockQueryService(responses, queries)
	// Replace the default metrics with a set bound to our private registry.
	s.metrics = metrics.NewSSEMetrics(reg)
	return s, req
}

func TestTransformDataDegradedPipeline(t *testing.T) {
	dsDF := data.NewFrame("test",
		data.NewField("time", nil, []time.Time{time.Unix(1, 0)}),
		data.NewField("value", data.Labels{"test": "label"}, []*float64{fp(2)}),
	)

	t.Run("returns partial results for broken expressions", func(t *testing.T) {
		setupOpenFeatureFlag(t, featuremgmt.FlagSseExpressionErrorIsolation, true)
		me := &mockEndpoint{
			Responses: map[string]backend.DataResponse{
				"A": {Frames: data.Frames{dsDF}},
			},
		}

		cfg := setting.NewCfg()
		cfg.ExpressionsEnabled = true
		pCtxProvider := plugincontext.ProvideService(cfg, nil, &pluginstore.FakePluginStore{
			PluginList: []pluginstore.Plugin{
				{JSONData: plugins.JSONData{ID: "test"}},
			},
		}, &datafakes.FakeCacheService{}, &datafakes.FakeDataSourceService{}, nil, pluginconfig.NewFakePluginRequestConfigProvider())

		s := Service{
			cfg:                       cfg,
			dataService:               me,
			features:                  featuremgmt.WithFeatures(),
			tracer:                    tracing.NewNoopTracerService(),
			metrics:                   metrics.NewSSEMetrics(prometheus.NewRegistry()),
			pCtxProvider:              pCtxProvider,
			qsDatasourceClientBuilder: dsquerierclient.NewNullQSDatasourceClientBuilder(),
			converter: &ResultConverter{
				Features: featuremgmt.WithFeatures(),
				Tracer:   tracing.NewNoopTracerService(),
			},
		}

		queries := []Query{
			{
				RefID: "A",
				DataSource: &datasources.DataSource{
					OrgID: 1,
					UID:   "test",
					Type:  "test",
				},
				JSON:      json.RawMessage(`{ "datasource": { "uid": "1" }, "intervalMs": 1000, "maxDataPoints": 1000 }`),
				TimeRange: AbsoluteTimeRange{},
			},
			{
				RefID:      "B",
				DataSource: dataSourceModel(),
				JSON:       json.RawMessage(`{ "datasource": { "uid": "__expr__", "type": "__expr__"}, "type": "math", "expression": "$NONEXISTENT * 2" }`),
			},
		}

		req := &Request{Queries: queries, User: &user.SignedInUser{}}
		resp, err := s.TransformData(t.Context(), time.Now(), req)

		require.NoError(t, err, "TransformData should not return error for degraded pipelines")
		require.NotNil(t, resp)

		// A should have data
		require.Contains(t, resp.Responses, "A")
		require.NoError(t, resp.Responses["A"].Error)
		require.NotEmpty(t, resp.Responses["A"].Frames)

		// B should have an error
		require.Contains(t, resp.Responses, "B")
		require.Error(t, resp.Responses["B"].Error)
		require.Contains(t, resp.Responses["B"].Error.Error(), "NONEXISTENT")
	})

	t.Run("still fails entirely when toggle OFF", func(t *testing.T) {
		cfg := setting.NewCfg()
		cfg.ExpressionsEnabled = true

		s := Service{
			cfg:      cfg,
			features: featuremgmt.WithFeatures(),
			tracer:   tracing.NewNoopTracerService(),
			metrics:  metrics.NewSSEMetrics(prometheus.NewRegistry()),
			converter: &ResultConverter{
				Features: featuremgmt.WithFeatures(),
				Tracer:   tracing.NewNoopTracerService(),
			},
		}

		queries := []Query{
			{
				RefID: "A",
				DataSource: &datasources.DataSource{
					OrgID: 1,
					UID:   "test",
					Type:  "test",
				},
				JSON:      json.RawMessage(`{ "datasource": { "uid": "1" }, "intervalMs": 1000, "maxDataPoints": 1000 }`),
				TimeRange: AbsoluteTimeRange{},
			},
			{
				RefID:      "B",
				DataSource: dataSourceModel(),
				JSON:       json.RawMessage(`{ "datasource": { "uid": "__expr__", "type": "__expr__"}, "type": "math", "expression": "$NONEXISTENT * 2" }`),
			},
		}

		req := &Request{Queries: queries, User: &user.SignedInUser{}}
		resp, err := s.TransformData(t.Context(), time.Now(), req)

		require.Error(t, err, "TransformData should fail when toggle is off")
		require.Nil(t, resp)
	})
}

func TestTransformDataDegradedHiddenBrokenNode(t *testing.T) {
	setupOpenFeatureFlag(t, featuremgmt.FlagSseExpressionErrorIsolation, true)
	dsDF := data.NewFrame("test",
		data.NewField("time", nil, []time.Time{time.Unix(1, 0)}),
		data.NewField("value", data.Labels{"test": "label"}, []*float64{fp(2)}),
	)

	me := &mockEndpoint{
		Responses: map[string]backend.DataResponse{
			"A": {Frames: data.Frames{dsDF}},
		},
	}

	cfg := setting.NewCfg()
	cfg.ExpressionsEnabled = true
	pCtxProvider := plugincontext.ProvideService(cfg, nil, &pluginstore.FakePluginStore{
		PluginList: []pluginstore.Plugin{
			{JSONData: plugins.JSONData{ID: "test"}},
		},
	}, &datafakes.FakeCacheService{}, &datafakes.FakeDataSourceService{}, nil, pluginconfig.NewFakePluginRequestConfigProvider())

	s := Service{
		cfg:                       cfg,
		dataService:               me,
		features:                  featuremgmt.WithFeatures(),
		tracer:                    tracing.NewNoopTracerService(),
		metrics:                   metrics.NewSSEMetrics(prometheus.NewRegistry()),
		pCtxProvider:              pCtxProvider,
		qsDatasourceClientBuilder: dsquerierclient.NewNullQSDatasourceClientBuilder(),
		converter: &ResultConverter{
			Features: featuremgmt.WithFeatures(),
			Tracer:   tracing.NewNoopTracerService(),
		},
	}

	queries := []Query{
		{
			RefID: "A",
			DataSource: &datasources.DataSource{
				OrgID: 1,
				UID:   "test",
				Type:  "test",
			},
			JSON:      json.RawMessage(`{ "datasource": { "uid": "1" }, "intervalMs": 1000, "maxDataPoints": 1000 }`),
			TimeRange: AbsoluteTimeRange{},
		},
		{
			RefID:      "B",
			DataSource: dataSourceModel(),
			JSON:       json.RawMessage(`{ "datasource": { "uid": "__expr__", "type": "__expr__"}, "type": "math", "expression": "$NONEXISTENT * 2", "hide": true }`),
		},
	}

	req := &Request{Queries: queries, User: &user.SignedInUser{}}
	resp, err := s.TransformData(t.Context(), time.Now(), req)

	require.NoError(t, err)
	require.NotNil(t, resp)

	// A should have data
	require.Contains(t, resp.Responses, "A")

	// B should be excluded (hidden), even though it's broken
	require.NotContains(t, resp.Responses, "B")
}

// Return the value of a prometheus counter with the given labels to test if it has been incremented, if the labels don't exist 0 will still be returned.
func counterVal(t *testing.T, cv *prometheus.CounterVec, labels ...string) float64 {
	t.Helper()
	ch, err := cv.GetMetricWithLabelValues(labels...)
	require.NoError(t, err)
	return testutil.ToFloat64(ch)
}
