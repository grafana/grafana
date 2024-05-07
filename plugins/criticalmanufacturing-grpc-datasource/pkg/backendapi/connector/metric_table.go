package connector

import (
	"context"

	proto "cmf/grafana-datamanager-datasource/pkg/proto"

	"cmf/grafana-datamanager-datasource/pkg/backendapi/client"
	"cmf/grafana-datamanager-datasource/pkg/framer"
	"cmf/grafana-datamanager-datasource/pkg/models"
)

func tableQueryToInput(query models.MetricTableQuery) (*proto.GetMetricTableRequest, error) {
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
	var orderBy []*proto.OrderBy
	for _, o := range query.OrderBy {
		orderByExp, err := parseOrderByExpression(o.Expression)
		if err != nil {
			return nil, err
		}
		orderBy = append(orderBy, &proto.OrderBy{
			Field:      o.Field,
			Expression: orderByExp,
		})
	}
	return &proto.GetMetricTableRequest{
		Dataset:      query.Dataset,
		Metrics:      metrics,
		Dimensions:   dimensions,
		DisplayNames: displayNames,
		OrderBy:      orderBy,
		PageSize:     query.MaxItems,
	}, nil
}

func GetMetricTable(ctx context.Context, client client.BackendAPIClient, query models.MetricTableQuery) (*framer.MetricTable, error) {
	clientReq, err := tableQueryToInput(query)

	resp, err := client.GetMetricTable(ctx, clientReq)

	if err != nil {
		return nil, err
	}
	return &framer.MetricTable{
		GetMetricTableResponse: resp,
		Query:                    query,
	}, nil
}
