package pyroscope

import (
	"context"
	"testing"

	"connectrpc.com/connect"
	googlev1 "github.com/grafana/pyroscope/api/gen/proto/go/google/v1"
	querierv1 "github.com/grafana/pyroscope/api/gen/proto/go/querier/v1"
	typesv1 "github.com/grafana/pyroscope/api/gen/proto/go/types/v1"
	"github.com/stretchr/testify/require"
)

func Test_PyroscopeClient(t *testing.T) {
	connectClient := &FakePyroscopeConnectClient{}
	client := &PyroscopeClient{
		connectClient: connectClient,
	}

	t.Run("GetSeries", func(t *testing.T) {
		limit := int64(42)
		resp, err := client.GetSeries(context.Background(), "memory:alloc_objects:count:space:bytes", "{}", 0, 100, []string{}, &limit, 15)
		require.Nil(t, err)

		series := &SeriesResponse{
			Series: []*Series{
				{Labels: []*LabelPair{{Name: "foo", Value: "bar"}}, Points: []*Point{{Timestamp: int64(1000), Value: 30}, {Timestamp: int64(2000), Value: 10}}},
			},
			Units: "short",
			Label: "alloc_objects",
		}
		require.Equal(t, series, resp)
	})

	t.Run("GetProfile", func(t *testing.T) {
		maxNodes := int64(-1)
		resp, err := client.GetProfile(context.Background(), "memory:alloc_objects:count:space:bytes", "{}", 0, 100, &maxNodes)
		require.Nil(t, err)

		series := &ProfileResponse{
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
			Units: "short",
		}
		require.Equal(t, series, resp)
	})

	t.Run("GetProfile with empty response", func(t *testing.T) {
		connectClient.SendEmptyProfileResponse = true
		maxNodes := int64(-1)
		resp, err := client.GetProfile(context.Background(), "memory:alloc_objects:count:space:bytes", "{}", 0, 100, &maxNodes)
		require.Nil(t, err)
		// Mainly ensuring this does not panic like before
		require.Nil(t, resp)
		connectClient.SendEmptyProfileResponse = false
	})
}

type FakePyroscopeConnectClient struct {
	Req                      any
	SendEmptyProfileResponse bool
}

func (f *FakePyroscopeConnectClient) LabelValues(ctx context.Context, c *connect.Request[typesv1.LabelValuesRequest]) (*connect.Response[typesv1.LabelValuesResponse], error) {
	//TODO implement me
	panic("implement me")
}

func (f *FakePyroscopeConnectClient) LabelNames(ctx context.Context, c *connect.Request[typesv1.LabelNamesRequest]) (*connect.Response[typesv1.LabelNamesResponse], error) {
	//TODO implement me
	panic("implement me")
}

func (f *FakePyroscopeConnectClient) Diff(ctx context.Context, c *connect.Request[querierv1.DiffRequest]) (*connect.Response[querierv1.DiffResponse], error) {
	//TODO implement me
	panic("implement me")
}

func (f *FakePyroscopeConnectClient) ProfileTypes(ctx context.Context, c *connect.Request[querierv1.ProfileTypesRequest]) (*connect.Response[querierv1.ProfileTypesResponse], error) {
	panic("implement me")
}

func (f *FakePyroscopeConnectClient) Series(ctx context.Context, c *connect.Request[querierv1.SeriesRequest]) (*connect.Response[querierv1.SeriesResponse], error) {
	panic("implement me")
}

func (f *FakePyroscopeConnectClient) SelectMergeStacktraces(ctx context.Context, c *connect.Request[querierv1.SelectMergeStacktracesRequest]) (*connect.Response[querierv1.SelectMergeStacktracesResponse], error) {
	f.Req = c
	if f.SendEmptyProfileResponse {
		return &connect.Response[querierv1.SelectMergeStacktracesResponse]{Msg: &querierv1.SelectMergeStacktracesResponse{}}, nil
	}
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

func (f *FakePyroscopeConnectClient) SelectSeries(ctx context.Context, req *connect.Request[querierv1.SelectSeriesRequest]) (*connect.Response[querierv1.SelectSeriesResponse], error) {
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

func (f *FakePyroscopeConnectClient) SelectMergeProfile(ctx context.Context, c *connect.Request[querierv1.SelectMergeProfileRequest]) (*connect.Response[googlev1.Profile], error) {
	panic("implement me")
}

func (f *FakePyroscopeConnectClient) SelectMergeSpanProfile(ctx context.Context, c *connect.Request[querierv1.SelectMergeSpanProfileRequest]) (*connect.Response[querierv1.SelectMergeSpanProfileResponse], error) {
	panic("implement me")
}

func (f *FakePyroscopeConnectClient) AnalyzeQuery(ctx context.Context, c *connect.Request[querierv1.AnalyzeQueryRequest]) (*connect.Response[querierv1.AnalyzeQueryResponse], error) {
	panic("implement me")
}

func (f *FakePyroscopeConnectClient) GetProfileStats(ctx context.Context, c *connect.Request[typesv1.GetProfileStatsRequest]) (*connect.Response[typesv1.GetProfileStatsResponse], error) {
	panic("implement me")
}
