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
