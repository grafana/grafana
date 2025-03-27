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
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/services/datasources"
	datafakes "github.com/grafana/grafana/pkg/services/datasources/fakes"
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

	pl, err := s.BuildPipeline(req)
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

	pl, err := s.BuildPipeline(req)
	require.NoError(t, err)

	res, err := s.ExecutePipeline(context.Background(), time.Now(), pl)
	require.NoError(t, err)

	var utilErr errutil.Error
	require.ErrorContains(t, res.Responses["A"].Error, "womp womp")
	require.ErrorAs(t, res.Responses["B"].Error, &utilErr)
	require.ErrorIs(t, utilErr, DependencyError)
	require.Equal(t, fp(42), res.Responses["C"].Frames[0].Fields[0].At(0))
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
		metrics:      newMetrics(nil),
		converter: &ResultConverter{
			Features: features,
			Tracer:   tracing.InitializeTracerForTest(),
		},
	}, &Request{Queries: queries, User: &user.SignedInUser{}}
}
