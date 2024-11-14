package resources

import "github.com/aws/aws-sdk-go/service/cloudwatch"

type Dimension struct {
	Name  string
	Value string
}

type ResourceResponse[T any] struct {
	AccountId *string `json:"accountId,omitempty"`
	Value     T       `json:"value"`
}

type MetricResponse struct {
	*cloudwatch.Metric
	AccountId *string `json:"accountId,omitempty"`
}

type Account struct {
	Id                  string `json:"id"`
	Arn                 string `json:"arn"`
	Label               string `json:"label"`
	IsMonitoringAccount bool   `json:"isMonitoringAccount"`
}

type Region struct {
	Name string `json:"name"`
}

type Metric struct {
	Name      string `json:"name"`
	Namespace string `json:"namespace"`
}

type LogGroup struct {
	Arn  string `json:"arn"`
	Name string `json:"name"`
}

type LogGroupField struct {
	Percent int64  `json:"percent"`
	Name    string `json:"name"`
}
