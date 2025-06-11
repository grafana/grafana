package pyroscope

import (
	"context"
	"testing"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/data"
	typesv1 "github.com/grafana/pyroscope/api/gen/proto/go/types/v1"
	"github.com/stretchr/testify/require"
)

// This is where the tests for the datasource backend live.
func Test_query(t *testing.T) {
	client := &FakeClient{}
	ds := &PyroscopeDatasource{
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

		// The order of the frames is not guaranteed, so we normalize it
		if resp.Frames[0].Fields[0].Name == "level" {
			resp.Frames[1], resp.Frames[0] = resp.Frames[0], resp.Frames[1]
		}

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
		step, ok := client.Args[5].(float64)
		require.True(t, ok)
		require.Equal(t, float64(30), step)
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
		step, ok := client.Args[5].(float64)
		require.True(t, ok)
		require.Equal(t, float64(15), step)
	})

	t.Run("query metrics uses group by", func(t *testing.T) {
		dataQuery := makeDataQuery()
		dataQuery.QueryType = queryTypeMetrics
		dataQuery.JSON = []byte(`{"profileTypeId":"memory:alloc_objects:count:space:bytes","labelSelector":"{app=\\\"baz\\\"}","groupBy":["app","instance"]}`)
		resp := ds.query(context.Background(), pCtx, *dataQuery)
		require.Nil(t, resp.Error)
		groupBy, ok := client.Args[4].([]string)
		require.True(t, ok)
		require.Equal(t, []string{"app", "instance"}, groupBy)
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
	profile := &ProfileResponse{
		Flamebearer: &Flamebearer{
			Names: []string{"func1", "func2", "func3"},
			Levels: []*Level{
				{Values: []int64{0, 20, 1, 2}},
				{Values: []int64{0, 10, 3, 1, 4, 5, 5, 2}},
			},
			Total:   987,
			MaxSelf: 123,
		},
		Units: "short",
	}
	frame := responseToDataFrames(profile)
	require.Equal(t, 4, len(frame.Fields))
	require.Equal(t, data.NewField("level", nil, []int64{0, 1, 1}), frame.Fields[0])
	require.Equal(t, data.NewField("value", nil, []int64{20, 10, 5}).SetConfig(&data.FieldConfig{Unit: "short"}), frame.Fields[1])
	require.Equal(t, data.NewField("self", nil, []int64{1, 3, 5}).SetConfig(&data.FieldConfig{Unit: "short"}), frame.Fields[2])
	require.Equal(t, "label", frame.Fields[3].Name)
	require.Equal(t, []data.EnumItemIndex{0, 1, 2}, fieldValues[data.EnumItemIndex](frame.Fields[3]))
	require.Equal(t, []string{"func1", "func2", "func3"}, frame.Fields[3].Config.TypeConfig.Enum.Text)
}

// This is where the tests for the datasource backend live.
func Test_levelsToTree(t *testing.T) {
	t.Run("simple", func(t *testing.T) {
		levels := []*Level{
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
		levels := []*Level{
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
					{Value: 10, Level: 2, Self: 4, Name: "func1"},
				}},
			},
		}

		frame := treeToNestedSetDataFrame(tree, "short")

		labelConfig := &data.FieldConfig{
			TypeConfig: &data.FieldTypeConfig{
				Enum: &data.EnumFieldConfig{
					Text: []string{"root", "func1", "func2", "func1:func3"},
				},
			},
		}
		require.Equal(t,
			[]*data.Field{
				data.NewField("level", nil, []int64{0, 1, 1, 2, 2}),
				data.NewField("value", nil, []int64{100, 40, 30, 15, 10}).SetConfig(&data.FieldConfig{Unit: "short"}),
				data.NewField("self", nil, []int64{1, 2, 3, 4, 4}).SetConfig(&data.FieldConfig{Unit: "short"}),
				data.NewField("label", nil, []data.EnumItemIndex{0, 1, 2, 3, 1}).SetConfig(labelConfig),
			}, frame.Fields)
	})

	t.Run("nil profile tree", func(t *testing.T) {
		frame := treeToNestedSetDataFrame(nil, "short")
		require.Equal(t, 4, len(frame.Fields))
		require.Equal(t, 0, frame.Fields[0].Len())
	})
}

