package phlare

import (
	"context"
	"testing"
	"time"

	"github.com/bufbuild/connect-go"
	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/data"
	"github.com/stretchr/testify/require"

	googlev1 "github.com/grafana/phlare/api/gen/proto/go/google/v1"
	querierv1 "github.com/grafana/phlare/api/gen/proto/go/querier/v1"
	typesv1 "github.com/grafana/phlare/api/gen/proto/go/types/v1"
)

// This is where the tests for the datasource backend live.
func Test_query(t *testing.T) {
	client := &FakeClient{}
	ds := &PhlareDatasource{
		client: client,
	}

	pCtx := backend.PluginContext{
		DataSourceInstanceSettings: &backend.DataSourceInstanceSettings{
			JSONData: []byte(`{"minStep":"30s"}`),
		},
	}

	t.Run("query both", func(t *testing.T) {
		dataQuery := makeDataQuery()
		resp := ds.query(context.Background(), pCtx, *dataQuery)
		require.Nil(t, resp.Error)
		require.Equal(t, 2, len(resp.Frames))
		require.Equal(t, "time", resp.Frames[0].Fields[0].Name)
		require.Equal(t, data.NewField("level", nil, []int64{0, 1, 2}), resp.Frames[1].Fields[0])
	})

	t.Run("query profile", func(t *testing.T) {
		dataQuery := makeDataQuery()
		dataQuery.QueryType = queryTypeProfile
		resp := ds.query(context.Background(), pCtx, *dataQuery)
		require.Nil(t, resp.Error)
		require.Equal(t, 1, len(resp.Frames))
		require.Equal(t, data.NewField("level", nil, []int64{0, 1, 2}), resp.Frames[0].Fields[0])
	})

	t.Run("query metrics", func(t *testing.T) {
		dataQuery := makeDataQuery()
		dataQuery.QueryType = queryTypeMetrics
		resp := ds.query(context.Background(), pCtx, *dataQuery)
		require.Nil(t, resp.Error)
		require.Equal(t, 1, len(resp.Frames))
		require.Equal(t, "time", resp.Frames[0].Fields[0].Name)
	})

	t.Run("query metrics uses min step", func(t *testing.T) {
		dataQuery := makeDataQuery()
		dataQuery.QueryType = queryTypeMetrics
		resp := ds.query(context.Background(), pCtx, *dataQuery)
		require.Nil(t, resp.Error)
		r, ok := client.Req.(*connect.Request[querierv1.SelectSeriesRequest])
		require.True(t, ok)
		require.Equal(t, float64(30), r.Msg.Step)
	})

	t.Run("query metrics uses default min step", func(t *testing.T) {
		dataQuery := makeDataQuery()
		dataQuery.QueryType = queryTypeMetrics
		pCtxNoMinStep := backend.PluginContext{
			DataSourceInstanceSettings: &backend.DataSourceInstanceSettings{
				JSONData: []byte(`{}`),
			},
		}
		resp := ds.query(context.Background(), pCtxNoMinStep, *dataQuery)
		require.Nil(t, resp.Error)
		r, ok := client.Req.(*connect.Request[querierv1.SelectSeriesRequest])
		require.True(t, ok)
		require.Equal(t, float64(15), r.Msg.Step)
	})

	t.Run("query metrics uses group by", func(t *testing.T) {
		dataQuery := makeDataQuery()
		dataQuery.QueryType = queryTypeMetrics
		dataQuery.JSON = []byte(`{"profileTypeId":"memory:alloc_objects:count:space:bytes","labelSelector":"{app=\\\"baz\\\"}","groupBy":["app","instance"]}`)
		resp := ds.query(context.Background(), pCtx, *dataQuery)
		require.Nil(t, resp.Error)
		r, ok := client.Req.(*connect.Request[querierv1.SelectSeriesRequest])
		require.True(t, ok)
		require.Equal(t, []string{"app", "instance"}, r.Msg.GroupBy)
	})
}

func makeDataQuery() *backend.DataQuery {
	return &backend.DataQuery{
		RefID:         "A",
		QueryType:     queryTypeBoth,
		MaxDataPoints: 0,
		Interval:      0,
		TimeRange: backend.TimeRange{
			From: time.UnixMilli(10000),
			To:   time.UnixMilli(20000),
		},
		JSON: []byte(`{"profileTypeId":"memory:alloc_objects:count:space:bytes","labelSelector":"{app=\\\"baz\\\"}"}`),
	}
}

