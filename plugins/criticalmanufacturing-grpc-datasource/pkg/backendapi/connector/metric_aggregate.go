package connector

import (
	"context"

	proto "cmf/grafana-datamanager-datasource/pkg/proto"

	"cmf/grafana-datamanager-datasource/pkg/backendapi/client"
	"cmf/grafana-datamanager-datasource/pkg/framer"
	"cmf/grafana-datamanager-datasource/pkg/models"

	"fmt"
	"strings"

	"google.golang.org/protobuf/types/known/timestamppb"
)

func aggregateQueryToInput(query models.MetricAggregateQuery) (*proto.GetMetricAggregateRequest, error) {
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
	var aggregations []*proto.GetMetricAggregateRequest_Aggregation
	for _, a := range query.Aggregations {
		aggType, err := parseAggregationType(a.AggregationType)
		if err != nil {
			return nil, err
		}
		aggregations = append(aggregations, &proto.GetMetricAggregateRequest_Aggregation{
			AggregationType:  aggType,
			AggregatedFields: a.AggregatedFields,
			Alias:            a.Alias,
		})
	}
	metrics := make([]string, len(query.Metrics))
	for i := range query.Metrics {
		metrics[i] = query.Metrics[i].MetricId
	}
	return &proto.GetMetricAggregateRequest{
		Dimensions:   dimensions,
		Metrics:      metrics,
		StartDate:    timestamppb.New(query.TimeRange.From),
		EndDate:      timestamppb.New(query.TimeRange.To),
		Dataset:      query.Dataset,
		MaxItems:     query.MaxItems,
		DisplayNames: displayNames,
		OrderBy:      orderBy,
		Aggregations: aggregations,
	}, nil
}

func parseOrderByExpression(s string) (proto.OrderBy_OrderByExpression, error) {
	switch strings.ToLower(s) {
	case strings.ToLower(proto.OrderBy_ASC.String()):
		return proto.OrderBy_ASC, nil
	case strings.ToLower(proto.OrderBy_DESC.String()):
		return proto.OrderBy_DESC, nil
	default:
		var t proto.OrderBy_OrderByExpression
		return t, fmt.Errorf("orderBy expression %s is not supported by backend plugin", s)
	}
}

func parseAggregationType(s string) (proto.GetMetricAggregateRequest_Aggregation_AggregationType, error) {
	switch strings.ToLower(s) {
	case strings.ToLower(proto.GetMetricAggregateRequest_Aggregation_SUM.String()):
		return proto.GetMetricAggregateRequest_Aggregation_SUM, nil
	case strings.ToLower(proto.GetMetricAggregateRequest_Aggregation_AVG.String()):
		return proto.GetMetricAggregateRequest_Aggregation_AVG, nil
	case strings.ToLower(proto.GetMetricAggregateRequest_Aggregation_RATIO_OF_SUMS.String()):
		return proto.GetMetricAggregateRequest_Aggregation_RATIO_OF_SUMS, nil
	case strings.ToLower(proto.GetMetricAggregateRequest_Aggregation_COUNT.String()):
		return proto.GetMetricAggregateRequest_Aggregation_COUNT, nil
	default:
		var t proto.GetMetricAggregateRequest_Aggregation_AggregationType
		return t, fmt.Errorf("aggregation type %s is not supported by backend plugin", s)
	}
}

func GetMetricAggregate(ctx context.Context, client client.BackendAPIClient, query models.MetricAggregateQuery) (*framer.MetricAggregate, error) {
	clientReq, err := aggregateQueryToInput(query)
	if err != nil {
		return nil, err
	}

	resp, err := client.GetMetricAggregate(ctx, clientReq)

	if err != nil {
		return nil, err
	}
	return &framer.MetricAggregate{
		GetMetricAggregateResponse: resp,
		Query:                      query,
	}, nil
}