func Test_seriesToDataFrameAnnotations(t *testing.T) {
	t.Run("annotations field is not added when no annotations are present", func(t *testing.T) {
		series := &SeriesResponse{
			Series: []*Series{
				{
					Labels: []*LabelPair{},
					Points: []*Point{
						{
							Timestamp: int64(1000),
							Value:     30,
						},
						{
							Timestamp: int64(2000),
							Value:     20,
						},
						{
							Timestamp: int64(3000),
							Value:     10,
						},
					},
				},
			},
			Units: "short",
			Label: "samples",
		}

		frames, err := seriesToDataFrames(series, true)
		require.NoError(t, err)
		require.Equal(t, 1, len(frames))
		require.Equal(t, 2, len(frames[0].Fields))
	})

	t.Run("annotations frame can be skipped", func(t *testing.T) {
		rawAnnotation := `{"body":{"periodType":"day","periodLimitMb":1024,"limitResetTime":1609459200}}`

		series := &SeriesResponse{
			Series: []*Series{
				{
					Points: []*Point{
						{
							Timestamp: int64(1609455600000),
							Value:     30,
							Annotations: []*typesv1.ProfileAnnotation{
								{Key: string(profileAnnotationKeyThrottled), Value: rawAnnotation},
							},
						},
					},
				},
			},
		}

		frames, err := seriesToDataFrames(series, false)
		require.NoError(t, err)
		require.Equal(t, 1, len(frames))
	})

	t.Run("throttling annotations are correctly processed", func(t *testing.T) {
		rawAnnotation := `{"body":{"periodType":"day","periodLimitMb":1024,"limitResetTime":1609459200}}`

		series := &SeriesResponse{
			Series: []*Series{
				{
					Points: []*Point{
						{
							Timestamp: int64(1609455600000),
							Value:     30,
							Annotations: []*typesv1.ProfileAnnotation{
								{Key: string(profileAnnotationKeyThrottled), Value: rawAnnotation},
							},
						},
					},
				},
			},
		}

		frames, err := seriesToDataFrames(series, true)
		require.NoError(t, err)
		require.Equal(t, 2, len(frames))

		annotationsFrame := frames[1]
		require.Equal(t, "annotations", annotationsFrame.Name)
		require.Equal(t, data.DataTopicAnnotations, annotationsFrame.Meta.DataTopic)

		require.Equal(t, 5, len(annotationsFrame.Fields))
		require.Equal(t, "time", annotationsFrame.Fields[0].Name)
		require.Equal(t, "timeEnd", annotationsFrame.Fields[1].Name)
		require.Equal(t, "text", annotationsFrame.Fields[2].Name)
		require.Equal(t, "isRegion", annotationsFrame.Fields[3].Name)
		require.Equal(t, "color", annotationsFrame.Fields[4].Name)

		require.Equal(t, 1, annotationsFrame.Fields[0].Len())
		require.Equal(t, time.UnixMilli(1609455600000), annotationsFrame.Fields[0].At(0))
		require.Equal(t, time.UnixMilli(1609459200000), annotationsFrame.Fields[1].At(0))
		require.Contains(t, annotationsFrame.Fields[2].At(0).(string), "Ingestion limit")
	})

	t.Run("non-throttling annotations are ignored", func(t *testing.T) {
		series := &SeriesResponse{
			Series: []*Series{
				{
					Points: []*Point{
						{
							Timestamp: int64(1000),
							Value:     30,
							Annotations: []*typesv1.ProfileAnnotation{
								{Key: "key1", Value: "value1"},
								{Key: "key2", Value: "value2"},
							},
						},
						{
							Timestamp: int64(2000),
							Value:     20,
							Annotations: []*typesv1.ProfileAnnotation{
								{Key: "key3", Value: "value3"},
							},
						},
					},
				},
			},
		}

		frames, err := seriesToDataFrames(series, true)
		require.NoError(t, err)
		require.Equal(t, 2, len(frames))

		annotationsFrame := frames[1]
		require.Equal(t, "annotations", annotationsFrame.Name)
		require.Equal(t, data.DataTopicAnnotations, annotationsFrame.Meta.DataTopic)

		require.Equal(t, 5, len(annotationsFrame.Fields))

		require.Equal(t, 0, annotationsFrame.Fields[0].Len())
		require.Equal(t, 0, annotationsFrame.Fields[1].Len())
		require.Equal(t, 0, annotationsFrame.Fields[2].Len())
		require.Equal(t, 0, annotationsFrame.Fields[3].Len())
		require.Equal(t, 0, annotationsFrame.Fields[4].Len())
	})
}

