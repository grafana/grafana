package connector

import (
	"context"

	proto "cmf/grafana-datamanager-datasource/pkg/proto"

	"cmf/grafana-datamanager-datasource/pkg/backendapi/client"
	"cmf/grafana-datamanager-datasource/pkg/framer"
	"cmf/grafana-datamanager-datasource/pkg/models"
)

func valueQueryToInput(query models.MetricValueQuery) *proto.GetMetricValueRequest {
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
	return &proto.GetMetricValueRequest{
		Dataset:      query.Dataset,
		Metrics:      metrics,
		Dimensions:   dimensions,
		DisplayNames: displayNames,
	}
}

func GetMetricValue(ctx context.Context, client client.BackendAPIClient, query models.MetricValueQuery) (*framer.MetricValue, error) {
	clientReq := valueQueryToInput(query)

	resp, err := client.GetMetricValue(ctx, clientReq)

	if err != nil {
		return nil, err
	}

	return &framer.MetricValue{
		GetMetricValueResponse: resp,
		Query:                  query,
	}, nil
}
