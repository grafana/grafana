package alerting

import (
	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/log"
	m "github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/setting"
	_ "github.com/grafana/grafana/pkg/tsdb/graphite"
)

var (
	maxRetries = 3
)

var engine *Engine

func Init() {
	if !setting.AlertingEnabled {
		return
	}

	engine = NewEngine()
	engine.Start()

	// scheduler := NewScheduler()
	// reader := NewRuleReader()
	//
	// go scheduler.dispatch(reader)
	// go scheduler.executor(&ExecutorImpl{})
	// go scheduler.handleResponses()
}

func saveState(result *AlertResult) {
	cmd := &m.UpdateAlertStateCommand{
		AlertId:  result.AlertJob.Rule.Id,
		NewState: result.State,
		Info:     result.Description,
	}

	if err := bus.Dispatch(cmd); err != nil {
		log.Error(2, "failed to save state %v", err)
	}
}