func fieldValues[T any](field *data.Field) []T {
	values := make([]T, field.Len())
	for i := 0; i < field.Len(); i++ {
		values[i] = field.At(i).(T)
	}
	return values
}

// This is where the tests for the datasource backend live.
func Test_profileToDataFrame(t *testing.T) {
	resp := &connect.Response[querierv1.SelectMergeStacktracesResponse]{
		Msg: &querierv1.SelectMergeStacktracesResponse{
			Flamegraph: &querierv1.FlameGraph{
				Names: []string{"func1", "func2", "func3"},
				Levels: []*querierv1.Level{
					{Values: []int64{0, 20, 1, 2}},
					{Values: []int64{0, 10, 3, 1, 4, 5, 5, 2}},
				},
				Total:   987,
				MaxSelf: 123,
			},
		},
	}
	frame := responseToDataFrames(resp.Msg, "memory:alloc_objects:count:space:bytes")
	require.Equal(t, 4, len(frame.Fields))
	require.Equal(t, data.NewField("level", nil, []int64{0, 1, 1}), frame.Fields[0])
	require.Equal(t, data.NewField("value", nil, []int64{20, 10, 5}).SetConfig(&data.FieldConfig{Unit: "short"}), frame.Fields[1])
	require.Equal(t, data.NewField("self", nil, []int64{1, 3, 5}).SetConfig(&data.FieldConfig{Unit: "short"}), frame.Fields[2])
	require.Equal(t, "label", frame.Fields[3].Name)
	require.Equal(t, []int64{0, 1, 2}, fieldValues[int64](frame.Fields[3]))
	require.Equal(t, []string{"func1", "func2", "func3"}, frame.Fields[3].Config.TypeConfig.Enum.Text)
}

// This is where the tests for the datasource backend live.
func Test_levelsToTree(t *testing.T) {
	t.Run("simple", func(t *testing.T) {
		levels := []*querierv1.Level{
			{Values: []int64{0, 100, 0, 0}},
			{Values: []int64{0, 40, 0, 1, 0, 30, 0, 2}},
			{Values: []int64{0, 15, 0, 3}},
		}

		tree := levelsToTree(levels, []string{"root", "func1", "func2", "func1:func3"})
		require.Equal(t, &ProfileTree{
			Start: 0, Value: 100, Level: 0, Name: "root", Nodes: []*ProfileTree{
				{
					Start: 0, Value: 40, Level: 1, Name: "func1", Nodes: []*ProfileTree{
						{Start: 0, Value: 15, Level: 2, Name: "func1:func3"},
					},
				},
				{Start: 40, Value: 30, Level: 1, Name: "func2"},
			},
		}, tree)
	})

	t.Run("medium", func(t *testing.T) {
		levels := []*querierv1.Level{
			{Values: []int64{0, 100, 0, 0}},
			{Values: []int64{0, 40, 0, 1, 0, 30, 0, 2, 0, 30, 0, 3}},
			{Values: []int64{0, 20, 0, 4, 50, 10, 0, 5}},
		}

		tree := levelsToTree(levels, []string{"root", "func1", "func2", "func3", "func1:func4", "func3:func5"})
		require.Equal(t, &ProfileTree{
			Start: 0, Value: 100, Level: 0, Name: "root", Nodes: []*ProfileTree{
				{
					Start: 0, Value: 40, Level: 1, Name: "func1", Nodes: []*ProfileTree{
						{Start: 0, Value: 20, Level: 2, Name: "func1:func4"},
					},
				},
				{Start: 40, Value: 30, Level: 1, Name: "func2"},
				{
					Start: 70, Value: 30, Level: 1, Name: "func3", Nodes: []*ProfileTree{
						{Start: 70, Value: 10, Level: 2, Name: "func3:func5"},
					},
				},
			},
		}, tree)
	})
}

