package cloudwatch

type CloudWatchQuery struct {
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
	Identifier         string
	HighResolution     bool
	SearchExpressions  []string
}
