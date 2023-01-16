package models

type LogGroup struct {
	ARN       string `json:"arn"`
	Name      string `json:"name"`
	AccountID string `json:"accountId"`
}

type LogsQuery struct {
	LogType            string `json:"type"`
	SubType            string
	Limit              *int64
	Time               int64
	StartTime          *int64
	EndTime            *int64
	LogGroupName       string
	LogGroupNames      []string
	LogGroups          []LogGroup `json:"logGroups"`
	LogGroupNamePrefix string
	LogStreamName      string
	StartFromHead      bool
	Region             string
	QueryString        string
	QueryId            string
	StatsGroups        []string
	Subtype            string
	Expression         string
}
