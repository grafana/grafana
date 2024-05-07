package connector

import (
	"context"

	proto "cmf/grafana-datamanager-datasource/pkg/proto"

	"cmf/grafana-datamanager-datasource/pkg/backendapi/client"
	"cmf/grafana-datamanager-datasource/pkg/framer"
	"cmf/grafana-datamanager-datasource/pkg/models"

	"google.golang.org/protobuf/types/known/timestamppb"
)

func historyQueryToInput(query models.MetricHistoryQuery) *proto.GetMetricHistoryRequest {
	metrics := make([]string, len(query.Metrics))
	for i := range query.Metrics {
		metrics[i] = query.Metrics[i].MetricId
	}
	var dimensions []*proto.Dimension
	for _, d := range query.Dimensions {
		dimensions = append(dimensions, &proto.Dimension{
			Key:      d.Key,
			Value:    d.Value,
			Operator: d.Operator,
		})
	}
	var displayNames []*proto.DisplayName
	for _, d := range query.DisplayNames {
		displayNames = append(displayNames, &proto.DisplayName{
			Field: d.Field,
			Value: d.Value,
		})
	}
	return &proto.GetMetricHistoryRequest{
		Dataset:      query.Dataset,
		Metrics:      metrics,
		Dimensions:   dimensions,
		StartDate:    timestamppb.New(query.TimeRange.From),
		EndDate:      timestamppb.New(query.TimeRange.To),
		MaxItems:     query.MaxItems,
		DisplayNames: displayNames,
	}
}

func GetMetricHistory(ctx context.Context, client client.BackendAPIClient, query models.MetricHistoryQuery) (*framer.MetricHistory, error) {
	clientReq := historyQueryToInput(query)

	resp, err := client.GetMetricHistory(ctx, clientReq)

	if err != nil {
		return nil, err
	}
	return &framer.MetricHistory{
		GetMetricHistoryResponse: resp,
		Query:                    query,
	}, nil
}
