package alerting

import (
	"fmt"

	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/log"
	m "github.com/grafana/grafana/pkg/models"
)

func ParseAlertsFromDashboard(cmd *m.SaveDashboardCommand) []*m.AlertRuleDAO {
	alerts := make([]*m.AlertRuleDAO, 0)

	for _, rowObj := range cmd.Dashboard.Get("rows").MustArray() {
		row := simplejson.NewFromAny(rowObj)

		for _, panelObj := range row.Get("panels").MustArray() {
			panel := simplejson.NewFromAny(panelObj)

			alerting := panel.Get("alerting")
			alert := &m.AlertRuleDAO{
				DashboardId: cmd.Result.Id,
				OrgId:       cmd.Result.OrgId,
				PanelId:     panel.Get("id").MustInt64(),
				Id:          alerting.Get("id").MustInt64(),
				Name:        alerting.Get("name").MustString(),
				Description: alerting.Get("description").MustString(),
			}

			log.Info("Alertrule: %v", alert.Name)

			valueQuery := alerting.Get("valueQuery")
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
									alerting.SetPath([]string{"valueQuery", "datasourceId"}, ds.Id)
								}
							}
						}
					} else {
						query := &m.GetDataSourceByNameQuery{
							Name:  panel.Get("datasource").MustString(),
							OrgId: cmd.OrgId,
						}
						bus.Dispatch(query)
						alerting.SetPath([]string{"valueQuery", "datasourceId"}, query.Result.Id)
					}

					targetQuery := target.Get("target").MustString()
					if targetQuery != "" {
						alerting.SetPath([]string{"valueQuery", "query"}, targetQuery)
					}
				}
			}

			alert.Expression = alerting

			_, err := ParseAlertRulesFromAlertModel(alert)

			if err == nil && alert.ValidToSave() {
				alerts = append(alerts, alert)
			} else {
				log.Error2("Failed to parse model from expression", "error", err)
			}

		}
	}

	return alerts
}

func ParseAlertRulesFromAlertModel(ruleDef *m.AlertRuleDAO) (*AlertRule, error) {
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

	valueQuery := ruleDef.Expression.Get("valueQuery")

	model.ValueQuery = AlertQuery{
		Query:        valueQuery.Get("query").MustString(),
		DatasourceId: valueQuery.Get("datasourceId").MustInt64(),
		From:         valueQuery.Get("from").MustString(),
		To:           valueQuery.Get("to").MustString(),
		Aggregator:   valueQuery.Get("agg").MustString(),
	}

	if model.ValueQuery.Query == "" {
		return nil, fmt.Errorf("missing valueQuery query")
	}

	if model.ValueQuery.DatasourceId == 0 {
		return nil, fmt.Errorf("missing valueQuery datasourceId")
	}

	return model, nil
}
