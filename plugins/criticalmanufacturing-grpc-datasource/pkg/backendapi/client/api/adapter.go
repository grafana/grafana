package v2

import (
	proto "cmf/grafana-datamanager-datasource/pkg/proto"
	"context"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"google.golang.org/grpc"
)

type adapter struct {
	v2Client proto.DataManagerServicesClient
}

func (b *adapter) ListDimensionKeys(ctx context.Context, in *proto.ListDimensionKeysRequest, opts ...grpc.CallOption) (*proto.ListDimensionKeysResponse, error) {
	inv2 := &proto.ListDimensionKeysRequest{
		Dataset: in.Dataset,
	}
	res, err := b.v2Client.ListDimensionKeys(ctx, inv2, opts...)
	if err != nil {
		return nil, err
	}
	r := make([]*proto.ListDimensionKeysResponse_DimensionKey, len(res.DimensionKeys))
	for i := range res.DimensionKeys {
		r[i] = &proto.ListDimensionKeysResponse_DimensionKey{
			Key:         res.DimensionKeys[i].Key,
			Description: res.DimensionKeys[i].Description,
		}
	}
	return &proto.ListDimensionKeysResponse{
		DimensionKeys: r,
	}, nil
}

func (b *adapter) ListDimensionValues(ctx context.Context, in *proto.ListDimensionValuesRequest, opts ...grpc.CallOption) (*proto.ListDimensionValuesResponse, error) {
	inv2 := &proto.ListDimensionValuesRequest{
		Dataset:      in.Dataset,
		DimensionKey: in.DimensionKey,
		Filter:       in.Filter,
	}
	res, err := b.v2Client.ListDimensionValues(ctx, inv2, opts...)
	if err != nil {
		return nil, err
	}
	r := make([]*proto.ListDimensionValuesResponse_DimensionValue, len(res.DimensionValues))
	for i := range res.DimensionValues {
		r[i] = &proto.ListDimensionValuesResponse_DimensionValue{
			Value:       res.DimensionValues[i].Value,
			Description: res.DimensionValues[i].Description,
		}
	}
	return &proto.ListDimensionValuesResponse{
		DimensionValues: r,
	}, nil
}

func (b *adapter) ListMetrics(ctx context.Context, in *proto.ListMetricsRequest, opts ...grpc.CallOption) (*proto.ListMetricsResponse, error) {
	inv2 := &proto.ListMetricsRequest{
		Dataset: in.Dataset,
	}
	res, err := b.v2Client.ListMetrics(ctx, inv2, opts...)
	if err != nil {
		return nil, err
	}
	r := make([]*proto.ListMetricsResponse_Metric, len(res.Metrics))
	for i := range res.Metrics {
		r[i] = &proto.ListMetricsResponse_Metric{
			Name:        res.Metrics[i].Name,
			Description: res.Metrics[i].Description,
		}
	}
	return &proto.ListMetricsResponse{
		Metrics: r,
	}, nil
}

func (b *adapter) ListDatasets(ctx context.Context, in *proto.ListDatasetsRequest, opts ...grpc.CallOption) (*proto.ListDatasetsResponse, error) {
	inv2 := &proto.ListDatasetsRequest{}

	res, err := b.v2Client.ListDatasets(ctx, inv2, opts...)
	if err != nil {
		return nil, err
	}
	r := make([]*proto.ListDatasetsResponse_Dataset, len(res.Datasets))
	for i := range res.Datasets {
		r[i] = &proto.ListDatasetsResponse_Dataset{
			Name:        res.Datasets[i].Name,
			Description: res.Datasets[i].Description,
		}
	}
	return &proto.ListDatasetsResponse{
		Datasets: r,
	}, nil
}

func (b *adapter) GetMetricValue(ctx context.Context, in *proto.GetMetricValueRequest, opts ...grpc.CallOption) (*proto.GetMetricValueResponse, error) {
	if len(in.Metrics) == 0 {
		return &proto.GetMetricValueResponse{}, nil
	}

	inv2 := &proto.GetMetricValueRequest{
		Dataset:      in.Dataset,
		Metrics:      in.Metrics,
		Dimensions:   in.Dimensions,
		DisplayNames: in.DisplayNames,
	}
	res, err := b.v2Client.GetMetricValue(ctx, inv2, opts...)
	if err != nil {
		return nil, err
	}

	return &proto.GetMetricValueResponse{
		Frames: res.Frames,
	}, nil
}

func (b *adapter) GetMetricHistory(ctx context.Context, in *proto.GetMetricHistoryRequest, opts ...grpc.CallOption) (*proto.GetMetricHistoryResponse, error) {
	if len(in.Metrics) == 0 {
		return &proto.GetMetricHistoryResponse{}, nil
	}

	backend.Logger.Info("GetMetricHistory")

	inv2 := &proto.GetMetricHistoryRequest{
		Dataset:      in.Dataset,
		Metrics:      in.Metrics,
		Dimensions:   in.Dimensions,
		StartDate:    in.StartDate,
		EndDate:      in.EndDate,
		MaxItems:     in.MaxItems,
		DisplayNames: in.DisplayNames,
	}
	res, err := b.v2Client.GetMetricHistory(ctx, inv2, opts...)

	if err != nil {
		return nil, err
	}

	return &proto.GetMetricHistoryResponse{
		Frames: res.Frames,
	}, nil
}

func getTime(timeInSeconds int64) time.Time {
	return time.Unix(timeInSeconds, 0)
}
