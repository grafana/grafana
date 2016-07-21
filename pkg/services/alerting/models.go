package alerting

import (
	"time"

	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/log"
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
	IsTestRun   bool
	Events      []*AlertEvent
	Logs        []*AlertResultLogEntry
	Error       error
	Description string
	StartTime   time.Time
	EndTime     time.Time
	Rule        *AlertRule
	DoneChan    chan bool
	CancelChan  chan bool
	log         log.Logger
}

func (a *AlertResultContext) GetDurationSeconds() float64 {
	return float64(a.EndTime.Nanosecond()-a.StartTime.Nanosecond()) / float64(1000000000)
}

func NewAlertResultContext(rule *AlertRule) *AlertResultContext {
	return &AlertResultContext{
		StartTime:  time.Now(),
		Rule:       rule,
		Logs:       make([]*AlertResultLogEntry, 0),
		Events:     make([]*AlertEvent, 0),
		DoneChan:   make(chan bool, 1),
		CancelChan: make(chan bool, 1),
		log:        log.New("alerting.engine"),
	}
}

type AlertResultLogEntry struct {
	Message string
	Data    interface{}
}

type AlertEvent struct {
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
