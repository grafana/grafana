package parca

import (
	"context"
	"testing"
	"time"

	v1alpha11 "buf.build/gen/go/parca-dev/parca/protocolbuffers/go/parca/metastore/v1alpha1"
	profilestore "buf.build/gen/go/parca-dev/parca/protocolbuffers/go/parca/profilestore/v1alpha1"
	v1alpha1 "buf.build/gen/go/parca-dev/parca/protocolbuffers/go/parca/query/v1alpha1"
	"github.com/bufbuild/connect-go"
	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/data"
	"github.com/stretchr/testify/require"
	"google.golang.org/protobuf/types/known/timestamppb"
)

// This is where the tests for the datasource backend live.
func Test_query(t *testing.T) {
	ds := &ParcaDatasource{
		client: &FakeClient{},
	}

	dataQuery := backend.DataQuery{
		RefID:         "A",
		QueryType:     queryTypeBoth,
		MaxDataPoints: 0,
		Interval:      0,
		TimeRange: backend.TimeRange{
			From: time.UnixMilli(10000),
			To:   time.UnixMilli(20000),
		},
		JSON: []byte(`{"profileTypeId":"foo:bar","labelSelector":"{app=\\\"baz\\\"}"}`),
	}

	t.Run("query both", func(t *testing.T) {
		resp := ds.query(context.Background(), backend.PluginContext{}, dataQuery)
		require.Nil(t, resp.Error)
		require.Equal(t, 2, len(resp.Frames))
		require.Equal(t, "time", resp.Frames[0].Fields[0].Name)
		require.Equal(t, data.NewField("level", nil, []int64{0, 1, 2, 3}), resp.Frames[1].Fields[0])
	})

	t.Run("query profile", func(t *testing.T) {
		dataQuery.QueryType = queryTypeProfile
		resp := ds.query(context.Background(), backend.PluginContext{}, dataQuery)
		require.Nil(t, resp.Error)
		require.Equal(t, 1, len(resp.Frames))
		require.Equal(t, data.NewField("level", nil, []int64{0, 1, 2, 3}), resp.Frames[0].Fields[0])
	})

	t.Run("query metrics", func(t *testing.T) {
		dataQuery.QueryType = queryTypeMetrics
		resp := ds.query(context.Background(), backend.PluginContext{}, dataQuery)
		require.Nil(t, resp.Error)
		require.Equal(t, 1, len(resp.Frames))
		require.Equal(t, "time", resp.Frames[0].Fields[0].Name)
	})
}

// This is where the tests for the datasource backend live.
func Test_profileToDataFrame(t *testing.T) {
	frame := responseToDataFrames(flamegraphResponse)
	require.Equal(t, 4, len(frame.Fields))
	require.Equal(t, data.NewField("level", nil, []int64{0, 1, 2, 3}), frame.Fields[0])
	values := data.NewField("value", nil, []int64{100, 10, 9, 8})
	values.Config = &data.FieldConfig{
		Unit: "samples",
	}
	require.Equal(t, values, frame.Fields[1])

	self := data.NewField("self", nil, []int64{90, 1, 1, 8})
	self.Config = &data.FieldConfig{
		Unit: "samples",
	}
	require.Equal(t, self, frame.Fields[2])

	require.Equal(t, data.NewField("label", nil, []string{"total", "foo", "bar", "baz"}), frame.Fields[3])
}

func Test_seriesToDataFrame(t *testing.T) {
	frames := seriesToDataFrame(rangeResponse, "process_cpu:samples:count:cpu:nanoseconds")
	require.Equal(t, 1, len(frames))
	require.Equal(t, 2, len(frames[0].Fields))
	require.Equal(t, data.NewField("time", nil, []time.Time{time.UnixMilli(1000 * 10).UTC(), time.UnixMilli(1000 * 20).UTC()}), frames[0].Fields[0])
	require.Equal(t, data.NewField("samples", map[string]string{"foo": "bar"}, []int64{30, 10}), frames[0].Fields[1])
}

