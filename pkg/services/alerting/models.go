package alerting

import "github.com/grafana/grafana/pkg/services/alerting/alertstates"

type AlertJob struct {
	Offset     int64
	Delay      bool
	Running    bool
	RetryCount int
	Rule       *AlertRule
}

type AlertResult struct {
	Id          int64
	State       string
	ActualValue float64
	Duration    float64
	Description string
	AlertJob    *AlertJob
}

func (ar *AlertResult) IsResultIncomplete() bool {
	return ar.State == alertstates.Pending
}

type AlertRule struct {
	Id           int64
	OrgId        int64
	DatasourceId int64
	DashboardId  int64
	PanelId      int64
	Query        string
	QueryRefId   string
	WarnLevel    float64
	CritLevel    float64
	WarnOperator string
	CritOperator string
	Frequency    int64
	Title        string
	Description  string
	QueryRange   int
	Aggregator   string
}