func Test_treeToNestedDataFrame(t *testing.T) {
	t.Run("sample profile tree", func(t *testing.T) {
		tree := &ProfileTree{
			Value: 100, Level: 0, Self: 1, Name: "root", Nodes: []*ProfileTree{
				{
					Value: 40, Level: 1, Self: 2, Name: "func1",
				},
				{Value: 30, Level: 1, Self: 3, Name: "func2", Nodes: []*ProfileTree{
					{Value: 15, Level: 2, Self: 4, Name: "func1:func3"},
				}},
			},
		}

		frame := treeToNestedSetDataFrame(tree, "memory:alloc_objects:count:space:bytes")

		labelConfig := &data.FieldConfig{
			TypeConfig: &data.FieldTypeConfig{
				Enum: &data.EnumFieldConfig{
					Text: []string{"root", "func1", "func2", "func1:func3"},
				},
			},
		}
		require.Equal(t,
			[]*data.Field{
				data.NewField("level", nil, []int64{0, 1, 1, 2}),
				data.NewField("value", nil, []int64{100, 40, 30, 15}).SetConfig(&data.FieldConfig{Unit: "short"}),
				data.NewField("self", nil, []int64{1, 2, 3, 4}).SetConfig(&data.FieldConfig{Unit: "short"}),
				data.NewField("label", nil, []int64{0, 1, 2, 3}).SetConfig(labelConfig),
			}, frame.Fields)
	})

	t.Run("nil profile tree", func(t *testing.T) {
		frame := treeToNestedSetDataFrame(nil, "memory:alloc_objects:count:space:bytes")
		require.Equal(t, 4, len(frame.Fields))
		require.Equal(t, 0, frame.Fields[0].Len())
	})
}

func Test_seriesToDataFrame(t *testing.T) {
	t.Run("single series", func(t *testing.T) {
		resp := &connect.Response[querierv1.SelectSeriesResponse]{
			Msg: &querierv1.SelectSeriesResponse{
				Series: []*typesv1.Series{
					{Labels: []*typesv1.LabelPair{}, Points: []*typesv1.Point{{Timestamp: int64(1000), Value: 30}, {Timestamp: int64(2000), Value: 10}}},
				},
			},
		}
		frames := seriesToDataFrames(resp, "process_cpu:samples:count:cpu:nanoseconds")
		require.Equal(t, 2, len(frames[0].Fields))
		require.Equal(t, data.NewField("time", nil, []time.Time{time.UnixMilli(1000), time.UnixMilli(2000)}), frames[0].Fields[0])
		require.Equal(t, data.NewField("samples", map[string]string{}, []float64{30, 10}).SetConfig(&data.FieldConfig{Unit: "short"}), frames[0].Fields[1])

		// with a label pair, the value field should name itself with a label pair name and not the profile type
		resp = &connect.Response[querierv1.SelectSeriesResponse]{
			Msg: &querierv1.SelectSeriesResponse{
				Series: []*typesv1.Series{
					{Labels: []*typesv1.LabelPair{{Name: "app", Value: "bar"}}, Points: []*typesv1.Point{{Timestamp: int64(1000), Value: 30}, {Timestamp: int64(2000), Value: 10}}},
				},
			},
		}
		frames = seriesToDataFrames(resp, "process_cpu:samples:count:cpu:nanoseconds")
		require.Equal(t, data.NewField("samples", map[string]string{"app": "bar"}, []float64{30, 10}).SetConfig(&data.FieldConfig{Unit: "short"}), frames[0].Fields[1])
	})

	t.Run("single series", func(t *testing.T) {
		resp := &connect.Response[querierv1.SelectSeriesResponse]{
			Msg: &querierv1.SelectSeriesResponse{
				Series: []*typesv1.Series{
					{Labels: []*typesv1.LabelPair{{Name: "foo", Value: "bar"}}, Points: []*typesv1.Point{{Timestamp: int64(1000), Value: 30}, {Timestamp: int64(2000), Value: 10}}},
					{Labels: []*typesv1.LabelPair{{Name: "foo", Value: "baz"}}, Points: []*typesv1.Point{{Timestamp: int64(1000), Value: 30}, {Timestamp: int64(2000), Value: 10}}},
				},
			},
		}
		frames := seriesToDataFrames(resp, "process_cpu:samples:count:cpu:nanoseconds")
		require.Equal(t, 2, len(frames))
		require.Equal(t, 2, len(frames[0].Fields))
		require.Equal(t, 2, len(frames[1].Fields))
		require.Equal(t, data.NewField("samples", map[string]string{"foo": "bar"}, []float64{30, 10}).SetConfig(&data.FieldConfig{Unit: "short"}), frames[0].Fields[1])
		require.Equal(t, data.NewField("samples", map[string]string{"foo": "baz"}, []float64{30, 10}).SetConfig(&data.FieldConfig{Unit: "short"}), frames[1].Fields[1])
	})
}

