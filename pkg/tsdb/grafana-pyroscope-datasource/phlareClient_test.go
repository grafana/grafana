package phlare

import (
	"context"
	"testing"

	"github.com/bufbuild/connect-go"
	googlev1 "github.com/grafana/phlare/api/gen/proto/go/google/v1"
	querierv1 "github.com/grafana/phlare/api/gen/proto/go/querier/v1"
	typesv1 "github.com/grafana/phlare/api/gen/proto/go/types/v1"
	"github.com/stretchr/testify/require"
)

func Test_PhlareClient(t *testing.T) {
	connectClient := &FakePhlareConnectClient{}
	client := &PhlareClient{
		connectClient: connectClient,
	}

	t.Run("GetSeries", func(t *testing.T) {
		resp, err := client.GetSeries(context.Background(), "memory:alloc_objects:count:space:bytes", "{}", 0, 100, []string{}, 15)
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
}

type FakePhlareConnectClient struct {
	Req interface{}
}

func (f *FakePhlareConnectClient) ProfileTypes(ctx context.Context, c *connect.Request[querierv1.ProfileTypesRequest]) (*connect.Response[querierv1.ProfileTypesResponse], error) {
	panic("implement me")
}

func (f *FakePhlareConnectClient) LabelValues(ctx context.Context, c *connect.Request[querierv1.LabelValuesRequest]) (*connect.Response[querierv1.LabelValuesResponse], error) {
	panic("implement me")
}

func (f *FakePhlareConnectClient) LabelNames(context.Context, *connect.Request[querierv1.LabelNamesRequest]) (*connect.Response[querierv1.LabelNamesResponse], error) {
	panic("implement me")
}

func (f *FakePhlareConnectClient) Series(ctx context.Context, c *connect.Request[querierv1.SeriesRequest]) (*connect.Response[querierv1.SeriesResponse], error) {
	panic("implement me")
}

func (f *FakePhlareConnectClient) SelectMergeStacktraces(ctx context.Context, c *connect.Request[querierv1.SelectMergeStacktracesRequest]) (*connect.Response[querierv1.SelectMergeStacktracesResponse], error) {
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

func (f *FakePhlareConnectClient) SelectSeries(ctx context.Context, req *connect.Request[querierv1.SelectSeriesRequest]) (*connect.Response[querierv1.SelectSeriesResponse], error) {
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

func (f *FakePhlareConnectClient) SelectMergeProfile(ctx context.Context, c *connect.Request[querierv1.SelectMergeProfileRequest]) (*connect.Response[googlev1.Profile], error) {
	panic("implement me")
}
