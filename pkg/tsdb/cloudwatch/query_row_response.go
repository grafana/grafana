package cloudwatch

import "github.com/aws/aws-sdk-go/service/cloudwatch"

// queryRowResponse represents the GetMetricData response for a query row in the query editor.
type queryRowResponse struct {
	partialDataSet         map[string]*cloudwatch.MetricDataResult
	ErrorCodes             map[string]bool
	HasArithmeticError     bool
	ArithmeticErrorMessage string
	Metrics                []*cloudwatch.MetricDataResult
	StatusCode             string
}

func newQueryRowResponse() queryRowResponse {
	return queryRowResponse{
		partialDataSet: make(map[string]*cloudwatch.MetricDataResult),
		ErrorCodes: map[string]bool{
			maxMetricsExceeded:         false,
			maxQueryTimeRangeExceeded:  false,
			maxQueryResultsExceeded:    false,
			maxMatchingResultsExceeded: false},
		HasArithmeticError:     false,
		ArithmeticErrorMessage: "",
		Metrics:                []*cloudwatch.MetricDataResult{},
	}
}

func (q *queryRowResponse) addMetricDataResult(mdr *cloudwatch.MetricDataResult) {
	if partialData, ok := q.partialDataSet[*mdr.Label]; ok {
		partialData.Timestamps = append(partialData.Timestamps, mdr.Timestamps...)
		partialData.Values = append(partialData.Values, mdr.Values...)
		q.StatusCode = *mdr.StatusCode
		if *mdr.StatusCode != "PartialData" {
			delete(q.partialDataSet, *mdr.Label)
		}
		return
	}

	q.Metrics = append(q.Metrics, mdr)
	q.StatusCode = *mdr.StatusCode
	if *mdr.StatusCode == "PartialData" {
		q.partialDataSet[*mdr.Label] = mdr
	}
}

func (q *queryRowResponse) addArithmeticError(message *string) {
	q.HasArithmeticError = true
	q.ArithmeticErrorMessage = *message
}
