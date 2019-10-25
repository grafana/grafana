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

type queryEditorRow struct {
	RefId              string
	Region             string
	Id                 string
	Namespace          string
	MetricName         string
	Statistics         []*string
	QueryType          string
	Expression         string
	ReturnData         bool
	Dimensions         map[string][]string
	ExtendedStatistics []*string
	Period             int
	Alias              string
	HighResolution     bool
	MatchExact         bool
}
