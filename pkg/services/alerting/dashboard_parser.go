package alerting

import (
	"fmt"

	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/log"
	m "github.com/grafana/grafana/pkg/models"
)

func ParseAlertsFromDashboard(cmd *m.SaveDashboardCommand) []*m.AlertRuleModel {
	alerts := make([]*m.AlertRuleModel, 0)

	for _, rowObj := range cmd.Dashboard.Get("rows").MustArray() {
		row := simplejson.NewFromAny(rowObj)

		for _, panelObj := range row.Get("panels").MustArray() {
			panel := simplejson.NewFromAny(panelObj)

			alerting := panel.Get("alerting")
			alert := &m.AlertRuleModel{
				DashboardId: cmd.Result.Id,
				OrgId:       cmd.Result.OrgId,
				PanelId:     panel.Get("id").MustInt64(),
				Id:          alerting.Get("id").MustInt64(),
				Name:        alerting.Get("name").MustString(),
				Description: alerting.Get("description").MustString(),
			}

			log.Info("Alertrule: %v", alert.Name)

			valueQuery := alerting.Get("query")
			valueQueryRef := valueQuery.Get("refId").MustString()
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
									alerting.SetPath([]string{"query", "datasourceId"}, ds.Id)
								}
							}
						}
					} else {
						query := &m.GetDataSourceByNameQuery{
							Name:  panel.Get("datasource").MustString(),
							OrgId: cmd.OrgId,
						}
						bus.Dispatch(query)
						alerting.SetPath([]string{"query", "datasourceId"}, query.Result.Id)
					}

					targetQuery := target.Get("target").MustString()
					if targetQuery != "" {
						alerting.SetPath([]string{"query", "query"}, targetQuery)
					}
				}
			}

			alert.Expression = alerting

			_, err := ConvetAlertModelToAlertRule(alert)

			if err == nil && alert.ValidToSave() {
				alerts = append(alerts, alert)
			} else {
				log.Error2("Failed to parse model from expression", "error", err)
			}

		}
	}

	return alerts
}

func ConvetAlertModelToAlertRule(ruleDef *m.AlertRuleModel) (*AlertRule, error) {
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
