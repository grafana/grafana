package cloudwatch

import "github.com/aws/aws-sdk-go/service/cloudwatch"

// queryRowResponse represents the GetMetricData response for a query row in the query editor.
type queryRowResponse struct {
	ErrorCodes             map[string]bool
	Labels                 []string
	HasArithmeticError     bool
	ArithmeticErrorMessage string
	Metrics                []*cloudwatch.MetricDataResult
	StatusCode             string
}

func newQueryRowResponse() queryRowResponse {
	return queryRowResponse{
		ErrorCodes: map[string]bool{
			maxMetricsExceeded:         false,
			maxQueryTimeRangeExceeded:  false,
			maxQueryResultsExceeded:    false,
			maxMatchingResultsExceeded: false},
		HasArithmeticError:     false,
		ArithmeticErrorMessage: "",
		Labels:                 []string{},
		Metrics:                []*cloudwatch.MetricDataResult{},
	}
}

func (q *queryRowResponse) addMetricDataResult(mdr *cloudwatch.MetricDataResult) {
	label := *mdr.Label
	found := false
	for _, m := range q.Metrics {
		if label == *m.Label && *m.StatusCode == "PartialData" {
			m.Timestamps = append(m.Timestamps, mdr.Timestamps...)
			m.Values = append(m.Values, mdr.Values...)
			q.StatusCode = *mdr.StatusCode
			found = true
			break
		}
	}

	if !found {
		q.Labels = append(q.Labels, label)
		q.Metrics = append(q.Metrics, mdr)
		q.StatusCode = *mdr.StatusCode
	}
}

func (q *queryRowResponse) addArithmeticError(message *string) {
	q.HasArithmeticError = true
	q.ArithmeticErrorMessage = *message
}
