package init

import (
	"github.com/grafana/grafana/pkg/services/alerting"
	_ "github.com/grafana/grafana/pkg/services/alerting/conditions"
	_ "github.com/grafana/grafana/pkg/services/alerting/notifiers"
	"github.com/grafana/grafana/pkg/setting"
	_ "github.com/grafana/grafana/pkg/tsdb/graphite"
	_ "github.com/grafana/grafana/pkg/tsdb/prometheus"
)

var engine *alerting.Engine

func Init() {
	if !setting.AlertingEnabled {
		return
	}

	engine = alerting.NewEngine()
	engine.Start()
}
