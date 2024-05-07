package connector

import (
	"context"

	proto "cmf/grafana-datamanager-datasource/pkg/proto"

	"cmf/grafana-datamanager-datasource/pkg/backendapi/client"
	"cmf/grafana-datamanager-datasource/pkg/framer"
	"cmf/grafana-datamanager-datasource/pkg/models"
)

func ListDatasets(ctx context.Context, client client.BackendAPIClient, query models.DatasetsQuery) (*framer.Datasets, error) {
	resp, err := client.ListDatasets(ctx, &proto.ListDatasetsRequest{
	})

	if err != nil {
		return nil, err
	}
	return &framer.Datasets{
		ListDatasetsResponse: proto.ListDatasetsResponse{
			Datasets: resp.Datasets,
		},
	}, nil
}