var rangeResponse = &connect.Response[v1alpha1.QueryRangeResponse]{
	Msg: &v1alpha1.QueryRangeResponse{
		Series: []*v1alpha1.MetricsSeries{
			{
				Labelset: &profilestore.LabelSet{
					Labels: []*profilestore.Label{
						{
							Name:  "foo",
							Value: "bar",
						},
					},
				},
				Samples: []*v1alpha1.MetricsSample{
					{
						Timestamp: &timestamppb.Timestamp{
							Seconds: 10,
							Nanos:   0,
						},
						Value: 30,
					},
					{
						Timestamp: &timestamppb.Timestamp{
							Seconds: 20,
							Nanos:   0,
						},
						Value: 10,
					},
				},
				PeriodType: nil,
				SampleType: nil,
			},
		},
	},
}

var flamegraphResponse = &connect.Response[v1alpha1.QueryResponse]{
	Msg: &v1alpha1.QueryResponse{
		Report: &v1alpha1.QueryResponse_Flamegraph{
			Flamegraph: &v1alpha1.Flamegraph{
				Root: &v1alpha1.FlamegraphRootNode{
					Cumulative: 100,
					Diff:       0,
					Children: []*v1alpha1.FlamegraphNode{
						{
							Meta: &v1alpha1.FlamegraphNodeMeta{
								Function: &v1alpha11.Function{
									Name: "foo",
								},
							},
							Cumulative: 10,
							Diff:       0,
							Children: []*v1alpha1.FlamegraphNode{
								{
									Meta: &v1alpha1.FlamegraphNodeMeta{
										Function: &v1alpha11.Function{
											Name: "bar",
										},
									},
									Cumulative: 9,
									Diff:       0,
									Children: []*v1alpha1.FlamegraphNode{
										{
											Meta: &v1alpha1.FlamegraphNodeMeta{
												Function: &v1alpha11.Function{
													Name: "baz",
												},
											},
											Cumulative: 8,
											Diff:       0,
										},
									},
								},
							},
						},
					},
				},
				Total:  100,
				Unit:   "samples",
				Height: 3,
			},
		},
	},
}

type FakeClient struct {
	Req *connect.Request[v1alpha1.QueryRequest]
}

func (f *FakeClient) QueryRange(ctx context.Context, c *connect.Request[v1alpha1.QueryRangeRequest]) (*connect.Response[v1alpha1.QueryRangeResponse], error) {
	return rangeResponse, nil
}

func (f *FakeClient) Query(ctx context.Context, c *connect.Request[v1alpha1.QueryRequest]) (*connect.Response[v1alpha1.QueryResponse], error) {
	f.Req = c
	return flamegraphResponse, nil
}

func (f *FakeClient) Series(ctx context.Context, c *connect.Request[v1alpha1.SeriesRequest]) (*connect.Response[v1alpha1.SeriesResponse], error) {
	//TODO implement me
	panic("implement me")
}

func (f *FakeClient) ProfileTypes(ctx context.Context, c *connect.Request[v1alpha1.ProfileTypesRequest]) (*connect.Response[v1alpha1.ProfileTypesResponse], error) {
	//TODO implement me
	panic("implement me")
}

func (f *FakeClient) Labels(ctx context.Context, c *connect.Request[v1alpha1.LabelsRequest]) (*connect.Response[v1alpha1.LabelsResponse], error) {
	return &connect.Response[v1alpha1.LabelsResponse]{
		Msg: &v1alpha1.LabelsResponse{
			LabelNames: []string{"instance", "job"},
			Warnings:   nil,
		},
	}, nil
}

func (f *FakeClient) Values(ctx context.Context, c *connect.Request[v1alpha1.ValuesRequest]) (*connect.Response[v1alpha1.ValuesResponse], error) {
	return &connect.Response[v1alpha1.ValuesResponse]{
		Msg: &v1alpha1.ValuesResponse{
			LabelValues: []string{"foo", "bar"},
			Warnings:    nil,
		},
	}, nil
}

func (f *FakeClient) ShareProfile(ctx context.Context, c *connect.Request[v1alpha1.ShareProfileRequest]) (*connect.Response[v1alpha1.ShareProfileResponse], error) {
	//TODO implement me
	panic("implement me")
}
