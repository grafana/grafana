package init

import (
	"github.com/grafana/grafana/pkg/services/alerting"
	_ "github.com/grafana/grafana/pkg/services/alerting/notifiers"
	"github.com/grafana/grafana/pkg/setting"
	_ "github.com/grafana/grafana/pkg/tsdb/graphite"
)

var engine *alerting.Engine

func Init() {
	if !setting.AlertingEnabled {
		return
	}

	engine = alerting.NewEngine()
	engine.Start()
}
