package alerting

import (
	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/tsdb"
)

type AlertJob struct {
	Offset     int64
	Delay      bool
	Running    bool
	RetryCount int
	Rule       *AlertRule
}

type AlertResult struct {
	State       string
	ActualValue float64
	Duration    float64
	Description string
	Error       error
	AlertJob    *AlertJob
}

type AlertRule struct {
	Id              int64
	OrgId           int64
	DashboardId     int64
	PanelId         int64
	Frequency       int64
	Name            string
	Description     string
	State           string
	Warning         Level
	Critical        Level
	Query           AlertQuery
	Transform       string
	TransformParams simplejson.Json
}

type Transformer interface {
	Transform(tsdb tsdb.TimeSeriesSlice) float64
}

type Level struct {
	Operator string
	Level    float64
}

type AlertQuery struct {
	Query        string
	DatasourceId int64
	Aggregator   string
	From         string
	To           string
}
