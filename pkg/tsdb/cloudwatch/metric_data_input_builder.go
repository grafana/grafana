package cloudwatch

import (
	"context"
	"time"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/service/cloudwatch"
	cloudwatchtypes "github.com/aws/aws-sdk-go-v2/service/cloudwatch/types"

	"github.com/grafana/grafana/pkg/tsdb/cloudwatch/models"
)

func (ds *DataSource) buildMetricDataInput(ctx context.Context, startTime time.Time, endTime time.Time,
	queries []*models.CloudWatchQuery) (*cloudwatch.GetMetricDataInput, error) {
	metricDataInput := &cloudwatch.GetMetricDataInput{
		StartTime: aws.Time(startTime),
		EndTime:   aws.Time(endTime),
		ScanBy:    cloudwatchtypes.ScanByTimestampAscending,
	}

	shouldSetLabelOptions := len(queries) > 0 && len(queries[0].TimezoneUTCOffset) > 0

	if shouldSetLabelOptions {
		metricDataInput.LabelOptions = &cloudwatchtypes.LabelOptions{
			Timezone: aws.String(queries[0].TimezoneUTCOffset),
		}
	}

	for _, query := range queries {
		metricDataQuery, err := ds.buildMetricDataQuery(ctx, query)
		if err != nil {
			return nil, &models.QueryError{Err: err, RefID: query.RefId}
		}
		metricDataInput.MetricDataQueries = append(metricDataInput.MetricDataQueries, metricDataQuery)
	}

	return metricDataInput, nil
}
