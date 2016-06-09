package alerting

import (
	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/log"
	m "github.com/grafana/grafana/pkg/models"
)

func ParseAlertsFromDashboard(cmd *m.SaveDashboardCommand) []*m.AlertRule {
	alerts := make([]*m.AlertRule, 0)

	for _, rowObj := range cmd.Dashboard.Get("rows").MustArray() {
		row := simplejson.NewFromAny(rowObj)

		for _, panelObj := range row.Get("panels").MustArray() {
			panel := simplejson.NewFromAny(panelObj)

			alerting := panel.Get("alerting")
			alert := &m.AlertRule{
				DashboardId: cmd.Result.Id,
				OrgId:       cmd.Result.OrgId,
				PanelId:     panel.Get("id").MustInt64(),
				Id:          alerting.Get("id").MustInt64(),
				Name:        alerting.Get("name").MustString(),
				Description: alerting.Get("description").MustString(),
			}

			log.Info("Alertrule: %v", alert.Name)

			expression := alerting
			valueQuery := expression.Get("valueQuery")
			valueQueryRef := valueQuery.Get("queryRefId").MustString()
			for _, targetsObj := range panel.Get("targets").MustArray() {
				target := simplejson.NewFromAny(targetsObj)

				if target.Get("refId").MustString() == valueQueryRef {
					datsourceName := ""
					if target.Get("datasource").MustString() != "" {
						datsourceName = target.Get("datasource").MustString()
					} else if panel.Get("datasource").MustString() != "" {
						datsourceName = panel.Get("datasource").MustString()
					}

					if datsourceName == "" {
						query := &m.GetDataSourcesQuery{OrgId: cmd.OrgId}
						if err := bus.Dispatch(query); err == nil {
							for _, ds := range query.Result {
								if ds.IsDefault {
									valueQuery.Set("datasourceId", ds.Id)
								}
							}
						}
					} else {
						query := &m.GetDataSourceByNameQuery{
							Name:  panel.Get("datasource").MustString(),
							OrgId: cmd.OrgId,
						}
						bus.Dispatch(query)
						valueQuery.Set("datasourceId", query.Result.Id)
					}

					targetQuery := target.Get("target").MustString()
					if targetQuery != "" {
						valueQuery.Set("query", targetQuery)
					}
				}
			}

			expression.Set("valueQuery", valueQuery)
			alert.Expression = expression

			alertRule := &AlertRule{}

			ParseAlertRulesFromAlertModel(alert, alertRule)

			if alert.ValidToSave() && alertRule.IsValid() {
				alerts = append(alerts, alert)
			}
		}
	}

	return alerts
}

func (rule *AlertRule) IsValid() bool {
	return rule.ValueQuery.Query != ""
}

func ParseAlertRulesFromAlertModel(ruleDef *m.AlertRule, model *AlertRule) error {
	critical := ruleDef.Expression.Get("critical")
	model.Critical = Level{
		Operator: critical.Get("operator").MustString(),
		Level:    critical.Get("level").MustFloat64(),
	}

	warning := ruleDef.Expression.Get("warning")
	model.Warning = Level{
		Operator: warning.Get("operator").MustString(),
		Level:    warning.Get("level").MustFloat64(),
	}

	model.Frequency = ruleDef.Expression.Get("frequency").MustInt64()

	valueQuery := ruleDef.Expression.Get("valueQuery")
	model.ValueQuery = AlertQuery{
		Query:        valueQuery.Get("query").MustString(),
		DatasourceId: valueQuery.Get("datasourceId").MustInt64(),
		From:         valueQuery.Get("From").MustInt64(),
		Until:        valueQuery.Get("until").MustInt64(),
		Aggregator:   valueQuery.Get("aggregator").MustString(),
	}

	return nil
}
