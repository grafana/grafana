package connector

import (
	"context"

	proto "cmf/grafana-datamanager-datasource/pkg/proto"

	"cmf/grafana-datamanager-datasource/pkg/backendapi/client"
	"cmf/grafana-datamanager-datasource/pkg/framer"
	"cmf/grafana-datamanager-datasource/pkg/models"
)

func ListMetrics(ctx context.Context, client client.BackendAPIClient, query models.MetricsQuery) (*framer.Metrics, error) {
	resp, err := client.ListMetrics(ctx, &proto.ListMetricsRequest{
		Dataset: query.Dataset,
	})

	if err != nil {
		return nil, err
	}
	return &framer.Metrics{
		ListMetricsResponse: proto.ListMetricsResponse{
			Metrics: resp.Metrics,
		},
	}, nil
}
