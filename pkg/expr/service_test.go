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
	"github.com/grafana/grafana/pkg/expr/mathexp"
	"github.com/stretchr/testify/require"
)

func TestService(t *testing.T) {

	dsDF := data.NewFrame("test",
		data.NewField("time", nil, []*time.Time{utp(1)}),
		data.NewField("value", nil, []*float64{fp(2)}))

	//m := newMockTransformCallBack("A", dsDF)

	s := Service{}

	queries := []backend.DataQuery{
		{
			RefID: "A",
			JSON:  json.RawMessage(`{ "datasource": "test", "datasourceId": 3, "orgId": 1, "intervalMs": 1000, "maxDataPoints": 1000 }`),
		},
		{
			RefID: "B",
			JSON:  json.RawMessage(`{ "datasource": "__expr__", "datasourceId": -100, "type": "math", "expression": "$A * 2" }`),
		},
	}

	pl, err := s.BuildPipeline(queries)
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

type mockTransformCallBack struct {
	DataQueryFn func() (*backend.QueryDataResponse, error)
}

func newMockTransformCallBack(refID string, df ...*data.Frame) *mockTransformCallBack {
	return &mockTransformCallBack{
		DataQueryFn: func() (res *backend.QueryDataResponse, err error) {
			series := make([]mathexp.Series, 0, len(df))
			for _, frame := range df {
				s, err := mathexp.SeriesFromFrame(frame)
				if err != nil {
					return res, err
				}
				series = append(series, s)
			}

			frames := make([]*data.Frame, len(series))
			for idx, s := range series {
				frames[idx] = s.AsDataFrame()
			}
			return &backend.QueryDataResponse{
				Responses: map[string]backend.DataResponse{
					refID: {
						Frames: frames,
					},
				},
			}, nil

		},
	}
}

func (m *mockTransformCallBack) QueryData(ctx context.Context, req *backend.QueryDataRequest) (*backend.QueryDataResponse, error) {
	return m.DataQueryFn()
}

func utp(sec int64) *time.Time {
	t := time.Unix(sec, 0)
	return &t
}

func fp(f float64) *float64 {
	return &f
}
