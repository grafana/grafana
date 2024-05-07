package connector

import (
	"context"

	proto "cmf/grafana-datamanager-datasource/pkg/proto"

	"cmf/grafana-datamanager-datasource/pkg/backendapi/client"
	"cmf/grafana-datamanager-datasource/pkg/framer"
	"cmf/grafana-datamanager-datasource/pkg/models"
)

func ListDimensionKeys(ctx context.Context, client client.BackendAPIClient, query models.DimensionKeysQuery) (*framer.DimensionKeys, error) {
	resp, err := client.ListDimensionKeys(ctx, &proto.ListDimensionKeysRequest{
		Dataset: query.Dataset,
	})

	if err != nil {
		return nil, err
	}
	return &framer.DimensionKeys{
		ListDimensionKeysResponse: proto.ListDimensionKeysResponse{
			DimensionKeys: resp.DimensionKeys,
		},
	}, nil
}
