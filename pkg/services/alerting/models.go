package alerting

import (
	"time"

	"github.com/grafana/grafana/pkg/components/simplejson"
)

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

type AlertResultContext struct {
	Triggered   bool
	Details     []*AlertResultDetail
	Error       error
	Description string
	StartTime   time.Time
	EndTime     time.Time
	Rule        *AlertRule
}

type AlertResultDetail struct {
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
	Model        *simplejson.Json
	DatasourceId int64
	From         string
	To           string
}
