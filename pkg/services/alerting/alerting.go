package alerting

import (
	"github.com/grafana/grafana/pkg/setting"
	_ "github.com/grafana/grafana/pkg/tsdb/graphite"
)

var (
	maxAlertExecutionRetries = 3
)

var engine *Engine

func Init() {
	if !setting.AlertingEnabled {
		return
	}

	engine = NewEngine()
	engine.Start()
}
