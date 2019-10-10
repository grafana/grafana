package cloudwatch

type CloudWatchQuery struct {
	RefId              string
	Region             string              `json:"region"`
	Id                 string              `json:"id"`
	Namespace          string              `json:"namespace"`
	MetricName         string              `json:"metricName"`
	Dimensions         map[string][]string `json:"dimensions"`
	Statistics         []*string           `json:"statistics"`
	QueryType          string              `json:"type"`
	PeriodString       string              `json:"period"`
	Expression         string              `json:"expression"`
	ReturnData         bool                `json:"hide"`
	ExtendedStatistics []*string
	Period             int
	Alias              string
	Identifier         string
	HighResolution     bool
}