func Test_seriesToDataFrame(t *testing.T) {
	t.Run("single series", func(t *testing.T) {
		series := &SeriesResponse{
			Series: []*Series{
				{Labels: []*LabelPair{}, Points: []*Point{{Timestamp: int64(1000), Value: 30}, {Timestamp: int64(2000), Value: 10}}},
			},
			Units: "short",
			Label: "samples",
		}
		frames, err := seriesToDataFrames(series, true)
		require.NoError(t, err)
		require.Equal(t, 2, len(frames[0].Fields))
		require.Equal(t, data.NewField("time", nil, []time.Time{time.UnixMilli(1000), time.UnixMilli(2000)}), frames[0].Fields[0])
		require.Equal(t, data.NewField("samples", map[string]string{}, []float64{30, 10}).SetConfig(&data.FieldConfig{Unit: "short"}), frames[0].Fields[1])

		// with a label pair, the value field should name itself with a label pair name and not the profile type
		series = &SeriesResponse{
			Series: []*Series{
				{Labels: []*LabelPair{{Name: "app", Value: "bar"}}, Points: []*Point{{Timestamp: int64(1000), Value: 30}, {Timestamp: int64(2000), Value: 10}}},
			},
			Units: "short",
			Label: "samples",
		}

		frames, err = seriesToDataFrames(series, true)
		require.NoError(t, err)
		require.Equal(t, data.NewField("samples", map[string]string{"app": "bar"}, []float64{30, 10}).SetConfig(&data.FieldConfig{Unit: "short"}), frames[0].Fields[1])
	})

	t.Run("single series", func(t *testing.T) {
		resp := &SeriesResponse{
			Series: []*Series{
				{Labels: []*LabelPair{{Name: "foo", Value: "bar"}}, Points: []*Point{{Timestamp: int64(1000), Value: 30}, {Timestamp: int64(2000), Value: 10}}},
				{Labels: []*LabelPair{{Name: "foo", Value: "baz"}}, Points: []*Point{{Timestamp: int64(1000), Value: 30}, {Timestamp: int64(2000), Value: 10}}},
			},
			Units: "short",
			Label: "samples",
		}
		frames, err := seriesToDataFrames(resp, true)
		require.NoError(t, err)
		require.Equal(t, 2, len(frames))
		require.Equal(t, 2, len(frames[0].Fields))
		require.Equal(t, 2, len(frames[1].Fields))
		require.Equal(t, data.NewField("samples", map[string]string{"foo": "bar"}, []float64{30, 10}).SetConfig(&data.FieldConfig{Unit: "short"}), frames[0].Fields[1])
		require.Equal(t, data.NewField("samples", map[string]string{"foo": "baz"}, []float64{30, 10}).SetConfig(&data.FieldConfig{Unit: "short"}), frames[1].Fields[1])
	})
}

type FakeClient struct {
	Args []any
}

func (f *FakeClient) ProfileTypes(ctx context.Context, start int64, end int64) ([]*ProfileType, error) {
	return []*ProfileType{
		{
			ID:    "type:1",
			Label: "cpu",
		},
		{
			ID:    "type:2",
			Label: "memory",
		},
	}, nil
}

func (f *FakeClient) LabelValues(ctx context.Context, label string, labelSelector string, start int64, end int64) ([]string, error) {
	panic("implement me")
}

func (f *FakeClient) LabelNames(ctx context.Context, labelSelector string, start int64, end int64) ([]string, error) {
	panic("implement me")
}

func (f *FakeClient) GetProfile(ctx context.Context, profileTypeID, labelSelector string, start, end int64, maxNodes *int64) (*ProfileResponse, error) {
	return &ProfileResponse{
		Flamebearer: &Flamebearer{
			Names: []string{"foo", "bar", "baz"},
			Levels: []*Level{
				{Values: []int64{0, 10, 0, 0}},
				{Values: []int64{0, 9, 0, 1}},
				{Values: []int64{0, 8, 8, 2}},
			},
			Total:   100,
			MaxSelf: 56,
		},
		Units: "count",
	}, nil
}

func (f *FakeClient) GetSpanProfile(ctx context.Context, profileTypeID, labelSelector string, spanSelector []string, start, end int64, maxNodes *int64) (*ProfileResponse, error) {
	return &ProfileResponse{
		Flamebearer: &Flamebearer{
			Names: []string{"foo", "bar", "baz"},
			Levels: []*Level{
				{Values: []int64{0, 10, 0, 0}},
				{Values: []int64{0, 9, 0, 1}},
				{Values: []int64{0, 8, 8, 2}},
			},
			Total:   100,
			MaxSelf: 56,
		},
		Units: "count",
	}, nil
}

func (f *FakeClient) GetSeries(ctx context.Context, profileTypeID, labelSelector string, start, end int64, groupBy []string, limit *int64, step float64) (*SeriesResponse, error) {
	f.Args = []any{profileTypeID, labelSelector, start, end, groupBy, step}
	return &SeriesResponse{
		Series: []*Series{
			{
				Labels: []*LabelPair{{Name: "foo", Value: "bar"}},
				Points: []*Point{{Timestamp: int64(1000), Value: 30}, {Timestamp: int64(2000), Value: 10}},
			},
		},
		Units: "count",
		Label: "test",
	}, nil
}
