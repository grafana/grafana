package cloudwatch

import (
	"fmt"

	"github.com/aws/aws-sdk-go/aws"
	"github.com/aws/aws-sdk-go/aws/request"
	"github.com/aws/aws-sdk-go/service/cloudwatch"
	"github.com/grafana/grafana/pkg/tsdb"
)

type cloudWatchClient interface {
	GetMetricDataWithContext(ctx aws.Context, input *cloudwatch.GetMetricDataInput, opts ...request.Option) (*cloudwatch.GetMetricDataOutput, error)
}

type requestQuery struct {
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
	MatchExact         bool
}

type cloudwatchResponse struct {
	series                  *tsdb.TimeSeriesSlice
	Id                      string
	RefId                   string
	Expression              string
	RequestExceededMaxLimit bool
	PartialData             bool
	Period                  int
}

type queryError struct {
	err   error
	RefID string
}

func (e *queryError) Error() string {
	return fmt.Sprintf("error parsing query %q, %s", e.RefID, e.err)
}
