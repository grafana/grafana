package init

import (
	"context"

	"github.com/grafana/grafana/pkg/services/alerting"
	_ "github.com/grafana/grafana/pkg/services/alerting/conditions"
	_ "github.com/grafana/grafana/pkg/services/alerting/notifiers"
	"github.com/grafana/grafana/pkg/setting"
	_ "github.com/grafana/grafana/pkg/tsdb/graphite"
	_ "github.com/grafana/grafana/pkg/tsdb/prometheus"
	_ "github.com/grafana/grafana/pkg/tsdb/testdata"
)

func Init(ctx context.Context) error {
	if !setting.AlertingEnabled {
		return nil
	}

	engine = alerting.NewEngine()
	return engine.Start(ctx)
}
