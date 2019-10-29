package cloudwatch

import (
	"time"

	"github.com/aws/aws-sdk-go/aws"
	"github.com/aws/aws-sdk-go/service/cloudwatch"
)

type metricDataParam struct {
	MetricDataInput   *cloudwatch.GetMetricDataInput
	CloudwatchQueries []*cloudWatchQuery
}

func newMetricDataParam(startTime time.Time, endTime time.Time) *metricDataParam {
	return &metricDataParam{
		CloudwatchQueries: make([]*cloudWatchQuery, 0),
		MetricDataInput: &cloudwatch.GetMetricDataInput{
			StartTime: aws.Time(startTime),
			EndTime:   aws.Time(endTime),
			ScanBy:    aws.String("TimestampAscending"),
		},
	}
}

func (mdp *metricDataParam) getUniqueRefIDs() map[string]*cloudWatchQuery {
	refIds := make(map[string]*cloudWatchQuery)
	for _, query := range mdp.CloudwatchQueries {
		if _, ok := refIds[query.RefId]; !ok {
			refIds[query.RefId] = query
		}
	}

	return refIds
}

func (mdp *metricDataParam) groupQueriesByID() map[string]*cloudWatchQuery {
	queriesByID := make(map[string]*cloudWatchQuery)
	for _, query := range mdp.CloudwatchQueries {
		queriesByID[query.Id] = query
	}

	return queriesByID
}
