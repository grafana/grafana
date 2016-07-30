package alerting

import (
	"fmt"
	"time"

	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/log"
	m "github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/setting"
)

type EvalContext struct {
	Firing          bool
	IsTestRun       bool
	Events          []*Event
	Logs            []*ResultLogEntry
	Error           error
	Description     string
	StartTime       time.Time
	EndTime         time.Time
	Rule            *Rule
	DoneChan        chan bool
	CancelChan      chan bool
	log             log.Logger
	dashboardSlug   string
	ImagePublicUrl  string
	ImageOnDiskPath string
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

func (c *EvalContext) getDashboardSlug() (string, error) {
	if c.dashboardSlug != "" {
		return c.dashboardSlug, nil
	}

	slugQuery := &m.GetDashboardSlugByIdQuery{Id: c.Rule.DashboardId}
	if err := bus.Dispatch(slugQuery); err != nil {
		return "", err
	}

	c.dashboardSlug = slugQuery.Result
	return c.dashboardSlug, nil
}

func (c *EvalContext) GetRuleUrl() (string, error) {
	if slug, err := c.getDashboardSlug(); err != nil {
		return "", err
	} else {
		ruleUrl := fmt.Sprintf("%sdashboard/db/%s?fullscreen&edit&tab=alert&panelId=%d", setting.AppUrl, slug, c.Rule.PanelId)
		return ruleUrl, nil
	}
}

func (c *EvalContext) GetImageUrl() (string, error) {
	if slug, err := c.getDashboardSlug(); err != nil {
		return "", err
	} else {
		ruleUrl := fmt.Sprintf("%sdashboard-solo/db/%s?&panelId=%d", setting.AppUrl, slug, c.Rule.PanelId)
		return ruleUrl, nil
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
