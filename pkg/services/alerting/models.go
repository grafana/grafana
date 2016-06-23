package alerting

import "time"

type AlertJob struct {
	Offset     int64
	Delay      bool
	Running    bool
	RetryCount int
	Rule       *AlertRule
}

func (aj *AlertJob) Retryable() bool {
	return aj.RetryCount < maxAlertExecutionRetries
}

func (aj *AlertJob) ResetRetry() {
	aj.RetryCount = 0
}

func (aj *AlertJob) IncRetry() {
	aj.RetryCount++
}

type AlertResult struct {
	State           string
	ActualValue     float64
	Duration        float64
	TriggeredAlerts []*TriggeredAlert
	Description     string
	Error           error
	AlertJob        *AlertJob
	ExeuctionTime   time.Time
}

type TriggeredAlert struct {
	ActualValue float64
	Name        string
	State       string
}

type Level struct {
	Operator string
	Value    float64
}

type AlertQuery struct {
	Query        string
	DatasourceId int64
	Aggregator   string
	From         string
	To           string
}
