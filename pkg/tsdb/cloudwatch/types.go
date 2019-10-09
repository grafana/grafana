package cloudwatch

import (
	"github.com/aws/aws-sdk-go/service/cloudwatch"
)

type CloudWatchQuery struct {
	RefId              string
	Region             string
	Namespace          string
	MetricName         string
	Dimensions         []*cloudwatch.Dimension
	Statistics         []*string
	ExtendedStatistics []*string
	Period             int
	Alias              string
	Id                 string
	Identifier         string
	Expression         string
	ReturnData         bool
	HighResolution     bool
}
