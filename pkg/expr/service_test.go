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
	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/encryption/ossencryption"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/stretchr/testify/require"
)

func TestService(t *testing.T) {
	dsDF := data.NewFrame("test",
		data.NewField("time", nil, []time.Time{time.Unix(1, 0)}),
		data.NewField("value", nil, []*float64{fp(2)}))

	me := &mockEndpoint{
		Frames: []*data.Frame{dsDF},
	}
	s := Service{
		cfg:               setting.NewCfg(),
		dataService:       me,
		encryptionService: ossencryption.ProvideService(),
	}
	bus.AddHandlerCtx("test", func(_ context.Context, query *models.GetDataSourceQuery) error {
		query.Result = &models.DataSource{Id: 1, OrgId: 1, Type: "test", JsonData: simplejson.New()}
		return nil
	})

	queries := []Query{
		{
			RefID: "A",
			JSON:  json.RawMessage(`{ "datasource": "test", "datasourceId": 1, "orgId": 1, "intervalMs": 1000, "maxDataPoints": 1000 }`),
		},
		{
			RefID: "B",
			JSON:  json.RawMessage(`{ "datasource": "__expr__", "datasourceId": -100, "type": "math", "expression": "$A * 2" }`),
		},
	}

	req := &Request{Queries: queries}

	pl, err := s.BuildPipeline(req)
	require.NoError(t, err)

	res, err := s.ExecutePipeline(context.Background(), pl)
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
