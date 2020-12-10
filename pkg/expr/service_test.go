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
	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/tsdb"
	"github.com/stretchr/testify/require"
)

func TestService(t *testing.T) {
	dsDF := data.NewFrame("test",
		data.NewField("time", nil, []*time.Time{utp(1)}),
		data.NewField("value", nil, []*float64{fp(2)}))

	registerEndPoint(dsDF)

	s := Service{}

	queries := []backend.DataQuery{
		{
			RefID: "A",
			JSON:  json.RawMessage(`{ "datasource": "test", "datasourceId": 1, "orgId": 1, "intervalMs": 1000, "maxDataPoints": 1000 }`),
		},
		{
			RefID: "B",
			JSON:  json.RawMessage(`{ "datasource": "__expr__", "datasourceId": -100, "type": "math", "expression": "$A * 2" }`),
		},
	}

	req := &backend.QueryDataRequest{Queries: queries}

	pl, err := s.BuildPipeline(req)
	require.NoError(t, err)

	res, err := s.ExecutePipeline(context.Background(), pl)
	require.NoError(t, err)

	bDF := data.NewFrame("",
		data.NewField("Time", nil, []*time.Time{utp(1)}),
		data.NewField("", nil, []*float64{fp(4)}))
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

func utp(sec int64) *time.Time {
	t := time.Unix(sec, 0)
	return &t
}

func fp(f float64) *float64 {
	return &f
}

type mockEndpoint struct {
	Frames data.Frames
}

func (me *mockEndpoint) Query(ctx context.Context, ds *models.DataSource, query *tsdb.TsdbQuery) (*tsdb.Response, error) {
	return &tsdb.Response{
		Results: map[string]*tsdb.QueryResult{
			"A": {
				Dataframes: tsdb.NewDecodedDataFrames(me.Frames),
			},
		},
	}, nil
}

func registerEndPoint(df ...*data.Frame) {
	me := &mockEndpoint{
		Frames: df,
	}
	endpoint := func(dsInfo *models.DataSource) (tsdb.TsdbQueryEndpoint, error) {
		return me, nil
	}

	tsdb.RegisterTsdbQueryEndpoint("test", endpoint)
	bus.AddHandler("test", func(query *models.GetDataSourceByIdQuery) error {
		query.Result = &models.DataSource{Id: 1, OrgId: 1, Type: "test"}
		return nil
	})
}
