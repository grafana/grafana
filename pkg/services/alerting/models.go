package alerting

import (
	"time"

	"github.com/grafana/grafana/pkg/log"
)

type Job struct {
	Offset  int64
	Delay   bool
	Running bool
	Rule    *Rule
}

type EvalContext struct {
	Firing      bool
	IsTestRun   bool
	Events      []*Event
	Logs        []*ResultLogEntry
	Error       error
	Description string
	StartTime   time.Time
	EndTime     time.Time
	Rule        *Rule
	DoneChan    chan bool
	CancelChan  chan bool
	log         log.Logger
}

func (a *EvalContext) GetDurationMs() float64 {
	return float64(a.EndTime.Nanosecond()-a.StartTime.Nanosecond()) / float64(1000000)
}

func NewEvalContext(rule *Rule) *EvalContext {
	return &EvalContext{
		StartTime:  time.Now(),
		Rule:       rule,
		Logs:       make([]*ResultLogEntry, 0),
		Events:     make([]*Event, 0),
		DoneChan:   make(chan bool, 1),
		CancelChan: make(chan bool, 1),
		log:        log.New("alerting.engine"),
	}
}

type ResultLogEntry struct {
	Message string
	Data    interface{}
}

type Event struct {
	Value  float64
	Metric string
	State  string
	Tags   map[string]string
}

type Level struct {
	Operator string
	Value    float64
}
