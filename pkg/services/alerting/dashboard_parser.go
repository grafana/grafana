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
				DashboardId:  cmd.Result.Id,
				OrgId:        cmd.Result.OrgId,
				PanelId:      panel.Get("id").MustInt64(),
				Id:           alerting.Get("id").MustInt64(),
				QueryRefId:   alerting.Get("queryRef").MustString(),
				WarnLevel:    alerting.Get("warnLevel").MustFloat64(),
				CritLevel:    alerting.Get("critLevel").MustFloat64(),
				WarnOperator: alerting.Get("warnOperator").MustString(),
				CritOperator: alerting.Get("critOperator").MustString(),
				Frequency:    alerting.Get("frequency").MustInt64(),
				Name:         alerting.Get("name").MustString(),
				Description:  alerting.Get("description").MustString(),
				QueryRange:   alerting.Get("queryRange").MustInt(),
				Aggregator:   alerting.Get("aggregator").MustString(),
			}

			log.Info("Alertrule: %v", alert.Name)
			for _, targetsObj := range panel.Get("targets").MustArray() {
				target := simplejson.NewFromAny(targetsObj)

				if target.Get("refId").MustString() == alert.QueryRefId {
					targetJson, err := target.MarshalJSON()
					if err == nil {
						alert.Query = string(targetJson)
					}
					continue
				}
			}

			if panel.Get("datasource").MustString() == "" {
				query := &m.GetDataSourcesQuery{OrgId: cmd.OrgId}
				if err := bus.Dispatch(query); err == nil {
					for _, ds := range query.Result {
						if ds.IsDefault {
							alert.DatasourceId = ds.Id
						}
					}
				}
			} else {
				query := &m.GetDataSourceByNameQuery{
					Name:  panel.Get("datasource").MustString(),
					OrgId: cmd.OrgId,
				}
				bus.Dispatch(query)
				alert.DatasourceId = query.Result.Id
			}

			if alert.ValidToSave() {
				alerts = append(alerts, alert)
			}
		}
	}

	return alerts
}
