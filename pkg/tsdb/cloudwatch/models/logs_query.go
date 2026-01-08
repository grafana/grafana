package models

import (
	"github.com/grafana/grafana/pkg/tsdb/cloudwatch/kinds/dataquery"
)

type LogsQuery struct {
	dataquery.CloudWatchLogsQuery
	StartTime     *int64
	EndTime       *int64
	Limit         *int32
	LogGroupName  string
	LogStreamName string
	QueryId       string
	QueryString   string
	StartFromHead bool
	Subtype       string
}
