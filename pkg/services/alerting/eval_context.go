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
	EvalMatches     []*EvalMatch
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
	NoDataFound     bool
	RetryCount      int
}

type StateDescription struct {
	Color string
	Text  string
	Data  string
}

func (c *EvalContext) GetStateModel() *StateDescription {
	switch c.Rule.State {
	case m.AlertStateOK:
		return &StateDescription{
			Color: "#36a64f",
			Text:  "OK",
		}
	case m.AlertStateUnknown:
		return &StateDescription{
			Color: "#888888",
			Text:  "UNKNOWN",
		}
	case m.AlertStateExeuctionError:
		return &StateDescription{
			Color: "#000",
			Text:  "EXECUTION_ERROR",
		}
	case m.AlertStateWarning:
		return &StateDescription{
			Color: "#fd821b",
			Text:  "WARNING",
		}
	case m.AlertStateCritical:
		return &StateDescription{
			Color: "#D63232",
			Text:  "CRITICAL",
		}
	default:
		panic("Unknown rule state " + c.Rule.State)
	}

}

func (a *EvalContext) GetDurationMs() float64 {
	return float64(a.EndTime.Nanosecond()-a.StartTime.Nanosecond()) / float64(1000000)
}

func (c *EvalContext) GetNotificationTitle() string {
	return "[" + c.GetStateModel().Text + "] " + c.Rule.Name
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
		StartTime:   time.Now(),
		Rule:        rule,
		Logs:        make([]*ResultLogEntry, 0),
		EvalMatches: make([]*EvalMatch, 0),
		DoneChan:    make(chan bool, 1),
		CancelChan:  make(chan bool, 1),
		log:         log.New("alerting.evalContext"),
		RetryCount:  0,
	}
}
