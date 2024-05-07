package connector

import (
	"context"

	proto "cmf/grafana-datamanager-datasource/pkg/proto"

	"cmf/grafana-datamanager-datasource/pkg/backendapi/client"
	"cmf/grafana-datamanager-datasource/pkg/framer"
	"cmf/grafana-datamanager-datasource/pkg/models"
)

func ListDimensionValues(ctx context.Context, client client.BackendAPIClient, query models.DimensionValuesQuery) (*framer.DimensionValues, error) {
	resp, err := client.ListDimensionValues(ctx, &proto.ListDimensionValuesRequest{
		Dataset:      query.Dataset,
		DimensionKey: query.DimensionKey,
		Filter:       query.Filter,
	})

	if err != nil {
		return nil, err
	}
	return &framer.DimensionValues{
		ListDimensionValuesResponse: proto.ListDimensionValuesResponse{
			DimensionValues: resp.DimensionValues,
		},
	}, nil
}