type FakeClient struct {
	Req interface{}
}

func (f *FakeClient) ProfileTypes(ctx context.Context, c *connect.Request[querierv1.ProfileTypesRequest]) (*connect.Response[querierv1.ProfileTypesResponse], error) {
	panic("implement me")
}

func (f *FakeClient) LabelValues(ctx context.Context, c *connect.Request[querierv1.LabelValuesRequest]) (*connect.Response[querierv1.LabelValuesResponse], error) {
	panic("implement me")
}

func (f *FakeClient) LabelNames(context.Context, *connect.Request[querierv1.LabelNamesRequest]) (*connect.Response[querierv1.LabelNamesResponse], error) {
	panic("implement me")
}

func (f *FakeClient) Series(ctx context.Context, c *connect.Request[querierv1.SeriesRequest]) (*connect.Response[querierv1.SeriesResponse], error) {
	return &connect.Response[querierv1.SeriesResponse]{
		Msg: &querierv1.SeriesResponse{
			LabelsSet: []*typesv1.Labels{{
				Labels: []*typesv1.LabelPair{
					{
						Name:  "__unit__",
						Value: "cpu",
					},
					{
						Name:  "instance",
						Value: "127.0.0.1",
					},
					{
						Name:  "job",
						Value: "default",
					},
				},
			}},
		},
	}, nil
}

func (f *FakeClient) SelectMergeStacktraces(ctx context.Context, c *connect.Request[querierv1.SelectMergeStacktracesRequest]) (*connect.Response[querierv1.SelectMergeStacktracesResponse], error) {
	f.Req = c
	return &connect.Response[querierv1.SelectMergeStacktracesResponse]{
		Msg: &querierv1.SelectMergeStacktracesResponse{
			Flamegraph: &querierv1.FlameGraph{
				Names: []string{"foo", "bar", "baz"},
				Levels: []*querierv1.Level{
					{Values: []int64{0, 10, 0, 0}},
					{Values: []int64{0, 9, 0, 1}},
					{Values: []int64{0, 8, 8, 2}},
				},
				Total:   100,
				MaxSelf: 56,
			},
		},
	}, nil
}

func (f *FakeClient) SelectSeries(ctx context.Context, req *connect.Request[querierv1.SelectSeriesRequest]) (*connect.Response[querierv1.SelectSeriesResponse], error) {
	f.Req = req
	return &connect.Response[querierv1.SelectSeriesResponse]{
		Msg: &querierv1.SelectSeriesResponse{
			Series: []*typesv1.Series{
				{
					Labels: []*typesv1.LabelPair{{Name: "foo", Value: "bar"}},
					Points: []*typesv1.Point{{Timestamp: int64(1000), Value: 30}, {Timestamp: int64(2000), Value: 10}},
				},
			},
		},
	}, nil
}

func (f *FakeClient) SelectMergeProfile(ctx context.Context, c *connect.Request[querierv1.SelectMergeProfileRequest]) (*connect.Response[googlev1.Profile], error) {
	f.Req = c
	p := &googlev1.Profile{
		SampleType: []*googlev1.ValueType{
			{Type: 1, Unit: 2},
		},
		Sample: []*googlev1.Sample{
			{
				Value: []int64{1},
				LocationId: []uint64{
					1, 2,
				},
			},
		},
		Mapping: []*googlev1.Mapping{{Id: 1}},
		Location: []*googlev1.Location{
			{Id: 1, MappingId: 1, Line: []*googlev1.Line{{FunctionId: 1}}},
			{Id: 2, MappingId: 1, Line: []*googlev1.Line{{FunctionId: 2}}},
		},
		Function: []*googlev1.Function{
			{Id: 1, Name: 3},
			{Id: 2, Name: 4},
		},
		StringTable: []string{"", "cpu", "nanoseconds", "foo", "bar"},
	}
	return connect.NewResponse(p), nil
}
