package phlare

import (
	"context"
	"encoding/json"
	"os"
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

func Test_treeToNestedDataFrame(t *testing.T) {
	tree := &ProfileTree{
		Value: 100, Level: 0, Self: 1, Function: &Function{FunctionName: "root"}, Nodes: []*ProfileTree{
			{
				Value: 40, Level: 1, Self: 2, Function: &Function{FunctionName: "func1", FileName: "1", Line: 1},
			},
			{Value: 30, Level: 1, Self: 3, Function: &Function{FunctionName: "func2", FileName: "2", Line: 2}, Nodes: []*ProfileTree{
				{Value: 15, Level: 2, Self: 4, Function: &Function{FunctionName: "func1:func3", FileName: "3", Line: 3}},
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
	filenameConfig := &data.FieldConfig{
		TypeConfig: &data.FieldTypeConfig{
			Enum: &data.EnumFieldConfig{
				Text: []string{"", "1", "2", "3"},
			},
		},
	}
	require.Equal(t,
		[]*data.Field{
			data.NewField("level", nil, []int64{0, 1, 1, 2}),
			data.NewField("value", nil, []int64{100, 40, 30, 15}).SetConfig(&data.FieldConfig{Unit: "short"}),
			data.NewField("self", nil, []int64{1, 2, 3, 4}).SetConfig(&data.FieldConfig{Unit: "short"}),
			data.NewField("line", nil, []int64{0, 1, 2, 3}),
			data.NewField("label", nil, []int64{0, 1, 2, 3}).SetConfig(labelConfig),
			data.NewField("fileName", nil, []int64{0, 1, 2, 3}).SetConfig(filenameConfig),
		}, frame.Fields)
}

var fooProfile = &googlev1.Profile{
	Location: []*googlev1.Location{
		{Id: 1, Line: []*googlev1.Line{{Line: 5, FunctionId: 4}, {Line: 1, FunctionId: 1}}},
		{Id: 2, Line: []*googlev1.Line{{Line: 2, FunctionId: 2}}},
		{Id: 3, Line: []*googlev1.Line{{Line: 3, FunctionId: 3}}},
	},
	Function: []*googlev1.Function{
		{Id: 1, Name: 1, Filename: 4},
		{Id: 2, Name: 2, Filename: 4},
		{Id: 3, Name: 3, Filename: 5},
		{Id: 4, Name: 6, Filename: 5},
	},
	StringTable: []string{"", "foo", "bar", "baz", "file1", "file2", "inline"},
}

func Test_treeFromSample(t *testing.T) {
	for _, tc := range []struct {
		name string
		s    *googlev1.Sample
		p    *googlev1.Profile
		want *ProfileTree
	}{
		{
			name: "empty lines",
			s:    &googlev1.Sample{LocationId: []uint64{1, 2}, Value: []int64{10}},
			p: &googlev1.Profile{
				Location: []*googlev1.Location{
					{Id: 1, Line: []*googlev1.Line{}},
					{Id: 2, Line: []*googlev1.Line{}},
				},
				Function: []*googlev1.Function{},
			},
			want: &ProfileTree{
				Value: 10,
				Function: &Function{
					FunctionName: "root",
				},
				Nodes: []*ProfileTree{
					{
						Value: 10,
						Function: &Function{
							FunctionName: "<unknown>",
						},
						Level:      1,
						locationID: 2,
						Nodes: []*ProfileTree{
							{
								Value: 10,
								Function: &Function{
									FunctionName: "<unknown>",
								},
								Level:      2,
								Self:       10,
								locationID: 1,
							},
						},
					},
				},
			},
		},
		{
			name: "empty locations",
			s:    &googlev1.Sample{LocationId: []uint64{}, Value: []int64{10}},
			want: &ProfileTree{
				Value: 10,
				Function: &Function{
					FunctionName: "root",
				},
			},
		},
		{
			name: "multiple locations and inlines",
			s:    &googlev1.Sample{LocationId: []uint64{3, 2, 1}, Value: []int64{10}},
			p:    fooProfile,
			want: &ProfileTree{
				Value: 10,
				Function: &Function{
					FunctionName: "root",
				},
				Nodes: []*ProfileTree{
					{
						Value:      10,
						locationID: 1,
						Level:      1,
						Function: &Function{
							FunctionName: "foo",
							FileName:     "file1",
							Line:         1,
						},
						Inlined: []*Function{
							{
								FunctionName: "inline",
								FileName:     "file2",
								Line:         5,
							},
						},
						Nodes: []*ProfileTree{
							{
								Value:      10,
								locationID: 2,
								Level:      2,
								Function: &Function{
									FunctionName: "bar",
									FileName:     "file1",
									Line:         2,
								},
								Nodes: []*ProfileTree{
									{
										Value:      10,
										Self:       10,
										locationID: 3,
										Level:      3,
										Function: &Function{
											FunctionName: "baz",
											FileName:     "file2",
											Line:         3,
										},
									},
								},
							},
						},
					},
				},
			},
		},
	} {
		t.Run(tc.name, func(t *testing.T) {
			setParents(tc.want)
			actual := treeFromSample(tc.p, tc.s, 0)
			require.Equal(t, tc.want, actual, "want\n%s\n got\n%s", tc.want, actual)
		})
	}
}

func Test_TreeString(t *testing.T) {
	t.Log(treeFromSample(fooProfile, &googlev1.Sample{LocationId: []uint64{3, 2, 1}, Value: []int64{10}}, 0))
}

func Test_profileAsTree(t *testing.T) {
	for _, tc := range []struct {
		name string
		want *ProfileTree
		in   *googlev1.Profile
	}{
		{name: "empty"},
		{name: "no sample", in: &googlev1.Profile{}},
		{
			name: "same locations",
			in: &googlev1.Profile{
				Sample: []*googlev1.Sample{
					{LocationId: []uint64{3, 2, 1}, Value: []int64{10}},
					{LocationId: []uint64{3, 2, 1}, Value: []int64{30}},
				},
				Location:    fooProfile.Location,
				Function:    fooProfile.Function,
				StringTable: fooProfile.StringTable,
			},
			want: &ProfileTree{
				Value: 40,
				Function: &Function{
					FunctionName: "root",
				},
				Nodes: []*ProfileTree{
					{
						Value:      40,
						locationID: 1,
						Level:      1,
						Function: &Function{
							FunctionName: "foo",
							FileName:     "file1",
							Line:         1,
						},
						Inlined: []*Function{
							{
								FunctionName: "inline",
								FileName:     "file2",
								Line:         5,
							},
						},
						Nodes: []*ProfileTree{
							{
								Value:      40,
								locationID: 2,
								Level:      2,
								Function: &Function{
									FunctionName: "bar",
									FileName:     "file1",
									Line:         2,
								},
								Nodes: []*ProfileTree{
									{
										Value:      40,
										Self:       40,
										locationID: 3,
										Level:      3,
										Function: &Function{
											FunctionName: "baz",
											FileName:     "file2",
											Line:         3,
										},
									},
								},
							},
						},
					},
				},
			},
		},
		{
			name: "different locations",
			in: &googlev1.Profile{
				Sample: []*googlev1.Sample{
					{LocationId: []uint64{3, 2, 1}, Value: []int64{15}}, // foo -> bar -> baz
					{LocationId: []uint64{3, 2, 1}, Value: []int64{30}}, // foo -> bar -> baz
					{LocationId: []uint64{1, 2, 1}, Value: []int64{20}}, // foo -> bar -> foo
					{LocationId: []uint64{3, 2}, Value: []int64{20}},    // bar -> baz
					{LocationId: []uint64{2, 1}, Value: []int64{40}},    // foo -> bar
					{LocationId: []uint64{1}, Value: []int64{5}},        // foo
					{LocationId: []uint64{}, Value: []int64{5}},
				},
				Location:    fooProfile.Location,
				Function:    fooProfile.Function,
				StringTable: fooProfile.StringTable,
			},
			want: &ProfileTree{
				Value: 130,
				Function: &Function{
					FunctionName: "root",
				},
				Nodes: []*ProfileTree{
					{
						locationID: 2,
						Value:      20,
						Self:       0,
						Level:      1,
						Function: &Function{
							FunctionName: "bar",
							FileName:     "file1",
							Line:         2,
						},
						Nodes: []*ProfileTree{
							{
								locationID: 3,
								Value:      20,
								Self:       20,
								Level:      2,
								Function: &Function{
									FunctionName: "baz",
									FileName:     "file2",
									Line:         3,
								},
							},
						},
					},
					{
						Value:      110,
						Self:       5,
						locationID: 1,
						Level:      1,
						Function: &Function{
							FunctionName: "foo",
							FileName:     "file1",
							Line:         1,
						},
						Inlined: []*Function{
							{
								FunctionName: "inline",
								FileName:     "file2",
								Line:         5,
							},
						},
						Nodes: []*ProfileTree{
							{
								Value:      105,
								Self:       40,
								locationID: 2,
								Level:      2,
								Function: &Function{
									FunctionName: "bar",
									FileName:     "file1",
									Line:         2,
								},
								Nodes: []*ProfileTree{
									{
										Value:      20,
										Self:       20,
										locationID: 1,
										Level:      3,
										Function: &Function{
											FunctionName: "foo",
											FileName:     "file1",
											Line:         1,
										},
										Inlined: []*Function{
											{
												FunctionName: "inline",
												FileName:     "file2",
												Line:         5,
											},
										},
									},
									{
										Value:      45,
										Self:       45,
										locationID: 3,
										Level:      3,
										Function: &Function{
											FunctionName: "baz",
											FileName:     "file2",
											Line:         3,
										},
									},
								},
							},
						},
					},
				},
			},
		},
	} {
		t.Run(tc.name, func(t *testing.T) {
			if tc.want != nil {
				setParents(tc.want)
			}
			actual := profileAsTree(tc.in)
			require.Equal(t, tc.want, actual, "want\n%s\n got\n%s", tc.want, actual)
		})
	}
}

func Benchmark_profileAsTree(b *testing.B) {
	profJson, err := os.ReadFile("./testdata/profile_response.json")
	require.NoError(b, err)
	var prof *googlev1.Profile
	err = json.Unmarshal(profJson, &prof)
	require.NoError(b, err)

	b.ResetTimer()

	for i := 0; i < b.N; i++ {
		profileAsTree(prof)
	}
}

func setParents(root *ProfileTree) {
	for _, n := range root.Nodes {
		n.Parent = root
		setParents(n)
	}
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
