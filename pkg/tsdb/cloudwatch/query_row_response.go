package cloudwatch

import "github.com/aws/aws-sdk-go/service/cloudwatch"

// queryRowResponse represents the GetMetricData response for a query row in the query editor.
type queryRowResponse struct {
	ID                     string
	ErrorCodes             map[string]bool
	PartialData            bool
	Labels                 []string
	HasArithmeticError     bool
	ArithmeticErrorMessage string
	Metrics                map[string]*cloudwatch.MetricDataResult
	StatusCode             string
}

func newQueryRowResponse(id string) queryRowResponse {
	return queryRowResponse{
		ID: id,
		ErrorCodes: map[string]bool{
			maxMetricsExceeded:         false,
			maxQueryTimeRangeExceeded:  false,
			maxQueryResultsExceeded:    false,
			maxMatchingResultsExceeded: false},
		PartialData:            false,
		HasArithmeticError:     false,
		ArithmeticErrorMessage: "",
		Labels:                 []string{},
		Metrics:                map[string]*cloudwatch.MetricDataResult{},
	}
}

func (q *queryRowResponse) addMetricDataResult(mdr *cloudwatch.MetricDataResult) {
	label := *mdr.Label
	q.Labels = append(q.Labels, label)
	q.Metrics[label] = mdr
	q.StatusCode = *mdr.StatusCode
}

func (q *queryRowResponse) appendTimeSeries(mdr *cloudwatch.MetricDataResult) {
	if _, exists := q.Metrics[*mdr.Label]; !exists {
		q.Metrics[*mdr.Label] = &cloudwatch.MetricDataResult{}
	}
	metric := q.Metrics[*mdr.Label]
	metric.Timestamps = append(metric.Timestamps, mdr.Timestamps...)
	metric.Values = append(metric.Values, mdr.Values...)
	q.StatusCode = *mdr.StatusCode
}

func (q *queryRowResponse) addArithmeticError(message *string) {
	q.HasArithmeticError = true
	q.ArithmeticErrorMessage = *message
}
