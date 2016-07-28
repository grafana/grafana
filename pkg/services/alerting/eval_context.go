package alerting

import (
	"time"

	"github.com/grafana/grafana/pkg/log"
	m "github.com/grafana/grafana/pkg/models"
)

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

func (c *EvalContext) GetColor() string {
	if !c.Firing {
		return "#36a64f"
	}

	if c.Rule.Severity == m.AlertSeverityWarning {
		return "#fd821b"
	} else {
		return "#D63232"
	}
}

func (c *EvalContext) GetStateText() string {
	if !c.Firing {
		return "OK"
	}

	if c.Rule.Severity == m.AlertSeverityWarning {
		return "WARNING"
	} else {
		return "CRITICAL"
	}
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
