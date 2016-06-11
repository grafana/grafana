package alerting

import (
	"fmt"

	"github.com/grafana/grafana/pkg/bus"
	m "github.com/grafana/grafana/pkg/models"
)

type UpdateDashboardAlertsCommand struct {
	UserId    int64
	OrgId     int64
	Dashboard *m.Dashboard
}

func init() {
	bus.AddHandler("alerting", updateDashboardAlerts)
}

func updateDashboardAlerts(cmd *UpdateDashboardAlertsCommand) error {
	saveAlerts := m.SaveAlertsCommand{
		OrgId:  cmd.OrgId,
		UserId: cmd.UserId,
	}

	extractor := NewDashAlertExtractor(cmd.Dashboard, cmd.OrgId)

	if alerts, err := extractor.GetAlerts(); err != nil {
		return err
	} else {
		saveAlerts.Alerts = alerts
	}

	if err := bus.Dispatch(&saveAlerts); err != nil {
		return err
	}

	return nil
}

func ConvetAlertModelToAlertRule(ruleDef *m.Alert) (*AlertRule, error) {
	model := &AlertRule{}
	model.Id = ruleDef.Id
	model.OrgId = ruleDef.OrgId
	model.Name = ruleDef.Name
	model.Description = ruleDef.Description
	model.State = ruleDef.State

	critical := ruleDef.Expression.Get("critical")
	model.Critical = Level{
		Operator: critical.Get("op").MustString(),
		Level:    critical.Get("level").MustFloat64(),
	}

	warning := ruleDef.Expression.Get("warning")
	model.Warning = Level{
		Operator: warning.Get("op").MustString(),
		Level:    warning.Get("level").MustFloat64(),
	}

	model.Frequency = ruleDef.Expression.Get("frequency").MustInt64()
	model.Transform = ruleDef.Expression.Get("transform").Get("type").MustString()
	model.TransformParams = *ruleDef.Expression.Get("transform")

	if model.Transform == "aggregation" {
		model.Transformer = &AggregationTransformer{
			Method: ruleDef.Expression.Get("transform").Get("method").MustString(),
		}
	}

	query := ruleDef.Expression.Get("query")
	model.Query = AlertQuery{
		Query:        query.Get("query").MustString(),
		DatasourceId: query.Get("datasourceId").MustInt64(),
		From:         query.Get("from").MustString(),
		To:           query.Get("to").MustString(),
		Aggregator:   query.Get("agg").MustString(),
	}

	if model.Query.Query == "" {
		return nil, fmt.Errorf("missing query.query")
	}

	if model.Query.DatasourceId == 0 {
		return nil, fmt.Errorf("missing query.datasourceId")
	}

	return model, nil
}
