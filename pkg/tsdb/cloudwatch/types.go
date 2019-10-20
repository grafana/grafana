package cloudwatch

import (
	"fmt"

	"github.com/aws/aws-sdk-go/aws"
	"github.com/aws/aws-sdk-go/aws/request"
	"github.com/aws/aws-sdk-go/service/cloudwatch"
)

type cloudWatchClient interface {
	GetMetricDataWithContext(ctx aws.Context, input *cloudwatch.GetMetricDataInput, opts ...request.Option) (*cloudwatch.GetMetricDataOutput, error)
}

type queryBuilderError struct {
	err   error
	RefID string
}

func (e *queryBuilderError) Error() string {
	return fmt.Sprintf("Error parsing query %s, %s", e.RefID, e.err)
}
