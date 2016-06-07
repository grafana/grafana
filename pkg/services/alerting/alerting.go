package alerting

import (
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
