package clients

import (
	"context"

	"github.com/aws/aws-sdk-go-v2/service/cloudwatch"

	"github.com/grafana/grafana/pkg/tsdb/cloudwatch/models/resources"
)

type MetricsClient struct {
	cloudwatch.ListMetricsAPIClient

	listMetricsPageLimit int
}

func NewMetricsClient(client cloudwatch.ListMetricsAPIClient, listMetricsPageLimit int) *MetricsClient {
	return &MetricsClient{
		ListMetricsAPIClient: client,
		listMetricsPageLimit: listMetricsPageLimit,
	}
}

func (mc *MetricsClient) ListMetricsWithPageLimit(ctx context.Context, params *cloudwatch.ListMetricsInput) ([]resources.MetricResponse, error) {
	var responses []resources.MetricResponse
	paginator := cloudwatch.NewListMetricsPaginator(mc.ListMetricsAPIClient, params)
	includeAccount := params.IncludeLinkedAccounts != nil && *params.IncludeLinkedAccounts
	pages := 0
	for paginator.HasMorePages() && pages < mc.listMetricsPageLimit {
		pages += 1
		page, err := paginator.NextPage(ctx)
		if err != nil {
			return responses, err
		}
		for i, metric := range page.Metrics {
			resp := resources.MetricResponse{Metric: metric}
			if includeAccount && len(page.OwningAccounts) >= i {
				resp.AccountId = &page.OwningAccounts[i]
			}
			responses = append(responses, resp)
		}
	}
	return responses, nil
}
