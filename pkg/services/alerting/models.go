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
	TriggeredAlerts []*TriggeredAlert
	Error           error
	Description     string
	StartTime       time.Time
	EndTime         time.Time

	AlertJob *AlertJob
}

type TriggeredAlert struct {
	Value  float64
	Metric string
	State  string
	Tags   map[string]string
}

type Level struct {
	Operator string
	Value    float64
}

type AlertQuery struct {
	Query        string
	DatasourceId int64
	From         string
	To           string
}
