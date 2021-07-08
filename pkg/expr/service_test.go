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
	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/plugins/backendplugin"
	"github.com/grafana/grafana/pkg/plugins/manager"
	"github.com/grafana/grafana/pkg/tsdb"
	"github.com/stretchr/testify/require"
)

// nolint:staticcheck // plugins.DataPlugin deprecated
func TestService(t *testing.T) {
	dsDF := data.NewFrame("test",
		data.NewField("time", nil, []time.Time{time.Unix(1, 0)}),
		data.NewField("value", nil, []*float64{fp(2)}))

	dataSvc := tsdb.NewService()
	dataSvc.PluginManager = &manager.PluginManager{
		BackendPluginManager: fakeBackendPM{},
	}
	s := Service{DataService: &dataSvc}
	me := &mockEndpoint{
		Frames: []*data.Frame{dsDF},
		T:      t,
	}

	s.DataService.RegisterQueryHandler("test", func(*models.DataSource) (plugins.DataPlugin, error) {
		return me, nil
	})

	dsJson := simplejson.New()
	dsJson.Set("timeInterval", "2s")

	bus.AddHandler("test", func(query *models.GetDataSourceQuery) error {
		query.Result = &models.DataSource{Id: 1, OrgId: 1, Type: "test", JsonData: dsJson}
		return nil
	})

	queries := []Query{
		{
			RefID: "A",
			JSON:  json.RawMessage(`{ "datasource": "test", "datasourceId": 1, "orgId": 1, "maxDataPoints": 1000 }`),
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
	T      *testing.T
}

// nolint:staticcheck // plugins.DataQueryResult deprecated
func (me *mockEndpoint) DataQuery(ctx context.Context, ds *models.DataSource, query plugins.DataQuery) (
	plugins.DataResponse, error) {
	require.Equal(me.T, int64(2000), query.Queries[0].IntervalMS)
	return plugins.DataResponse{
		Results: map[string]plugins.DataQueryResult{
			"A": {
				Dataframes: plugins.NewDecodedDataFrames(me.Frames),
			},
		},
	}, nil
}

type fakeBackendPM struct {
	backendplugin.Manager
}
