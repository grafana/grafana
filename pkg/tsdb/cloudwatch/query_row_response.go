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

func (q *queryRowResponse) addMetricDataResult(mdr *cloudwatch.MetricDataResult, partialDataSet map[string]*cloudwatch.MetricDataResult) {
	if metricDataResult, ok := partialDataSet[*mdr.Label]; ok {
		metricDataResult.Timestamps = append(metricDataResult.Timestamps, mdr.Timestamps...)
		metricDataResult.Values = append(metricDataResult.Values, mdr.Values...)
		q.StatusCode = *mdr.StatusCode
		if *mdr.StatusCode != "PartialData" {
			delete(partialDataSet, *mdr.Label)
		}
		return
	}

	q.Labels = append(q.Labels, *mdr.Label)
	q.Metrics = append(q.Metrics, mdr)
	q.StatusCode = *mdr.StatusCode
	if *mdr.StatusCode == "PartialData" {
		partialDataSet[*mdr.Label] = mdr
	}
}

func (q *queryRowResponse) addArithmeticError(message *string) {
	q.HasArithmeticError = true
	q.ArithmeticErrorMessage = *message
}
