package expr

import (
	"context"
	"encoding/json"
	"sort"
	"testing"
	"time"

	"github.com/google/go-cmp/cmp"
	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/data"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/services/datasources"
	datafakes "github.com/grafana/grafana/pkg/services/datasources/fakes"
	"github.com/grafana/grafana/pkg/setting"
)

func TestService(t *testing.T) {
	dsDF := data.NewFrame("test",
		data.NewField("time", nil, []time.Time{time.Unix(1, 0)}),
		data.NewField("value", nil, []*float64{fp(2)}))

	me := &mockEndpoint{
		Frames: []*data.Frame{dsDF},
	}

	cfg := setting.NewCfg()

	s := Service{
		cfg:               cfg,
		dataService:       me,
		dataSourceService: &datafakes.FakeDataSourceService{},
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
			DataSource: DataSourceModel(),
			JSON:       json.RawMessage(`{ "datasource": { "uid": "__expr__", "type": "__expr__"}, "type": "math", "expression": "$A * 2" }`),
		},
	}

	req := &Request{Queries: queries}

	pl, err := s.BuildPipeline(req)
	require.NoError(t, err)

	res, err := s.ExecutePipeline(context.Background(), time.Now(), pl)
	require.NoError(t, err)

	bDF := data.NewFrame("",
		data.NewField("Time", nil, []time.Time{time.Unix(1, 0)}),
		data.NewField("B", nil, []*float64{fp(4)}))
	bDF.RefID = "B"

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

func fp(f float64) *float64 {
	return &f
}

type mockEndpoint struct {
	Frames data.Frames
}

func (me *mockEndpoint) QueryData(ctx context.Context, req *backend.QueryDataRequest) (*backend.QueryDataResponse, error) {
	resp := backend.NewQueryDataResponse()
	resp.Responses["A"] = backend.DataResponse{
		Frames: me.Frames,
	}
	return resp, nil
}
