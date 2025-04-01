package models

import (
	cloudwatchtypes "github.com/aws/aws-sdk-go-v2/service/cloudwatch/types"
)

// QueryRowResponse represents the GetMetricData response for a query row in the query editor.
type QueryRowResponse struct {
	partialDataSet         map[string]*cloudwatchtypes.MetricDataResult
	ErrorCodes             map[string]bool
	HasArithmeticError     bool
	ArithmeticErrorMessage string
	HasPermissionError     bool
	PermissionErrorMessage string
	Metrics                []*cloudwatchtypes.MetricDataResult
	StatusCode             cloudwatchtypes.StatusCode
}

func NewQueryRowResponse(errors map[string]bool) QueryRowResponse {
	return QueryRowResponse{
		partialDataSet:         make(map[string]*cloudwatchtypes.MetricDataResult),
		ErrorCodes:             errors,
		HasArithmeticError:     false,
		ArithmeticErrorMessage: "",
		Metrics:                []*cloudwatchtypes.MetricDataResult{},
	}
}

func (q *QueryRowResponse) AddMetricDataResult(mdr *cloudwatchtypes.MetricDataResult) {
	if mdr.Label == nil {
		return
	}

	if partialData, ok := q.partialDataSet[*mdr.Label]; ok {
		partialData.Timestamps = append(partialData.Timestamps, mdr.Timestamps...)
		partialData.Values = append(partialData.Values, mdr.Values...)
		q.StatusCode = mdr.StatusCode
		if mdr.StatusCode != cloudwatchtypes.StatusCodePartialData {
			delete(q.partialDataSet, *mdr.Label)
		}
		return
	}

	q.Metrics = append(q.Metrics, mdr)
	q.StatusCode = mdr.StatusCode
	if mdr.StatusCode == cloudwatchtypes.StatusCodePartialData {
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
