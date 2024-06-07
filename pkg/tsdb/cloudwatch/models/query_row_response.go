package models

import (
	"github.com/aws/aws-sdk-go/service/cloudwatch"
)

// queryRowResponse represents the GetMetricData response for a query row in the query editor.
type QueryRowResponse struct {
	partialDataSet         map[string]*cloudwatch.MetricDataResult
	ErrorCodes             map[string]bool
	HasArithmeticError     bool
	ArithmeticErrorMessage string
	HasPermissionError     bool
	PermissionErrorMessage string
	Metrics                []*cloudwatch.MetricDataResult
	StatusCode             string
}

func NewQueryRowResponse(errors map[string]bool) QueryRowResponse {
	return QueryRowResponse{
		partialDataSet:         make(map[string]*cloudwatch.MetricDataResult),
		ErrorCodes:             errors,
		HasArithmeticError:     false,
		ArithmeticErrorMessage: "",
		Metrics:                []*cloudwatch.MetricDataResult{},
	}
}

func (q *QueryRowResponse) AddMetricDataResult(mdr *cloudwatch.MetricDataResult) {
	if mdr.Label == nil {
		return
	}

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

func (q *QueryRowResponse) AddArithmeticError(message *string) {
	q.HasArithmeticError = true
	q.ArithmeticErrorMessage = *message
}

func (q *QueryRowResponse) AddPermissionError(message *string) {
	q.HasPermissionError = true
	q.PermissionErrorMessage = *message
}
