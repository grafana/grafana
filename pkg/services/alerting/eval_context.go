package alerting

import (
	"context"
	"fmt"
	"sync"
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
	DoneChan        chan struct{}
	log             log.Logger
	dashboardSlug   string
	ImagePublicUrl  string
	ImageOnDiskPath string
	NoDataFound     bool
	RetryCount      int

	Cancel  context.CancelFunc
	Context context.Context
}

func (*EvalContext) Deadline() (deadline time.Time, ok bool) {
	return
}

func merge(cs ...<-chan struct{}) <-chan struct{} {
	var wg sync.WaitGroup
	out := make(chan struct{})

	// Start an output goroutine for each input channel in cs.  output
	// copies values from c to out until c is closed, then calls wg.Done.
	output := func(c <-chan struct{}) {
		for n := range c {
			out <- n
		}
		wg.Done()
	}
	wg.Add(len(cs))
	for _, c := range cs {
		go output(c)
	}

	// Start a goroutine to close out once all the output goroutines are
	// done.  This must start after the wg.Add call.
	go func() {
		wg.Wait()
		close(out)
	}()
	return out
}

func (c *EvalContext) Done() <-chan struct{} {
	return c.DoneChan
	//return merge(c.Context.Done(), c.DoneChan)
}

func (c *EvalContext) Err() error {
	return c.Context.Err()
}

func (*EvalContext) Value(key interface{}) interface{} {
	return nil
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
	case m.AlertStateNoData:
		return &StateDescription{
			Color: "#888888",
			Text:  "No Data",
		}
	case m.AlertStateExecError:
		return &StateDescription{
			Color: "#000",
			Text:  "Execution Error",
		}
	case m.AlertStateAlerting:
		return &StateDescription{
			Color: "#D63232",
			Text:  "Alerting",
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

func (c *EvalContext) GetDashboardSlug() (string, error) {
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
	if slug, err := c.GetDashboardSlug(); err != nil {
		return "", err
	} else {
		ruleUrl := fmt.Sprintf("%sdashboard/db/%s?fullscreen&edit&tab=alert&panelId=%d", setting.AppUrl, slug, c.Rule.PanelId)
		return ruleUrl, nil
	}
}

func NewEvalContext(grafanaCtx context.Context, rule *Rule) *EvalContext {
	//ctx, cancelFn := context.WithCancel(grafanaCtx)

	ctx2, cancelFn := context.WithTimeout(grafanaCtx, time.Duration(time.Second*20))

	return &EvalContext{
		Cancel:      cancelFn,
		Context:     ctx2,
		StartTime:   time.Now(),
		Rule:        rule,
		Logs:        make([]*ResultLogEntry, 0),
		EvalMatches: make([]*EvalMatch, 0),
		DoneChan:    make(chan struct{}),
		log:         log.New("alerting.evalContext"),
		RetryCount:  0,
	}
}
